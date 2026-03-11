require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { analyzeDream, generateImage, createVideoTask, checkVideoStatus } = require("./video-service");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FREE_DREAMS_LIMIT = 3;

// ===== MongoDB (опционально) =====
let User = null;

if (process.env.MONGODB_URI) {
  const mongoose = require("mongoose");
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ MongoDB подключён"))
    .catch((err) => console.error("❌ MongoDB ошибка:", err.message));

  const userSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: null },
    dreamCount: { type: Number, default: 0 },
    subscription: {
      status: { type: String, enum: ["none", "active", "expired"], default: "none" },
      expiresAt: { type: Date, default: null },
      paymentId: { type: String, default: null },
    },
    createdAt: { type: Date, default: Date.now },
  });

  User = mongoose.models.User || mongoose.model("User", userSchema);
}

// ===== Fallback: хранилище в памяти (без MongoDB) =====
const memoryStore = new Map();

async function getUser(deviceId) {
  if (User) {
    let u = await User.findOne({ deviceId });
    if (!u) u = await User.create({ deviceId });
    // Проверяем истечение подписки
    if (u.subscription.status === "active" && u.subscription.expiresAt < new Date()) {
      u.subscription.status = "expired";
      await u.save();
    }
    return u;
  }
  // In-memory fallback
  if (!memoryStore.has(deviceId)) {
    memoryStore.set(deviceId, { deviceId, dreamCount: 0, subscription: { status: "none", expiresAt: null } });
  }
  return memoryStore.get(deviceId);
}

async function incrementDreamCount(deviceId) {
  if (User) {
    await User.findOneAndUpdate({ deviceId }, { $inc: { dreamCount: 1 } }, { upsert: true });
  } else {
    const u = await getUser(deviceId);
    u.dreamCount = (u.dreamCount || 0) + 1;
  }
}

async function activateSubscription(deviceId, paymentId) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  if (User) {
    await User.findOneAndUpdate(
      { deviceId },
      { subscription: { status: "active", expiresAt, paymentId } },
      { upsert: true }
    );
  } else {
    const u = await getUser(deviceId);
    u.subscription = { status: "active", expiresAt, paymentId };
  }
  console.log(`✅ Подписка активирована для ${deviceId} до ${expiresAt}`);
}

// ===== ЮKassa API =====
async function createYookassaPayment(amount, email, description, metadata) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const idempotenceKey = crypto.randomUUID();
  const frontendUrl = process.env.FRONTEND_URL || "https://dreameeer-app.vercel.app";

  const body = {
    amount: { value: amount, currency: "RUB" },
    confirmation: {
      type: "redirect",
      return_url: `${frontendUrl}?payment=success`,
    },
    capture: true,
    description,
    metadata,
  };

  // Чек обязателен для ЮKassa при наличии email
  if (email) {
    body.receipt = {
      customer: { email },
      items: [{
        description: "Подписка Dreameeer на 30 дней",
        quantity: "1.00",
        amount: { value: amount, currency: "RUB" },
        vat_code: 1,
        payment_mode: "full_payment",
        payment_subject: "service",
      }],
    };
  }

  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify(body),
  });

  return response.json();
}

// ===== ENDPOINTS =====

// POST /api/user/init — инициализация / получение статуса пользователя
app.post("/api/user/init", async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId required" });

    const user = await getUser(deviceId);

    res.json({
      dreamCount: user.dreamCount,
      freeLimit: FREE_DREAMS_LIMIT,
      subscription: {
        status: user.subscription.status,
        expiresAt: user.subscription.expiresAt,
      },
    });
  } catch (err) {
    console.error("❌ /api/user/init:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/create — создать платёж ЮKassa
app.post("/api/payment/create", async (req, res) => {
  try {
    const { deviceId, email } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId required" });

    if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
      return res.status(503).json({ error: "Payment system not configured. Add YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY to env." });
    }

    const payment = await createYookassaPayment(
      "499.00",
      email || null,
      "Подписка Dreameeer на 30 дней",
      { deviceId }
    );

    console.log("💳 ЮKassa payment created:", payment.id, payment.status);

    if (payment.confirmation?.confirmation_url) {
      res.json({
        success: true,
        paymentId: payment.id,
        redirectUrl: payment.confirmation.confirmation_url,
      });
    } else {
      console.error("⚠️ ЮKassa ответ:", JSON.stringify(payment));
      res.status(500).json({ error: "Ошибка создания платежа", details: payment });
    }
  } catch (err) {
    console.error("❌ /api/payment/create:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhook/yookassa — вебхук подтверждения оплаты
app.post("/api/webhook/yookassa", async (req, res) => {
  try {
    const event = req.body;
    console.log("💳 ЮKassa webhook:", event.event, event.object?.id);

    if (event.event === "payment.succeeded") {
      const deviceId = event.object?.metadata?.deviceId;
      if (deviceId) {
        await activateSubscription(deviceId, event.object.id);
      } else {
        console.warn("⚠️ Webhook без deviceId в metadata");
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Хранилище задач видео =====
const videoTasks = new Map();

// POST /api/dream/analyze — анализ сна + проверка подписки
app.post("/api/dream/analyze", async (req, res) => {
  try {
    const { dreamText, theme = "dark", mode = "default", language = "ru", deviceId } = req.body;

    if (!dreamText || dreamText.trim().length < 10) {
      return res.status(400).json({ error: "Текст сна слишком короткий. Минимум 10 символов." });
    }

    // ===== Проверка лимита =====
    if (deviceId) {
      const user = await getUser(deviceId);
      const isSubscribed = user.subscription.status === "active";
      const overLimit = user.dreamCount >= FREE_DREAMS_LIMIT;

      if (!isSubscribed && overLimit) {
        return res.status(402).json({
          error: "subscription_required",
          message: "Бесплатный лимит исчерпан. Оформите подписку для продолжения.",
          dreamCount: user.dreamCount,
          freeLimit: FREE_DREAMS_LIMIT,
        });
      }
    }

    console.log(`🌙 Новый сон [theme:${theme}, mode:${mode}, lang:${language}]:`, dreamText.slice(0, 50));

    // 1. Анализ
    const analysis = await analyzeDream(dreamText, mode, language);
    console.log("✅ Анализ завершён");

    // 2. DALL-E + Видео параллельно
    let imageUrl = null;
    let taskId = null;

    if (analysis.videoPrompt) {
      const mood = analysis.mood || "";
      console.log(`🎭 Настроение сна: ${mood}`);
      const [imageResult, videoResult] = await Promise.allSettled([
        generateImage(analysis.videoPrompt, theme, mood),
        createVideoTask(analysis.videoPrompt, theme, mood),
      ]);

      if (imageResult.status === "fulfilled") {
        imageUrl = imageResult.value;
        console.log("🎨 Изображение готово");
      } else {
        console.error("⚠️ Ошибка DALL-E:", imageResult.reason?.message);
      }

      if (videoResult.status === "fulfilled") {
        taskId = videoResult.value.data?.task_id || null;
        console.log("🎬 Видео запущено:", taskId);
      } else {
        console.error("⚠️ Ошибка Replicate:", videoResult.reason?.message);
      }
    }

    // 3. Увеличиваем счётчик снов
    if (deviceId) {
      await incrementDreamCount(deviceId);
    }

    // 4. Возвращаем результат
    res.json({
      success: true,
      analysis,
      imageUrl,
      videoTaskId: taskId,
      message: "Анализ готов!",
    });
  } catch (err) {
    console.error("❌ Ошибка анализа:", err);
    res.status(500).json({ error: "Ошибка при анализе сна", details: err.message });
  }
});

// GET /api/dream/video/:taskId — статус генерации видео
app.get("/api/dream/video/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await checkVideoStatus(taskId);
    const status = result.data?.task_status;

    if (status === "succeed") {
      const videoUrl = result.data?.task_result?.videos?.[0]?.url;
      videoTasks.set(taskId, { status: "completed", videoUrl });
      res.json({ success: true, status: "completed", videoUrl, duration: result.data?.task_result?.videos?.[0]?.duration });
    } else if (status === "failed") {
      videoTasks.set(taskId, { status: "failed" });
      res.json({ success: false, status: "failed", message: result.data?.task_status_msg || "Генерация не удалась" });
    } else {
      res.json({ success: true, status: "processing", message: "Видео ещё генерируется, подождите 1-3 минуты..." });
    }
  } catch (err) {
    console.error("❌ Ошибка проверки видео:", err);
    res.status(500).json({ error: "Ошибка при проверке статуса видео", details: err.message });
  }
});

// POST /api/dream/full — полный синхронный пайплайн (для тестов)
app.post("/api/dream/full", async (req, res) => {
  try {
    const { dreamText } = req.body;
    if (!dreamText || dreamText.trim().length < 10) {
      return res.status(400).json({ error: "Текст сна слишком короткий." });
    }

    console.log("🌙 Полный пайплайн для:", dreamText);
    const analysis = await analyzeDream(dreamText);
    console.log("✅ Анализ готов");

    let videoUrl = null;
    if (analysis.videoPrompt) {
      const videoResult = await createVideoTask(analysis.videoPrompt);
      const taskId = videoResult.data?.task_id;
      if (taskId) {
        console.log("🎬 Ожидание видео...");
        const maxAttempts = 30;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((r) => setTimeout(r, 10000));
          const status = await checkVideoStatus(taskId);
          if (status.data?.task_status === "succeed") {
            videoUrl = status.data?.task_result?.videos?.[0]?.url;
            console.log("✅ Видео готово!");
            break;
          } else if (status.data?.task_status === "failed") {
            console.log("❌ Генерация видео провалилась");
            break;
          }
          console.log(`⏳ Попытка ${i + 1}/${maxAttempts}...`);
        }
      }
    }

    res.json({ success: true, analysis, videoUrl });
  } catch (err) {
    console.error("❌ Ошибка:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /health
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), mongodb: !!User });
});

// ===== ЗАПУСК =====
app.listen(PORT, () => {
  console.log(`
  🌙 Dreameeer Backend запущен!
  📡 Порт: ${PORT}

  Endpoints:
    POST /api/user/init          — статус пользователя
    POST /api/payment/create     — создать платёж ЮKassa
    POST /api/webhook/yookassa   — вебхук оплаты
    POST /api/dream/analyze      — анализ сна
    GET  /api/dream/video/:id    — статус видео
    GET  /health                 — проверка сервера
  `);
});

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { analyzeDream, generateImage, createVideoTask, checkVideoStatus } = require("./video-service");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FREE_DREAMS_LIMIT = 1;

// ===== MongoDB (опционально) =====
let User = null;
let Dream = null;

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
    videoQuota: {
      count: { type: Number, default: 0 },       // видео сгенерировано в этом месяце
      resetAt: { type: Date, default: null },     // когда сбросить счётчик
    },
    createdAt: { type: Date, default: Date.now },
  });

  const dreamSchema = new mongoose.Schema({
    deviceId: { type: String, index: true },
    dreamText: { type: String },
    analysis: { type: Object },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    videoTaskId: { type: String, default: null },
    theme: { type: String, default: "dark" },
    language: { type: String, default: "ru" },
    cost: {
      analysis: { type: Number, default: 0.08 },  // GPT approx
      image: { type: Number, default: 0.04 },       // DALL-E 3
      video: { type: Number, default: 0.18 },       // MiniMax
    },
    createdAt: { type: Date, default: Date.now },
  });

  User = mongoose.models.User || mongoose.model("User", userSchema);
  Dream = mongoose.models.Dream || mongoose.model("Dream", dreamSchema);
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
  const frontendUrl = process.env.FRONTEND_URL || "https://dreameeer.ru";

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

// POST /api/payment/check — проверить статус платежа напрямую в ЮKassa и активировать если succeeded
app.post("/api/payment/check", async (req, res) => {
  try {
    const { deviceId, paymentId } = req.body;
    if (!deviceId || !paymentId) return res.status(400).json({ error: "deviceId and paymentId required" });

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) return res.status(503).json({ error: "Payment system not configured" });

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
      },
    });
    const payment = await response.json();
    console.log("🔍 Payment check:", paymentId, payment.status);

    if (payment.status === "succeeded") {
      await activateSubscription(deviceId, paymentId);
      return res.json({ activated: true });
    }

    res.json({ activated: false, status: payment.status });
  } catch (err) {
    console.error("❌ /api/payment/check:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscription/restore — найти оплаченный платёж по deviceId и активировать подписку
app.post("/api/subscription/restore", async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId required" });

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) return res.status(503).json({ error: "Payment system not configured" });

    const authHeader = "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    // Получаем последние платежи из ЮKassa (без фильтра по статусу — берём все и фильтруем сами)
    const url = new URL("https://api.yookassa.ru/v3/payments");
    url.searchParams.set("limit", "100");

    const response = await fetch(url.toString(), {
      headers: { Authorization: authHeader },
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("❌ ЮKassa вернула не JSON:", rawText.slice(0, 300));
      return res.status(502).json({ error: "Неверный ответ от ЮKassa", raw: rawText.slice(0, 200) });
    }

    console.log("🔍 Restore: статус ответа:", response.status, "платежей:", data.items?.length ?? 0);

    if (!data.items) {
      console.error("❌ ЮKassa ошибка:", JSON.stringify(data));
      return res.status(502).json({ error: data.description || "Ошибка ЮKassa", details: data });
    }

    // Ищем succeeded платёж с совпадающим deviceId в metadata
    const payment = data.items.find(
      p => p.status === "succeeded" && p.metadata?.deviceId === deviceId
    );

    if (payment) {
      await activateSubscription(deviceId, payment.id);
      console.log("✅ Подписка восстановлена для", deviceId, "платёж", payment.id);
      return res.json({ activated: true, paymentId: payment.id });
    }

    console.log("ℹ️ Платёж не найден для deviceId:", deviceId,
      "| Все metadata:", data.items.map(p => ({ id: p.id, status: p.status, meta: p.metadata })));
    res.json({ activated: false, message: "Оплаченный платёж не найден" });
  } catch (err) {
    console.error("❌ /api/subscription/restore:", err);
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

    // 2. Только DALL-E (видео — по запросу пользователя)
    let imageUrl = null;
    const taskId = null;

    if (analysis.videoPrompt) {
      const mood = analysis.mood || "";
      console.log(`🎭 Настроение сна: ${mood}`);
      try {
        imageUrl = await generateImage(analysis.videoPrompt, theme, mood);
        console.log("🎨 Изображение готово");
      } catch (e) {
        console.error("⚠️ Ошибка DALL-E:", e?.message);
      }
    }

    // 3. Сохраняем сон в БД + увеличиваем счётчик
    if (deviceId) {
      await incrementDreamCount(deviceId);
      if (Dream) {
        Dream.create({
          deviceId,
          dreamText: dreamText,
          analysis,
          imageUrl,
          videoTaskId: taskId,
          theme,
          language,
          cost: {
            analysis: 0.08,
            image: imageUrl ? 0.04 : 0,
            video: taskId ? 0.18 : 0,
          },
        }).catch(e => console.error("⚠️ Ошибка сохранения сна:", e.message));
      }
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

const VIDEO_MONTHLY_LIMIT = 10;

// POST /api/dream/video/create — запуск генерации видео по запросу
app.post("/api/dream/video/create", async (req, res) => {
  try {
    const { videoPrompt, theme = "dark", mood = "", deviceId } = req.body;
    if (!videoPrompt) return res.status(400).json({ error: "videoPrompt required" });

    // Проверяем подписку и месячный лимит видео
    if (deviceId) {
      const user = await getUser(deviceId);
      const isSubscribed = user.subscription.status === "active";
      if (!isSubscribed) {
        return res.status(402).json({ error: "subscription_required" });
      }

      // Проверяем месячный лимит
      const now = new Date();
      const quota = user.videoQuota || { count: 0, resetAt: null };
      const needsReset = !quota.resetAt || new Date(quota.resetAt) <= now;

      if (needsReset) {
        // Новый месяц — сброс счётчика
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        if (User) {
          await User.findOneAndUpdate(
            { deviceId },
            { "videoQuota.count": 0, "videoQuota.resetAt": nextMonth }
          );
        } else {
          user.videoQuota = { count: 0, resetAt: nextMonth };
        }
        quota.count = 0;
      }

      if (quota.count >= VIDEO_MONTHLY_LIMIT) {
        return res.status(429).json({
          error: "video_limit_reached",
          message: `Лимит видео на этот месяц исчерпан (${VIDEO_MONTHLY_LIMIT}/месяц). Обновится 1-го числа.`,
          limit: VIDEO_MONTHLY_LIMIT,
          used: quota.count,
        });
      }

      // Увеличиваем счётчик
      if (User) {
        await User.findOneAndUpdate({ deviceId }, { $inc: { "videoQuota.count": 1 } });
      } else {
        user.videoQuota.count = (user.videoQuota.count || 0) + 1;
      }
    }

    const result = await createVideoTask(videoPrompt, theme, mood);
    const taskId = result.data?.task_id || null;
    if (!taskId) return res.status(500).json({ error: "Не удалось запустить генерацию видео" });

    console.log("🎬 Видео запущено по запросу:", taskId);
    res.json({ success: true, taskId });
  } catch (err) {
    console.error("❌ /api/dream/video/create:", err);
    res.status(500).json({ error: err.message });
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

// ===== ADMIN ENDPOINTS =====
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  const expected = process.env.ADMIN_TOKEN || "dreameeer-admin-2024";
  if (token !== expected) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// GET /api/admin/stats — сводная статистика
app.get("/api/admin/stats", adminAuth, async (req, res) => {
  try {
    if (!User) return res.json({ error: "MongoDB not connected" });

    const [totalUsers, subscribers, totalDreams, recentDreams] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ "subscription.status": "active" }),
      Dream ? Dream.countDocuments() : Promise.resolve(0),
      Dream ? Dream.find().sort({ createdAt: -1 }).limit(5).lean() : Promise.resolve([]),
    ]);

    // Считаем расходы
    const costAgg = Dream ? await Dream.aggregate([
      { $group: {
        _id: null,
        totalAnalysis: { $sum: "$cost.analysis" },
        totalImage: { $sum: "$cost.image" },
        totalVideo: { $sum: "$cost.video" },
      }}
    ]) : [];

    const costs = costAgg[0] || { totalAnalysis: 0, totalImage: 0, totalVideo: 0 };
    const totalCost = costs.totalAnalysis + costs.totalImage + costs.totalVideo;
    const revenue = subscribers * 499;
    const costPerUser = totalUsers > 0 ? (totalCost / totalUsers).toFixed(2) : 0;

    res.json({
      users: { total: totalUsers, subscribers, free: totalUsers - subscribers },
      dreams: { total: totalDreams },
      finance: {
        revenue_rub: revenue,
        total_cost_usd: totalCost.toFixed(2),
        cost_per_user_usd: costPerUser,
        breakdown: {
          analysis_usd: costs.totalAnalysis.toFixed(2),
          images_usd: costs.totalImage.toFixed(2),
          videos_usd: costs.totalVideo.toFixed(2),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/dreams — список снов с визуализациями
app.get("/api/admin/dreams", adminAuth, async (req, res) => {
  try {
    if (!Dream) return res.json({ dreams: [] });
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const dreams = await Dream.find()
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit)
      .lean();
    const total = await Dream.countDocuments();
    res.json({ dreams, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — список пользователей
app.get("/api/admin/users", adminAuth, async (req, res) => {
  try {
    if (!User) return res.json({ users: [] });
    const users = await User.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ users });
  } catch (err) {
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

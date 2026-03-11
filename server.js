require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { analyzeDream, generateImage, createVideoTask, checkVideoStatus } = require("./video-service");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== Хранилище задач видео (в продакшне — Redis/DB) =====
const videoTasks = new Map();

// ===== ENDPOINTS =====

// POST /api/dream/analyze — анализ сна + запуск генерации видео
app.post("/api/dream/analyze", async (req, res) => {
  try {
    const { dreamText, theme = 'dark', mode = 'default', language = 'ru' } = req.body;

    if (!dreamText || dreamText.trim().length < 10) {
      return res.status(400).json({
        error: "Текст сна слишком короткий. Минимум 10 символов.",
      });
    }

    console.log(`🌙 Новый сон [theme:${theme}, mode:${mode}, lang:${language}]:`, dreamText);

    // 1. Анализ сна через OpenAI
    const analysis = await analyzeDream(dreamText, mode, language);
    console.log("✅ Анализ завершён");

    // 2. Изображение (DALL-E) + видео (MiniMax) параллельно из одного промта
    let imageUrl = null;
    let taskId = null;

    if (analysis.videoPrompt) {
      const mood = analysis.mood || '';
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

    // 3. Возвращаем всё сразу
    res.json({
      success: true,
      analysis,
      imageUrl,
      videoTaskId: taskId,
      message: "Анализ готов!",
    });
  } catch (err) {
    console.error("❌ Ошибка анализа:", err);
    res.status(500).json({
      error: "Ошибка при анализе сна",
      details: err.message,
    });
  }
});

// GET /api/dream/video/:taskId — проверка статуса видео
app.get("/api/dream/video/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    const result = await checkVideoStatus(taskId);
    const status = result.data?.task_status;

    if (status === "succeed") {
      const videoUrl = result.data?.task_result?.videos?.[0]?.url;
      videoTasks.set(taskId, { status: "completed", videoUrl });

      res.json({
        success: true,
        status: "completed",
        videoUrl,
        duration: result.data?.task_result?.videos?.[0]?.duration,
      });
    } else if (status === "failed") {
      videoTasks.set(taskId, { status: "failed" });

      res.json({
        success: false,
        status: "failed",
        message: result.data?.task_status_msg || "Генерация не удалась",
      });
    } else {
      res.json({
        success: true,
        status: "processing",
        message: "Видео ещё генерируется, подождите 1-3 минуты...",
      });
    }
  } catch (err) {
    console.error("❌ Ошибка проверки видео:", err);
    res.status(500).json({
      error: "Ошибка при проверке статуса видео",
      details: err.message,
    });
  }
});

// POST /api/dream/full — полный синхронный пайплайн (для тестов)
app.post("/api/dream/full", async (req, res) => {
  try {
    const { dreamText } = req.body;

    if (!dreamText || dreamText.trim().length < 10) {
      return res.status(400).json({
        error: "Текст сна слишком короткий.",
      });
    }

    console.log("🌙 Полный пайплайн для:", dreamText);

    // 1. Анализ
    const analysis = await analyzeDream(dreamText);
    console.log("✅ Анализ готов");

    // 2. Генерация видео с ожиданием
    let videoUrl = null;
    if (analysis.videoPrompt) {
      const videoResult = await createVideoTask(analysis.videoPrompt);
      const taskId = videoResult.data?.task_id;

      if (taskId) {
        console.log("🎬 Ожидание видео...");
        // Поллинг каждые 10 секунд, макс 5 минут
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

    res.json({
      success: true,
      analysis,
      videoUrl,
    });
  } catch (err) {
    console.error("❌ Ошибка:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /health — проверка здоровья
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===== ЗАПУСК =====
app.listen(PORT, () => {
  console.log(`
  🌙 Dreameeer Backend запущен!
  📡 Порт: ${PORT}
  🔗 http://localhost:${PORT}

  Endpoints:
    POST /api/dream/analyze   — анализ сна + запуск видео
    GET  /api/dream/video/:id — статус генерации видео
    POST /api/dream/full      — полный пайплайн (синхронный)
    GET  /health              — проверка сервера
  `);
});

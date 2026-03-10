require("dotenv").config();
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");

// ===== КОНФИГУРАЦИЯ =====
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY || "ваш_access_key";
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY || "ваш_secret_key";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-ваш_ключ_openai";
const KLING_BASE_URL = "https://api.klingai.com";

// ===== JWT ГЕНЕРАЦИЯ ДЛЯ KLING =====
function generateKlingToken() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: KLING_ACCESS_KEY,
      exp: now + 1800,
      nbf: now - 5,
    },
    KLING_SECRET_KEY,
    { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } }
  );
}

// ===== KLING API: СОЗДАНИЕ ВИДЕО =====
async function createVideoTask(videoPrompt) {
  const token = generateKlingToken();

  const response = await fetch(`${KLING_BASE_URL}/v1/videos/text2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model_name: "kling-v1",
      prompt: videoPrompt,
      negative_prompt:
        "blur, low quality, text, watermark, logo, static, boring, realistic photo",
      cfg_scale: 0.5,
      mode: "std",
      aspect_ratio: "9:16",
      duration: "5",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kling API ошибка: ${response.status} — ${error}`);
  }

  return response.json();
}

// ===== KLING API: ПРОВЕРКА СТАТУСА =====
async function checkVideoStatus(taskId) {
  const token = generateKlingToken();

  const response = await fetch(
    `${KLING_BASE_URL}/v1/videos/text2video/${taskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Kling API ошибка статуса: ${response.status} — ${error}`
    );
  }

  return response.json();
}

// ===== OPENAI: АНАЛИЗ СНА =====
async function analyzeDream(dreamText) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const systemPrompt = `Ты — Dreameeer, мистический ИИ-толкователь снов. Ты сочетаешь мудрость классических сонников (Миллер, Фрейд, Юнг, Ванга) с современной психологией.

ТВОЯ ЗАДАЧА:
1. Получить описание сна
2. Выделить ключевые символы (3-7 штук)
3. Дать глубокую интерпретацию каждого символа
4. Составить общее толкование
5. Дать практическую рекомендацию
6. Создать промт для генерации видео-визуализации сна

СТИЛЬ: мистический, тёплый, мудрый. Не пугай пользователя, даже если символы тревожные. Всегда находи позитивный или трансформирующий аспект.

ОБЯЗАТЕЛЬНО верни JSON строго в таком формате:
{
  "dreamTitle": "Краткое поэтичное название сна (3-5 слов)",
  "mood": "одно из: загадочный | мечтательный | тревожный | трансформирующий | вдохновляющий",
  "symbols": [
    {
      "name": "название символа",
      "emoji": "подходящий эмодзи",
      "meaning": "толкование символа (2-3 предложения)"
    }
  ],
  "interpretation": "Общее толкование сна (3-5 предложений). Связь символов между собой, что сон говорит о внутреннем состоянии.",
  "recommendation": "Практический совет на основе сна (1-2 предложения)",
  "videoPrompt": "Cinematic surreal dreamscape in Salvador Dali style. [описание сцены на английском, 2-3 предложения]. Melting clocks, impossible architecture, ethereal lighting. Smooth camera movement through the scene. Hyper-detailed, 4K, atmospheric fog, volumetric light rays, color palette: deep purples, midnight blues, golden accents.",
  "lucidityScore": число от 1 до 10,
  "emotionalTone": "основная эмоция сна"
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.8,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Мой сон: ${dreamText}` },
    ],
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ===== ПОЛНЫЙ ПАЙПЛАЙН =====
async function dreamPipeline(dreamText) {
  console.log("🌙 Запуск пайплайна Dreameeer...");

  // Шаг 1: Анализ
  console.log("🧠 Анализирую сон...");
  const analysis = await analyzeDream(dreamText);
  console.log(`✅ Анализ: "${analysis.dreamTitle}"`);

  // Шаг 2: Генерация видео
  console.log("🎬 Запускаю генерацию видео...");
  const videoResult = await createVideoTask(analysis.videoPrompt);
  const taskId = videoResult.data?.task_id;
  console.log(`📋 Task ID: ${taskId}`);

  // Шаг 3: Ожидание результата
  console.log("⏳ Жду генерацию видео (1-3 минуты)...");
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const status = await checkVideoStatus(taskId);

    if (status.data?.task_status === "succeed") {
      const videoUrl = status.data.task_result.videos[0].url;
      console.log(`✅ Видео готово: ${videoUrl}`);
      return { analysis, videoUrl };
    }

    if (status.data?.task_status === "failed") {
      throw new Error("Генерация видео провалилась: " + status.data?.task_status_msg);
    }

    console.log(`   ⏳ Попытка ${i + 1}/${maxAttempts}...`);
  }

  throw new Error("Таймаут генерации видео (5 минут)");
}

module.exports = {
  analyzeDream,
  createVideoTask,
  checkVideoStatus,
  dreamPipeline,
  generateKlingToken,
};

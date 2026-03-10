require("dotenv").config();
const OpenAI = require("openai");

// ===== КОНФИГУРАЦИЯ =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || "";

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
6. Создать промт для визуализации сна

СТИЛЬ: мистический, тёплый, мудрый. Не пугай пользователя, даже если символы тревожные.

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
  "interpretation": "Общее толкование сна (3-5 предложений).",
  "recommendation": "Практический совет на основе сна (1-2 предложения)",
  "videoPrompt": "ВАЖНО: промпт должен быть безопасным для DALL-E — только абстрактные символы, пейзажи, предметы и существа. БЕЗ людей, БЕЗ детей, БЕЗ лиц, БЕЗ насилия, БЕЗ реальных мест. Пример: 'A surreal floating palace above violet clouds, golden carriage pulled by ethereal horses made of light, mystical garden with glowing flowers, dreamlike atmosphere.' Опиши сцену через символы и образы на английском (2-3 предложения).",
  "lucidityScore": число от 1 до 10,
  "emotionalTone": "основная эмоция сна"
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-5.2",
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

// ===== САНИТИЗАЦИЯ ПРОМПТА =====
function sanitizePrompt(prompt) {
  // Заменяем упоминания людей и чувствительного контента на абстрактные образы
  const replacements = [
    [/\b(child|children|kid|kids|baby|infant|boy|girl|toddler)\b/gi, "small glowing spirit"],
    [/\b(man|men|woman|women|person|people|human|face|faces)\b/gi, "ethereal silhouette"],
    [/\b(mother|father|parent|parents|family|grandma|grandpa)\b/gi, "ancient spirit guardian"],
    [/\b(kindergarten|school|hospital|prison|church)\b/gi, "mystical palace"],
    [/\b(blood|weapon|gun|knife|sword|death|dead|kill|war)\b/gi, "crimson mist"],
    [/\b(nude|naked|sexual|intimate)\b/gi, "flowing ethereal form"],
  ];

  let safe = prompt;
  for (const [pattern, replacement] of replacements) {
    safe = safe.replace(pattern, replacement);
  }
  return safe;
}

// ===== DALL-E 3: ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ =====
async function generateImage(prompt) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log("🎨 Генерирую изображение через DALL-E 3...");

  const cleaned = sanitizePrompt(prompt);
  // Безопасная обёртка для промпта — абстрактный сюрреализм без конкретных людей
  const safePrompt = `Abstract surreal dream artwork, symbolic and ethereal, no real people, no children, no faces. Dreamlike atmosphere with symbolic imagery: ${cleaned}. Style: Salvador Dali surrealism, painterly, mystical, deep purples and midnight blues with golden light, safe for all audiences.`;

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: safePrompt,
    size: "1024x1024",
    quality: "standard",
    n: 1,
  });

  const url = response.data[0].url;
  console.log("✅ Изображение готово!");
  return url;
}

// ===== REPLICATE: ЗАПУСК ВИДЕО (MiniMax Video-01 — text-to-video) =====
async function createVideoTask(videoPrompt) {
  console.log("🎬 Генерирую видео через MiniMax Video-01...");

  const response = await fetch(
    "https://api.replicate.com/v1/models/minimax/video-01/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: videoPrompt,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate ошибка: ${response.status} — ${error}`);
  }

  const result = await response.json();
  console.log("📋 Prediction ID:", result.id);

  return { data: { task_id: result.id } };
}

// ===== REPLICATE: СТАТУС ВИДЕО =====
async function checkVideoStatus(taskId) {
  const response = await fetch(
    `https://api.replicate.com/v1/predictions/${taskId}`,
    {
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate статус ошибка: ${response.status} — ${error}`);
  }

  const result = await response.json();
  console.log("📊 Статус:", result.status);

  if (result.status === "succeeded") {
    const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    return {
      data: {
        task_status: "succeed",
        task_result: { videos: [{ url: videoUrl }] },
      },
    };
  }

  if (result.status === "failed" || result.status === "canceled") {
    return {
      data: {
        task_status: "failed",
        task_status_msg: result.error || "Генерация не удалась",
      },
    };
  }

  return { data: { task_status: "processing" } };
}

module.exports = { analyzeDream, generateImage, createVideoTask, checkVideoStatus };

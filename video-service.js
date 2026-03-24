require("dotenv").config();
const OpenAI = require("openai");
const cloudinary = require("cloudinary").v2;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || "";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function uploadToCloudinary(tempUrl) {
  try {
    const result = await cloudinary.uploader.upload(tempUrl, {
      folder: "dreameeer",
      resource_type: "image",
    });
    console.log("☁️ Cloudinary OK:", result.secure_url.slice(0, 60));
    return result.secure_url;
  } catch (err) {
    console.warn("⚠️ Cloudinary upload failed, using temp URL:", err.message);
    return tempUrl; // fallback — лучше временный URL, чем ничего
  }
}

// ===== OPENAI: АНАЛИЗ СНА =====
async function analyzeDream(dreamText, mode = 'default', language = 'ru') {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const modeInstructions = {
    default: 'Ты сочетаешь мудрость классических сонников (Миллер, Фрейд, Юнг, Ванга) с современной психологией.',
    all: `Ты толкуешь сон одновременно через призму ВСЕХ великих сонников — дай развёрнутое многогранное толкование:
• По Миллеру: что этот сон предвещает в жизни, практические символы удачи/неудачи
• По Фрейду: подавленные желания, вытесненные эмоции, символы подсознания
• По Юнгу: архетипы, коллективное бессознательное, тени и анима
• По Лоффу: личностный рост, эмоциональная переработка, самопознание
Каждый взгляд должен дополнять другие, создавая полную картину смысла сна.`,
    miller: 'Ты толкуешь сны строго по соннику Миллера — фокусируешься на жизненных событиях, практических предсказаниях, символах удачи, успеха и неудачи.',
    freud: 'Ты толкуешь сны по методу Зигмунда Фрейда — ищешь подавленные желания, символы либидо, эго/ид/суперэго, вытесненные эмоции и детские комплексы.',
    loff: 'Ты толкуешь сны по методу Дэвида Лоффа — фокусируешься на личностном росте, эмоциональной переработке опыта и архетипических символах самопознания.',
  };

  const langInstruction = language === 'en'
    ? 'Respond in English. All fields must be in English.'
    : 'Отвечай на русском языке.';

  // Схема interpretation зависит от mode
  const interpretationSchema = mode === 'all'
    ? `  "interpretation": "Краткое общее резюме всех толкований (1 предложение)",
  "interpretations": [
    {"source": "По Миллеру", "text": "2-3 предложения по соннику Миллера"},
    {"source": "По Фрейду", "text": "2-3 предложения по методу Фрейда"},
    {"source": "По Юнгу", "text": "2-3 предложения по методу Юнга"},
    {"source": "По Лоффу", "text": "2-3 предложения по методу Лоффа"}
  ],`
    : mode === 'miller'
    ? `  "interpretation": "Толкование по Миллеру (3-5 предложений)",
  "interpretSource": "По Миллеру",`
    : mode === 'freud'
    ? `  "interpretation": "Толкование по Фрейду (3-5 предложений)",
  "interpretSource": "По Фрейду",`
    : mode === 'loff'
    ? `  "interpretation": "Толкование по Лоффу (3-5 предложений)",
  "interpretSource": "По Лоффу",`
    : `  "interpretation": "Общее толкование сна (3-5 предложений). Живое, образное, соответствующее настроению сна.",
  "interpretSource": "Dreameeer",`;

  const systemPrompt = `Ты — Dreameeer, мистический ИИ-толкователь снов. ${modeInstructions[mode] || modeInstructions.default}
${langInstruction}

ТВОЯ ЗАДАЧА:
1. Глубоко прочитать сон, выделить реальные объекты, существа и места из описания
2. Выделить ключевые символы (3-7 штук) — ТОЛЬКО из того, что реально упомянуто в сне
3. Дать эмоционально насыщенную интерпретацию каждого символа
4. Составить общее толкование — живое, образное, чувствительное к настроению сна
5. Дать рекомендацию, соответствующую тону сна (мрачную для тревожных снов, светлую для позитивных)
6. Создать промт для визуализации — с РЕАЛЬНЫМИ объектами из сна

СТИЛЬ: глубокий, поэтичный, эмоционально точный. Если сон тревожный — признай это, не сглаживай. Если светлый — будь лучезарен.
ВАЖНО: Обращайся к человеку нейтрально — без указания пола. Не используй «он», «она», «девушка», «парень» применительно к сновидцу. Используй нейтральные формы: «ты», «тебе», «сновидец».

ОБЯЗАТЕЛЬНО верни JSON строго в таком формате:
{
  "dreamTitle": "Краткое поэтичное название сна (3-5 слов)",
  "mood": "одно из: загадочный | мечтательный | тревожный | трансформирующий | вдохновляющий",
  "symbols": [
    {
      "name": "название символа (реальный объект из сна)",
      "emoji": "подходящий эмодзи",
      "meaning": "толкование символа (2-3 предложения, эмоционально точные)"
    }
  ],
${interpretationSchema}
  "recommendation": "Практический совет, тонально совпадающий со сном (1-2 предложения)",
  "videoPrompt": "КРИТИЧНО: включи КОНКРЕТНЫЕ объекты из сна (предметы, существа, места). БЕЗ людей, БЕЗ лиц, БЕЗ насилия — заменяй призрачными силуэтами. Опиши сцену на английском (2-3 предложения).",
  "lucidityScore": число от 1 до 10,
  "emotionalTone": "основная эмоция сна одним словом"
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-5.2",
    temperature: 0.85,
    max_completion_tokens: 2000,
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
  const replacements = [
    [/\b(child|children|kid|kids|baby|infant|boy|girl|toddler)\b/gi, "small glowing spirit orb"],
    [/\b(man|men|woman|women|person|people|human|face|faces|figure)\b/gi, "ethereal translucent silhouette"],
    [/\b(mother|father|parent|parents|family|grandma|grandpa)\b/gi, "ancient guardian spirit"],
    [/\b(kindergarten|school|hospital|prison|church)\b/gi, "mystical glowing palace"],
    [/\b(blood)\b/gi, "crimson liquid crystal"],
    [/\b(weapon|gun|knife|sword)\b/gi, "jagged obsidian shard"],
    [/\b(death|dead|kill|murder)\b/gi, "dark withering energy"],
    [/\b(war|battle|fight)\b/gi, "clashing storm forces"],
    [/\b(nude|naked|sexual|intimate)\b/gi, "flowing ethereal mist form"],
  ];

  let safe = prompt;
  for (const [pattern, replacement] of replacements) {
    safe = safe.replace(pattern, replacement);
  }
  return safe;
}

// ===== СТИЛИ ПО НАСТРОЕНИЮ (DARK THEME) =====
// Object-focus style: main dream object sharp + vivid in foreground, background atmospheric and slightly defocused
const moodImageStyles = {
  'тревожный': 'CINEMATIC DEPTH-OF-FIELD: the main dream object is sharp, large, vivid and dominant in the foreground with dramatic rim lighting. Background: churning storm clouds in deep charcoal and bruised violet, slightly defocused and atmospheric. The dream subject stands out bold and clear against the dark moody backdrop. Haunting surrealist art, deep contrast.',
  'anxious':   'CINEMATIC DEPTH-OF-FIELD: main dream object sharp and vivid in foreground, dramatically lit. Background: dark storm clouds, bruised violet fog, slightly out of focus. Bold contrast between subject and atmosphere.',
  'мечтательный': 'CINEMATIC DEPTH-OF-FIELD: main dream object large, sharp and glowing in foreground, soft warm light from behind. Background: golden meadows and candy-floss clouds softly blurred. Subject is the visual star — vibrant and clear. Soft pastel bokeh surrounds it.',
  'dreamy':       'CINEMATIC DEPTH-OF-FIELD: main dream subject sharp and luminous in foreground. Background: soft golden light, blurred pastel clouds. Subject glows warmly against dreamy bokeh backdrop.',
  'вдохновляющий': 'CINEMATIC DEPTH-OF-FIELD: main dream object crisp and radiant in foreground, bathed in divine golden light. Background: aurora ribbons and crystal peaks, slightly defocused. Subject commands the frame with overwhelming presence.',
  'inspiring':     'CINEMATIC DEPTH-OF-FIELD: dream subject sharp and triumphant in foreground, glowing with divine light. Background: soft aurora and crystal mountains, gently blurred. Majestic framing.',
  'трансформирующий': 'CINEMATIC DEPTH-OF-FIELD: main dream object vivid and sharp in foreground, dramatic dual-tone lighting. Background: galaxy vortex and cosmic light, slightly blurred. Subject feels powerful and transformative against the cosmic backdrop.',
  'transformative':   'CINEMATIC DEPTH-OF-FIELD: dream subject sharp and powerful in foreground. Background: blurred cosmic vortex, light and shadow. Bold contrast.',
  'загадочный': 'CINEMATIC DEPTH-OF-FIELD: main dream object sharp and glowing with faint ethereal light in foreground. Background: moonlit ruins and silver mist, softly defocused. Subject is mysterious and clear against the atmospheric dark backdrop.',
  'mysterious': 'CINEMATIC DEPTH-OF-FIELD: dream subject sharp and lit with ethereal glow in foreground. Background: softly blurred moonlit fog and ruins. Enigmatic and clear.',
  'default': 'CINEMATIC DEPTH-OF-FIELD: main dream subject sharp, vivid and dominant in foreground. Background defocused with deep purples and midnight blues, golden atmospheric light. Subject stands bold and clear. Surrealist dream art, cinematic quality.',
};

const moodVideoStyles = {
  'тревожный': 'CINEMATIC depth-of-field video — slow push-in toward the sharp vivid main dream object in foreground, background of churning storm clouds and bruised violet atmosphere gently defocused behind it. Subject is bold, clear, dramatically lit. Slow haunting camera, deep shadow, gothic surreal mood. ',
  'anxious':   'CINEMATIC depth-of-field video — main subject sharp and prominent in foreground, dark defocused storm atmosphere behind. Slow ominous push-in, dramatic rim light on subject. ',
  'мечтательный': 'CINEMATIC depth-of-field video — slow gentle orbit around the vivid sharp main dream object, warm golden bokeh and soft pastel clouds blurred in background. Subject luminous and clear. Dreamy floating motion, warm light, serene mood. ',
  'dreamy':       'CINEMATIC depth-of-field video — sharp luminous subject in foreground, soft golden bokeh behind. Slow gentle camera drift, warm and dreamy. ',
  'вдохновляющий': 'CINEMATIC depth-of-field video — slow ascending push toward sharp radiant main subject, divine golden light halos it, background aurora and peaks softly blurred. Majestic ascending movement, overwhelmingly beautiful. ',
  'inspiring':     'CINEMATIC depth-of-field video — vivid sharp dream subject rising in foreground, defocused radiant background. Slow upward camera, epic golden light. ',
  'трансформирующий': 'CINEMATIC depth-of-field video — dramatic slow rotation around the sharp vivid dream subject, cosmic vortex and light-dark contrast softly defocused behind it. Subject feels powerful and central. Epic surreal mood. ',
  'transformative':   'CINEMATIC depth-of-field video — sharp powerful subject in foreground, cosmic blurred backdrop. Slow dramatic camera. ',
  'загадочный': 'CINEMATIC depth-of-field video — slow gliding push toward sharp glowing main dream object, moonlit ruins and silver mist defocused in background. Subject mysterious and luminous. Meditative haunting pacing. ',
  'mysterious': 'CINEMATIC depth-of-field video — sharp ethereal subject in foreground, blurred moonlit fog behind. Slow mysterious camera. ',
  'default': 'CINEMATIC depth-of-field video — slow push-in toward the sharp vivid main dream object in foreground, deep purple and midnight blue atmospheric bokeh behind. Subject bold and clear. Surreal dream mood, cinematic quality. ',
};

// ===== DALL-E 3: ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ =====
async function generateImage(prompt, theme = 'dark', mood = '') {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log(`🎨 Генерирую изображение [mood:${mood}, theme:${theme}]...`);

  const cleaned = sanitizePrompt(prompt);

  let safePrompt;

  if (theme === 'light') {
    safePrompt = `A stylized, slightly cartoonish dream illustration. Semi-cartoon, slightly surreal but clean and readable style. Soft dreamy lighting with gentle warm glow. Vibrant but controlled pastel colors — warm peach, blush rose, gentle lavender, golden honey, airy sky blue. Smooth shading, modern high-quality 3D illustration look. The main dream objects must be CENTRAL, LARGE, and visually dominant — placed prominently in the foreground, fully formed and clearly recognizable. Background supports the scene with soft bokeh and gentle atmosphere, never overpowering. Do NOT distort or merge important objects. Sharp focus on main subjects. SCENE ELEMENTS: ${cleaned}. No real people, no children, no faces. Safe for all audiences.`;
  } else {
    // Dark theme: mood-based dramatic style
    const moodStyle = moodImageStyles[mood] || moodImageStyles['default'];
    safePrompt = `${moodStyle} Cinematic dramatic lighting, rich saturated colors, sharp contrast. SCENE ELEMENTS: ${cleaned}. No real people, no children, no faces. Abstract symbolic imagery only. Safe for all audiences.`;
  }

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: safePrompt,
    size: "1024x1024",
    quality: "standard",
    n: 1,
  });

  const tempUrl = response.data[0].url;
  console.log("✅ Изображение готово, загружаю на Cloudinary...");
  return await uploadToCloudinary(tempUrl);
}

// ===== REPLICATE: ОЖИВЛЕНИЕ ИЗОБРАЖЕНИЯ (Kling image-to-video) =====
async function createVideoTask(videoPrompt, theme = 'dark', mood = '', imageUrl = null) {
  console.log(`🎬 Оживляю изображение [mood:${mood}, theme:${theme}]...`);

  if (imageUrl) {
    // SVD (Stable Video Diffusion) — $0.02/видео
    console.log("🖼 SVD image-to-video:", imageUrl.slice(0, 80));
    const input = {
      input_image: imageUrl,
      video_length: "25_frames_with_svd",
      sizing_strategy: "maintain_aspect_ratio",
      frames_per_second: 6,
      motion_bucket_id: 80,
      cond_aug: 0.02,
    };

    const response = await fetch(
      "https://api.replicate.com/v1/models/stability-ai/stable-video-diffusion/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      }
    );

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`SVD ошибка: ${response.status} — ${body}`);
    }
    const result = JSON.parse(body);
    console.log("📋 SVD Prediction:", result.id, "status:", result.status, "error:", result.error || "none");
    if (!result.id) throw new Error(`SVD не вернул ID: ${body}`);
    return { data: { task_id: result.id } };

  } else {
    // Fallback: Kling text-to-video если нет картинки
    console.log("⚠️ Нет imageUrl — Kling text-to-video fallback");
    const motionPrompt = (theme === 'light'
      ? 'Stylized cartoon dream scene, soft pastel colors, gentle dreamy float, magical atmosphere. '
      : 'Cinematic dream scene, deep purples and blues, slow epic camera, atmospheric depth. ')
      + sanitizePrompt(videoPrompt);

    const response = await fetch(
      "https://api.replicate.com/v1/models/kwaivgi/kling-v1.5-standard/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: { prompt: motionPrompt, duration: 5, aspect_ratio: "9:16", cfg_scale: 0.5 } }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kling fallback ошибка: ${response.status} — ${error}`);
    }
    const result = await response.json();
    console.log("📋 Kling Prediction:", result.id, "status:", result.status);
    if (!result.id) throw new Error(`Kling не вернул ID: ${JSON.stringify(result)}`);
    return { data: { task_id: result.id } };
  }
}

// ===== REPLICATE: СТАТУС ВИДЕО =====
async function checkVideoStatus(taskId) {
  const response = await fetch(
    `https://api.replicate.com/v1/predictions/${taskId}`,
    { headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` } }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate статус ошибка: ${response.status} — ${error}`);
  }

  const result = await response.json();
  console.log("📊 Статус:", result.status, "| output:", JSON.stringify(result.output)?.slice(0, 100), "| error:", result.error || "none");

  if (result.status === "succeeded") {
    const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    return { data: { task_status: "succeed", task_result: { videos: [{ url: videoUrl }] } } };
  }

  if (result.status === "failed" || result.status === "canceled") {
    return { data: { task_status: "failed", task_status_msg: result.error || "Генерация не удалась" } };
  }

  return { data: { task_status: "processing" } };
}

module.exports = { analyzeDream, generateImage, createVideoTask, checkVideoStatus };

require("dotenv").config();
const OpenAI = require("openai");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || "";

// ===== OPENAI: АНАЛИЗ СНА =====
async function analyzeDream(dreamText, mode = 'default', language = 'ru') {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const modeInstructions = {
    default: 'Ты сочетаешь мудрость классических сонников (Миллер, Фрейд, Юнг, Ванга) с современной психологией.',
    miller: 'Ты толкуешь сны строго по соннику Миллера — фокусируешься на жизненных событиях, практических предсказаниях, символах удачи, успеха и неудачи.',
    freud: 'Ты толкуешь сны по методу Зигмунда Фрейда — ищешь подавленные желания, символы либидо, эго/ид/суперэго, вытесненные эмоции и детские комплексы.',
    loff: 'Ты толкуешь сны по методу Дэвида Лоффа — фокусируешься на личностном росте, эмоциональной переработке опыта и архетипических символах самопознания.',
  };

  const langInstruction = language === 'en'
    ? 'Respond in English. All fields must be in English.'
    : 'Отвечай на русском языке.';

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
  "interpretation": "Общее толкование сна (3-5 предложений). Живое, образное, соответствующее настроению сна.",
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

// ===== СТИЛИ ПО НАСТРОЕНИЮ =====
const moodImageStyles = {
  'тревожный': 'DARK OMINOUS atmosphere: churning storm clouds in deep charcoal and bruised violet, jagged obsidian spires piercing suffocating fog, ominous glowing mist in crumbling ruins, eerie cold light seeping through cracks, unsettling shadows with hidden shapes, deeply haunting surrealist horror art.',
  'anxious':   'DARK OMINOUS atmosphere: churning storm clouds in deep charcoal and bruised violet, jagged obsidian spires, ominous glowing mist in crumbling ruins, eerie cold light seeping through cracks, unsettling shadows, deeply haunting surrealist horror art.',
  'мечтательный': 'SOFT LUMINOUS paradise: floating golden meadows above candy-floss clouds, shimmering waterfalls cascading into rainbow mist, warm peach and rose dawn light, delicate glowing fireflies and luminescent flowers, gentle bokeh stars everywhere, impressionist watercolor texture, joyful serene atmosphere.',
  'dreamy':       'SOFT LUMINOUS paradise: floating golden meadows above candy-floss clouds, shimmering waterfalls in rainbow mist, warm peach and rose dawn light, glowing fireflies, gentle bokeh, impressionist watercolor, joyful serene atmosphere.',
  'вдохновляющий': 'RADIANT TRANSCENDENT vision: soaring crystal mountains catching divine golden light, celestial aurora ribbons across infinite sky, triumphant beams of sacred light breaking through clouds, glowing sacred geometry patterns, overwhelming sublime beauty, epic fantasy masterpiece art.',
  'inspiring':     'RADIANT TRANSCENDENT vision: soaring crystal mountains catching divine golden light, celestial aurora ribbons, triumphant beams of sacred light, glowing sacred geometry, overwhelming sublime beauty, epic fantasy masterpiece.',
  'трансформирующий': 'COSMIC METAMORPHOSIS: swirling galaxy vortex pulling reality apart, chrysalis of pure light amid darkness, dramatic contrast of deep shadow and brilliant rebirth radiance, phoenix energy rising from obsidian water, dual realms colliding in spectacular display, powerful surrealist epic.',
  'transformative':   'COSMIC METAMORPHOSIS: swirling galaxy vortex, chrysalis of pure light, dramatic shadow and rebirth radiance, phoenix energy rising, dual realms colliding, powerful surrealist epic.',
  'загадочный': 'MYSTERIOUS MOONLIT realm: ancient fog-shrouded ruins draped in silver mist, glowing cryptic portal in a dark forest, floating runestones with faint ethereal light, deep midnight indigo and viridian atmosphere, mysterious lanterns guiding through labyrinth corridors, enigmatic and atmospheric.',
  'mysterious': 'MYSTERIOUS MOONLIT realm: ancient fog-shrouded ruins, glowing cryptic portal in dark forest, floating runestones, deep midnight indigo atmosphere, mysterious lanterns in labyrinth corridors, enigmatic and atmospheric.',
  'default': 'Surreal dream artwork in Salvador Dali style, deep purples and midnight blues with golden accents, mystical dramatic lighting, cinematic quality.',
};

const moodVideoStyles = {
  'тревожный': 'DARK HAUNTING cinematic video — slow ominous camera gliding through churning storm clouds and oppressive shadow, eerie cold mist curling around crumbling mystical ruins, distant violet lightning flashes illuminating jagged forms, unsettling atmospheric dread, deep charcoal and bruised purple palette, gothic surreal pacing. ',
  'anxious':   'DARK HAUNTING cinematic video — slow ominous camera through churning storm clouds, eerie cold mist in crumbling ruins, distant lightning flashes, unsettling atmospheric dread, deep charcoal and bruised purple palette. ',
  'мечтательный': 'SOFT LUMINOUS dreamy cinematic video — gentle floating camera drifting through golden flower meadows and pastel skies, luminous fireflies and flower petals drifting in warm dawn light, soft bokeh particles, serene impressionist mood, peaceful uplifting atmosphere, slow romantic camera movements. ',
  'dreamy':       'SOFT LUMINOUS dreamy cinematic video — gentle floating camera through golden meadows and pastel skies, luminous fireflies and petals in warm dawn light, soft bokeh, serene impressionist mood, peaceful uplifting. ',
  'вдохновляющий': 'TRIUMPHANT CELESTIAL cinematic video — sweeping camera soaring upward through radiant light pillars and aurora ribbons, crystal mountain peaks bathed in golden sunrise, ascending motion full of power and grace, overwhelming divine energy, majestic wide shots, epic inspiring mood. ',
  'inspiring':     'TRIUMPHANT CELESTIAL cinematic video — sweeping camera soaring through radiant light pillars and aurora, crystal peaks in golden sunrise, ascending motion, majestic wide shots, epic inspiring mood. ',
  'трансформирующий': 'EPIC COSMIC transformation cinematic video — slow dramatic camera witnessing galaxies spiral and reality reshape, duality of dark and brilliant light, energy vortex drawing toward blazing center, powerful emotional intensity, awe-inspiring cosmic scale, cinematic surrealism. ',
  'transformative':   'EPIC COSMIC transformation cinematic video — galaxies spiral, duality of dark and brilliant light, energy vortex toward blazing center, powerful intensity, awe-inspiring scale. ',
  'загадочный': 'ENIGMATIC FOGBOUND cinematic video — slow gliding camera through moonlit ancient ruins and crystal caves, cryptic glowing symbols pulsing faintly in shadows, deep atmospheric fog with ethereal light leaks, mysterious lanterns drifting past, haunting meditative pacing. ',
  'mysterious': 'ENIGMATIC FOGBOUND cinematic video — slow camera through moonlit ruins and crystal caves, cryptic glowing symbols, atmospheric fog with ethereal light leaks, mysterious drifting lanterns, haunting pacing. ',
  'default': 'Surreal mystical dreamscape cinematic video, slow epic camera movement, deep purples and midnight blues with golden light rays, magical atmospheric fog, cinematic quality, ethereal particles floating. ',
};

// ===== DALL-E 3: ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ =====
async function generateImage(prompt, theme = 'dark', mood = '') {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log(`🎨 Генерирую изображение [mood:${mood}, theme:${theme}]...`);

  const cleaned = sanitizePrompt(prompt);

  let safePrompt;

  if (theme === 'light') {
    // Light theme: stylized cartoon illustration with soft dawn palette
    safePrompt = `Stylized dream illustration, semi-cartoon slightly surreal clean style. Soft dawn color palette: warm peach, blush rose, gentle lavender, golden honey, airy sky blue. Smooth pastel gradients, soft diffused lighting, dreamlike warm glow. Main objects from the dream must be clearly visible, large, detailed and centered in composition — place them prominently in the foreground. Vibrant but harmonious pastel colors. Smooth shading, high detail, modern illustration style. Cinematic balanced composition, background supports subjects without overpowering. Sharp focus on main subjects. SCENE ELEMENTS: ${cleaned}. No real people, no children, no faces. Safe for all audiences.`;
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

  console.log("✅ Изображение готово!");
  return response.data[0].url;
}

// ===== REPLICATE: ЗАПУСК ВИДЕО (MiniMax Video-01) =====
async function createVideoTask(videoPrompt, theme = 'dark', mood = '') {
  console.log(`🎬 Генерирую видео [mood:${mood}, theme:${theme}]...`);

  const moodStyle = moodVideoStyles[mood] || moodVideoStyles['default'];

  const themeOverlay = theme === 'light'
    ? 'Soft pastel tones, gentle light, airy atmosphere. '
    : 'Deep rich colors, dramatic shadows, cinematic. ';

  const finalPrompt = moodStyle + themeOverlay + sanitizePrompt(videoPrompt);

  const response = await fetch(
    "https://api.replicate.com/v1/models/minimax/video-01/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: { prompt: finalPrompt } }),
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
    { headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` } }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate статус ошибка: ${response.status} — ${error}`);
  }

  const result = await response.json();
  console.log("📊 Статус:", result.status);

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

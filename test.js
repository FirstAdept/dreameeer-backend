const dreamText = "Я летел над фиолетовым океаном, в небе плавали огромные тающие часы";

// Шаг 1: Анализ + запуск видео
console.log("🌙 Отправляю сон на анализ...");

fetch("http://localhost:3000/api/dream/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dreamText }),
})
  .then((r) => r.json())
  .then(async (data) => {
    console.log("\n✅ Анализ готов:");
    console.log("  Название:", data.analysis?.dreamTitle);
    console.log("  Настроение:", data.analysis?.mood);
    console.log("  Video Task ID:", data.videoTaskId);

    if (!data.videoTaskId) {
      console.log("\n❌ Видео не запустилось — проверь ключи Kling в .env");
      return;
    }

    // Шаг 2: Поллинг статуса видео
    console.log("\n🎬 Жду генерацию видео...");
    const taskId = data.videoTaskId;

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      console.log(`  ⏳ Попытка ${i + 1}/20...`);

      const statusRes = await fetch(`http://localhost:3000/api/dream/video/${taskId}`);
      const status = await statusRes.json();

      if (status.status === "completed") {
        console.log("\n🎉 ВИДЕО ГОТОВО!");
        console.log("  URL:", status.videoUrl);
        break;
      } else if (status.status === "failed") {
        console.log("\n❌ Генерация провалилась:", status.message);
        break;
      }
    }
  })
  .catch((e) => console.error("Ошибка:", e));

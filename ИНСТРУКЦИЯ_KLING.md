# Инструкция по подключению Kling AI + OpenAI к Dreameeer

## Архитектура

```
📱 iOS App (SwiftUI)
    │
    ▼
🖥️ Node.js Backend (Express)
    │
    ├──► 🧠 OpenAI GPT-4o API  →  Анализ сна (JSON)
    │
    └──► 🎬 Kling AI API  →  Генерация видео (mp4)
```

---

## Шаг 1: Получить ключи Kling AI

1. Зайди на [https://klingai.com](https://klingai.com)
2. Зарегистрируйся / войди
3. Перейди в раздел **Developer** или **API**
4. Создай новое приложение
5. Скопируй **Access Key** и **Secret Key**

## Шаг 2: Получить ключ OpenAI

1. Зайди на [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Создай новый API ключ
3. Скопируй ключ (начинается с `sk-...`)
4. Пополни баланс (минимум $5)

## Шаг 3: Настроить проект

1. Скопируй `.env.example` → `.env`
2. Вставь свои ключи:

```env
KLING_ACCESS_KEY=твой_access_key
KLING_SECRET_KEY=твой_secret_key
OPENAI_API_KEY=sk-твой_ключ
PORT=3000
```

## Шаг 4: Установить зависимости

```bash
npm install
```

## Шаг 5: Запустить сервер

```bash
npm start
```

Или в режиме разработки (авто-перезапуск):

```bash
npm run dev
```

## Шаг 6: Тестирование

### Простой тест анализа + запуск видео:

```bash
curl -X POST http://localhost:3000/api/dream/analyze \
  -H "Content-Type: application/json" \
  -d '{"dreamText": "Я летел над океаном, вода была фиолетовой, а в небе плавали огромные часы, которые таяли как мороженое"}'
```

### Проверка статуса видео:

```bash
curl http://localhost:3000/api/dream/video/TASK_ID_ИЗ_ОТВЕТА
```

### Полный синхронный тест (ждёт видео):

```bash
curl -X POST http://localhost:3000/api/dream/full \
  -H "Content-Type: application/json" \
  -d '{"dreamText": "Я шёл по лесу из стеклянных деревьев, под ногами текла река из звёздного света"}'
```

## Шаг 7: Интеграция с iOS

В SwiftUI приложении отправляй POST-запросы на бэкенд:

```swift
// 1. Отправить сон на анализ
let url = URL(string: "http://YOUR_SERVER:3000/api/dream/analyze")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONEncoder().encode(["dreamText": dreamText])

// 2. Получить analysis + videoTaskId
// 3. Поллить GET /api/dream/video/:taskId каждые 10 сек
// 4. Когда status == "completed" — показать videoUrl
```

---

## Стоимость

| Сервис | Цена | Примечание |
|--------|------|------------|
| OpenAI GPT-4o | ~$0.01-0.03 за анализ | response_format: json_object |
| Kling AI | ~$0.03-0.10 за секунду видео | 5 сек видео ≈ $0.15-0.50 |
| **Итого за 1 сон** | **~$0.20-0.55** | Анализ + 5 сек видео |

## Безопасность

- **НИКОГДА** не храни ключи в коде — только в `.env`
- Добавь `.env` в `.gitignore`
- Для продакшна используй переменные окружения сервера
- Добавь rate-limiting (например, `express-rate-limit`)
- В продакшне — HTTPS обязательно

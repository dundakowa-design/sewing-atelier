// Общий клиент Google Таблицы: заявки и с сайта (api/submit.js), и из
// Telegram-бота (api/bot.js) уходят в веб-приложение Google Apps Script
// (google/sheets-webhook.gs), которое дописывает их строкой в таблицу
// «Стежок: Заявки с сайта». Адрес веб-приложения вместе с секретным ключом
// (…/exec?key=…) живёт только в переменной окружения SHEETS_WEBHOOK_URL
// (в репозитории его нет и не должно быть). Какой ключ тела запроса в какую
// колонку таблицы попадает, решает скрипт (COLUMNS в google/sheets-webhook.gs).

async function sendToSheetsWebhook(fields) {
  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("Не задана переменная окружения SHEETS_WEBHOOK_URL — запись в таблицу пропущена");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });

  const details = await response.text();

  if (!response.ok) {
    throw new Error(`Google Таблица вернула ошибку ${response.status}: ${details.slice(0, 300)}`);
  }

  // Apps Script сообщает об ошибках не статусом, а телом ответа (всегда 200):
  // {"ok":false,"error":...} или HTML-страница, если скрипт не опубликован.
  let result;
  try {
    result = JSON.parse(details);
  } catch {
    throw new Error(`Google Таблица ответила не JSON (проверьте публикацию скрипта): ${details.slice(0, 300)}`);
  }

  if (!result.ok) {
    throw new Error(`Google Таблица отклонила заявку: ${result.error || details}`);
  }

  // Строка записана, но часть колонок скрипт не узнал по заголовку — они пустые.
  // Это не ошибка заявки, но в таблице не хватит данных: подсказываем в логе.
  if (Array.isArray(result.unmatched) && result.unmatched.length > 0) {
    console.warn(
      `Google Таблица: колонки не распознаны и остались пустыми: ${result.unmatched.join(", ")}. ` +
        "Добавьте эти названия в COLUMNS в google/sheets-webhook.gs"
    );
  }
}

module.exports = { sendToSheetsWebhook };

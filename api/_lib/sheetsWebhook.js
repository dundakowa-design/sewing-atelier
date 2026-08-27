// Общий клиент вебхука Albato: заявки и с сайта (api/submit.js), и из
// Telegram-бота (api/bot.js) идут в одну и ту же интеграцию Albato, которая
// сама раскладывает их по строкам Google Таблицы. URL интеграции — секрет,
// живёт только в переменной окружения SHEETS_WEBHOOK_URL (в репозитории
// её нет и не должно быть). Формат тела запроса — фиксированный набор
// русскоязычных ключей, который уже настроен и замаплен на колонки таблицы
// в самой Albato; менять ключи нельзя, не поправив маппинг на стороне Albato.

async function sendToSheetsWebhook(fields) {
  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("Не задана переменная окружения SHEETS_WEBHOOK_URL — вебхук пропущен");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Вебхук вернул ошибку ${response.status}: ${details}`);
  }
}

module.exports = { sendToSheetsWebhook };

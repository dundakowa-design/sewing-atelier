// Vercel Serverless Function (Node.js): принимает заявку с сайта и параллельно
// 1) отправляет её в Telegram-чат, 2) дублирует данные на вебхук (например, в таблицу).

const { sendToSheetsWebhook } = require("./_lib/sheetsWebhook");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Отправка уведомления в Telegram. Бросает исключение при неудаче —
// это основной (критичный) канал, его сбой должен вернуть ошибку клиенту.
async function sendToTelegram({ token, chatId, text }) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram API вернул ошибку: ${details}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  const body = req.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const calcSummary = typeof body.calc_summary === "string" ? body.calc_summary.trim() : "";
  const calcProduct = typeof body.calc_product === "string" ? body.calc_product.trim() : "";
  const calcQty = typeof body.calc_qty === "string" ? body.calc_qty.trim() : "";
  const calcTotal = typeof body.calc_total === "string" ? body.calc_total.trim() : "";
  const honeypot = body.confirm_email_check;

  // Honeypot: если скрытое поле заполнено — это бот. Тихо отвечаем "успехом",
  // ничего никуда не отправляя, чтобы не подсказывать боту, что его вычислили.
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  if (!name || !phone) {
    return res.status(400).json({ error: "Не заполнены имя или телефон" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Не заданы переменные окружения TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    return res.status(500).json({ error: "Сервер не настроен" });
  }

  const date = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

  const textLines = [
    "🧵 <b>Новая заявка с сайта «Стежок»</b>",
    "",
    `👤 <b>Имя:</b> ${escapeHtml(name)}`,
    `📞 <b>Телефон:</b> ${escapeHtml(phone)}`,
  ];

  if (calcSummary) {
    textLines.push("", `🧮 <b>Расчёт из калькулятора:</b> ${escapeHtml(calcSummary)}`);
  }

  const text = textLines.join("\n");

  // Оба запроса стартуют одновременно и независимо друг от друга.
  const [telegramResult, webhookResult] = await Promise.allSettled([
    sendToTelegram({ token, chatId, text }),
    sendToSheetsWebhook({
      Дата: date,
      Имя: name,
      Телефон: phone,
      Изделие: calcProduct,
      Тираж: calcQty,
      Сумма: calcTotal,
      source: "Сайт",
    }),
  ]);

  if (webhookResult.status === "rejected") {
    // Вебхук вспомогательный — логируем ошибку, но не роняем ответ пользователю.
    console.error(webhookResult.reason?.message || webhookResult.reason);
  }

  if (telegramResult.status === "rejected") {
    console.error(telegramResult.reason?.message || telegramResult.reason);
    return res.status(502).json({ error: "Не удалось отправить заявку" });
  }

  return res.status(200).json({ ok: true });
};

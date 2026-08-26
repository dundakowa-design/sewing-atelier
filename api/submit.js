// Vercel Serverless Function (Node.js): принимает заявку с сайта и пересылает её в Telegram-чат.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!telegramResponse.ok) {
      const details = await telegramResponse.text();
      console.error("Telegram API вернул ошибку:", details);
      return res.status(502).json({ error: "Не удалось отправить сообщение в Telegram" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Ошибка запроса к Telegram API:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

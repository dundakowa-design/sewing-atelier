// Vercel Serverless Function (Node.js): вебхук Telegram-бота.
// Telegram шлёт сюда POST-запрос при каждом сообщении/команде пользователя.
// Пока обрабатываем только /start — приветствие с кнопкой-ссылкой на сайт.

module.exports = async function handler(req, res) {
  // Telegram всегда стучится методом POST. GET/HEAD — это, как правило,
  // ручная проверка адреса в браузере, отвечаем 200, чтобы не пугать логи.
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const update = req.body || {};
  const message = update.message;

  // Не текстовое сообщение (стикер, фото и т.п.) — просто подтверждаем приём.
  if (!message || typeof message.text !== "string") {
    return res.status(200).json({ ok: true });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Не задана переменная окружения TELEGRAM_BOT_TOKEN");
    return res.status(200).json({ ok: true });
  }

  // Переменная окружения SITE_URL в Vercel переопределит этот адрес (например, при подключении своего домена).
  const siteUrl = process.env.SITE_URL || "https://atelier-stezhok.vercel.app";

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start" || text.startsWith("/start ")) {
    const welcomeText = [
      "Приветствуем в швейном цеху «Стежок»! 🧵✨",
      "",
      "Мы специализируемся на ремонте и пошиве одежды (футболки, худи, платья, жакеты и многое другое).",
      "",
      "💻 Чтобы рассчитать точную стоимость вашего заказа, используйте наш интерактивный калькулятор на сайте:",
      siteUrl,
      "",
      "После расчёта вы сможете отправить заявку, и она прилетит прямо в этот чат!",
    ].join("\n");

    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
          reply_markup: {
            inline_keyboard: [[{ text: "Перейти на сайт 🌐", url: siteUrl }]],
          },
        }),
      });

      if (!telegramResponse.ok) {
        console.error("Telegram API вернул ошибку:", await telegramResponse.text());
      }
    } catch (error) {
      console.error("Ошибка запроса к Telegram API:", error);
    }
  }

  // Telegram ждёт быстрый 200 в ответ на вебхук — иначе будет слать update повторно.
  return res.status(200).json({ ok: true });
};

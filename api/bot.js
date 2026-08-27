// Vercel Serverless Function (Node.js): вебхук Telegram-бота.
// Telegram шлёт сюда POST-запрос при каждом сообщении, нажатии inline-кнопки
// или команде пользователя.
//
// Опрос "оформить заказ прямо в чате" сделан БЕЗ базы данных и без памяти
// между вызовами (функция серверлесс, состояние между запросами не хранится).
// Вместо этого каждый вопрос бота отправляется с reply_markup.force_reply —
// тогда ответ пользователя приходит с заполненным message.reply_to_message,
// и по тексту этого поля мы понимаем, на какой вопрос отвечают. Текст первого
// ответа (что шить) "провозится" внутри второго вопроса короткой цитатой —
// это единственное место, куда его можно положить, чтобы не терять при сборке
// итоговой заявки.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const QUESTION_PRODUCT = "Что именно вы хотите сшить или отремонтировать? (Например: 50 худи, ремонт куртки)";
const QUESTION_CONTACTS = "Ваше имя и телефон для связи?";

// Регэксп для разбора вопроса №2 обратно на "что шить" + сам вопрос —
// см. buildContactsQuestion() ниже, где эта строка собирается.
const CONTACTS_QUESTION_RE = /^Записал:\s*«([\s\S]*)»\n\n Ваше имя и телефон для связи\?$/;

function buildContactsQuestion(productAnswer) {
  return `Записал: «${productAnswer}»\n\n ${QUESTION_CONTACTS}`;
}

async function callTelegramApi(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`Telegram API (${method}) вернул ошибку:`, await response.text());
  }

  return response;
}

function sendMessage(token, chatId, text, extra = {}) {
  return callTelegramApi(token, "sendMessage", { chat_id: chatId, text, ...extra });
}

module.exports = async function handler(req, res) {
  // Telegram всегда стучится методом POST. GET/HEAD — это, как правило,
  // ручная проверка адреса в браузере, отвечаем 200, чтобы не пугать логи.
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const update = req.body || {};

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Не задана переменная окружения TELEGRAM_BOT_TOKEN");
    return res.status(200).json({ ok: true });
  }

  // Переменная окружения SITE_URL в Vercel переопределит этот адрес (например, при подключении своего домена).
  const siteUrl = process.env.SITE_URL || "https://atelier-stezhok.vercel.app";
  // Рабочая группа "Стежок Ателье" — куда падают заявки, оформленные прямо в чате бота.
  // Та же переменная, что уже используется для заявок с сайта (api/submit.js).
  const groupChatId = process.env.TELEGRAM_CHAT_ID || "-1003512421303";

  // --- Нажатие inline-кнопки ---
  if (update.callback_query) {
    const callback = update.callback_query;

    // Убираем "часики" на кнопке — Telegram требует подтвердить callback в любом случае.
    await callTelegramApi(token, "answerCallbackQuery", { callback_query_id: callback.id });

    if (callback.data === "start_order" && callback.message) {
      await sendMessage(token, callback.message.chat.id, QUESTION_PRODUCT, {
        reply_markup: { force_reply: true, input_field_placeholder: "Например: 50 худи" },
      });
    }

    return res.status(200).json({ ok: true });
  }

  const message = update.message;

  // Не текстовое сообщение (стикер, фото и т.п.) — просто подтверждаем приём.
  if (!message || typeof message.text !== "string") {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const repliedTo = message.reply_to_message && typeof message.reply_to_message.text === "string"
    ? message.reply_to_message.text
    : null;

  // --- Команда /start ---
  if (text === "/start" || text.startsWith("/start ")) {
    const welcomeText = [
      "Приветствуем в швейном цеху «Стежок»! 🧵✨",
      "",
      "Мы специализируемся на ремонте и пошиве одежды (футболки, худи, платья, жакеты и многое другое).",
      "",
      "Как вы хотите оформить заказ?",
      "🤖 Прямо здесь в чате — нажмите кнопку «Оформить заказ здесь», и я задам вам несколько вопросов.",
      "🖥️ Через калькулятор на сайте — если хотите самостоятельно рассчитать стоимость партии, используйте наш интерактивный сайт.",
    ].join("\n");

    await sendMessage(token, chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 Оформить заказ здесь", callback_data: "start_order" }],
          [{ text: "🌐 Перейти на сайт", url: siteUrl }],
        ],
      },
    });

    return res.status(200).json({ ok: true });
  }

  // --- Шаг 1 опроса: пользователь ответил, что хочет сшить/отремонтировать ---
  if (repliedTo === QUESTION_PRODUCT) {
    await sendMessage(token, chatId, buildContactsQuestion(text), {
      reply_markup: { force_reply: true, input_field_placeholder: "Имя, телефон" },
    });

    return res.status(200).json({ ok: true });
  }

  // --- Шаг 2 опроса: пользователь прислал имя и телефон — заявка готова ---
  if (repliedTo && CONTACTS_QUESTION_RE.test(repliedTo)) {
    const match = repliedTo.match(CONTACTS_QUESTION_RE);
    const product = match ? match[1] : "(не указано)";
    const from = message.from || {};
    const author = from.username ? `@${from.username}` : `id ${from.id ?? "—"}`;

    const summaryText = [
      "🧵 <b>Новая заявка из Telegram-бота</b>",
      "",
      `✂️ <b>Что нужно:</b> ${escapeHtml(product)}`,
      `👤 <b>Контакты:</b> ${escapeHtml(text)}`,
      `💬 <b>От:</b> ${escapeHtml(author)}`,
    ].join("\n");

    await sendMessage(token, groupChatId, summaryText, { parse_mode: "HTML" });
    await sendMessage(token, chatId, "Спасибо! Ваша заявка принята, мастер свяжется с вами в ближайшее время.");

    return res.status(200).json({ ok: true });
  }

  // Telegram ждёт быстрый 200 в ответ на вебхук — иначе будет слать update повторно.
  return res.status(200).json({ ok: true });
};

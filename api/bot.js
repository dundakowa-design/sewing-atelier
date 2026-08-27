// Vercel Serverless Function (Node.js): вебхук Telegram-бота.
// Telegram шлёт сюда POST-запрос при каждом сообщении, нажатии кнопки
// или команде пользователя.
//
// Опрос "оформить заказ прямо в чате" сделан БЕЗ базы данных и без памяти
// между вызовами (функция серверлесс, состояние между запросами не хранится).
// Поэтому порядок шагов такой: СНАЧАЛА бот запрашивает телефон через кнопку
// "Отправить номер телефона" (request_contact) — это самостоятельный первый
// шаг, ему не нужен контекст предыдущих сообщений. У сообщения с контактом
// НЕТ reply_to_message (это особенность обычной ReplyKeyboardMarkup, в
// отличие от force_reply), поэтому связать его с каким-то предыдущим текстом
// невозможно в принципе — а вот запросить контакт "с нуля" можно всегда.
// Вопрос "что шить" задаём ВТОРЫМ, через force_reply, — и полученный телефон
// "провозим" короткой цитатой внутри текста этого вопроса, чтобы не потерять
// его к моменту сборки итоговой заявки. Имя берём из профиля Telegram
// (message.from.first_name) прямо в момент финального ответа — его вообще
// не нужно никуда провозить, оно есть в любом сообщении пользователя.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CONTACT_BUTTON_TEXT = "📱 Отправить номер телефона";
const CONTACT_PROMPT = "Чтобы мастер мог с вами связаться, поделитесь, пожалуйста, номером телефона — нажмите кнопку ниже 👇";
const CONTACT_WRONG_PERSON_WARNING = "Похоже, это чужой контакт. Нажмите кнопку «📱 Отправить номер телефона» — она отправит именно ваш номер.";
const QUESTION_PRODUCT = "Что именно вы хотите сшить или отремонтировать? (Например: 50 худи, ремонт куртки)";

// Телефон, полученный через кнопку, "провозим" в тексте вопроса о заказе —
// см. buildProductQuestion() / extractPhoneFromRepliedQuestion() ниже.
const PHONE_RECAP_PREFIX = "Телефон записан: ";

function buildProductQuestion(phone) {
  return `${PHONE_RECAP_PREFIX}${phone}\n\n${QUESTION_PRODUCT}`;
}

// Возвращает телефон, если repliedToText — это именно наш вопрос о заказе
// с "провезённым" в нём телефоном, иначе null.
function extractPhoneFromRepliedQuestion(repliedToText) {
  const suffix = `\n\n${QUESTION_PRODUCT}`;
  if (!repliedToText.startsWith(PHONE_RECAP_PREFIX) || !repliedToText.endsWith(suffix)) {
    return null;
  }
  return repliedToText.slice(PHONE_RECAP_PREFIX.length, -suffix.length).trim();
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

// Запрашивает телефон кнопкой request_contact — единственный способ получить
// от Telegram проверенный номер, а не произвольный текст.
function askForContact(token, chatId) {
  return sendMessage(token, chatId, CONTACT_PROMPT, {
    reply_markup: {
      keyboard: [[{ text: CONTACT_BUTTON_TEXT, request_contact: true }]],
      one_time_keyboard: true,
    },
  });
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
      await askForContact(token, callback.message.chat.id);
    }

    return res.status(200).json({ ok: true });
  }

  const message = update.message;

  if (!message) {
    return res.status(200).json({ ok: true });
  }

  // --- Пользователь поделился контактом (кнопка "Отправить номер телефона") ---
  if (message.contact && typeof message.contact.phone_number === "string") {
    const chatId = message.chat.id;
    const from = message.from || {};

    // request_contact сам по себе даёт только кнопку "поделиться СВОИМ номером",
    // но пользователь технически может вручную прикрепить чужую визитку поверх
    // той же клавиатуры — на всякий случай сверяем владельца контакта с автором.
    if (message.contact.user_id && from.id && message.contact.user_id !== from.id) {
      await sendMessage(token, chatId, CONTACT_WRONG_PERSON_WARNING);
      return res.status(200).json({ ok: true });
    }

    await sendMessage(token, chatId, buildProductQuestion(message.contact.phone_number), {
      reply_markup: { force_reply: true, input_field_placeholder: "Например: 50 худи" },
    });

    return res.status(200).json({ ok: true });
  }

  // Не текстовое сообщение (стикер, фото и т.п.) — просто подтверждаем приём.
  if (typeof message.text !== "string") {
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

  // --- Финальный шаг опроса: пользователь ответил, что хочет сшить/отремонтировать —
  // телефон уже проверенный (из message.contact), достаём его из "провезённой" цитаты ---
  if (repliedTo) {
    const phone = extractPhoneFromRepliedQuestion(repliedTo);

    if (phone) {
      const from = message.from || {};
      const name = from.first_name || "(не указано)";
      const author = from.username ? `@${from.username}` : `id ${from.id ?? "—"}`;

      const summaryText = [
        "🧵 <b>Новая заявка из Telegram-бота</b>",
        "",
        `✂️ <b>Что нужно:</b> ${escapeHtml(text)}`,
        `👤 <b>Имя:</b> ${escapeHtml(name)}`,
        `📞 <b>Телефон:</b> ${escapeHtml(phone)}`,
        `💬 <b>От:</b> ${escapeHtml(author)}`,
      ].join("\n");

      await sendMessage(token, groupChatId, summaryText, { parse_mode: "HTML" });
      await sendMessage(token, chatId, "Спасибо! Ваша заявка принята, мастер свяжется с вами в ближайшее время.");

      return res.status(200).json({ ok: true });
    }
  }

  // Telegram ждёт быстрый 200 в ответ на вебхук — иначе будет слать update повторно.
  return res.status(200).json({ ok: true });
};

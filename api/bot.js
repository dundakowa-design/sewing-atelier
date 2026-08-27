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
// итоговой заявки (в том числе если второй ответ не прошёл валидацию и вопрос
// задаётся повторно).

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CONTACTS_REPLY = [
  "📍 Наш адрес: г. Москва, ул. Текстильная, 12",
  "⏰ Режим работы: Пн-Пт с 09:00 до 18:00",
  "📞 Телефон: +7 (901) 546-20-94",
  "✉️ Email: info@atelier-stezhok.ru",
  "",
  "Ждем вас в гости! Вы также можете построить маршрут на карте прямо на нашем сайте.",
].join("\n");

const PRICING_REPLY = [
  "⏳ Базовые сроки производства:",
  "• Мелкие партии (от 20 шт.) — от 5 до 7 рабочих дней.",
  "• Крупные тиражи — индивидуально, в зависимости от сложности.",
  "• Разработка лекал — от 2 до 4 дней.",
  "",
  "💰 Точную стоимость пошива вашей партии с учетом скидок от объема вы можете рассчитать прямо сейчас в калькуляторе на нашем сайте! Просто нажмите кнопку 'Перейти на сайт' в главном меню.",
].join("\n");

const BOT_COMMANDS = [
  { command: "start", description: "Запустить бота и оформить заказ" },
  { command: "contacts", description: "Адрес и контакты ателье" },
  { command: "pricing", description: "Сроки и базовые цены" },
];

// Синее меню команд Telegram регистрируется отдельным вызовом API, никак не
// связанным с обработкой конкретного апдейта. У серверлесс-функции нет
// традиционного "старта процесса" — ближайший аналог здесь это холодный
// старт контейнера Vercel, поэтому регистрируем меню один раз при загрузке
// модуля (а не на каждый вебхук: пока контейнер "тёплый", require() второй
// раз не выполнится).
if (process.env.TELEGRAM_BOT_TOKEN) {
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: BOT_COMMANDS }),
  }).catch((error) => console.error("Не удалось зарегистрировать меню команд бота:", error));
}

// В группах Telegram дописывает к команде юзернейм бота (/contacts@stezhok_atelier_bot),
// а иногда после команды идёт аргумент через пробел — учитываем оба варианта.
function isCommand(value, command) {
  return value === command || value.startsWith(`${command}@`) || value.startsWith(`${command} `);
}

const QUESTION_PRODUCT = "Что именно вы хотите сшить или отремонтировать? (Например: 50 худи, ремонт куртки)";
const QUESTION_CONTACTS = "Напишите, пожалуйста, ваше имя и номер телефона для связи 📞";
const INVALID_CONTACTS_MESSAGE = "Ой, кажется, вы забыли указать номер телефона. Пожалуйста, напишите ваше имя и корректный номер, чтобы наш мастер смог с вами связаться ☺️";

// Текст первого ответа "провозим" короткой цитатой внутри второго вопроса —
// см. extractProductFromRepliedQuestion() ниже, где она достаётся обратно.
const PRODUCT_RECAP_PREFIX = "Записал: «";
const PRODUCT_RECAP_SUFFIX = `»\n\n${QUESTION_CONTACTS}`;

function buildContactsQuestion(productAnswer) {
  return `${PRODUCT_RECAP_PREFIX}${productAnswer}${PRODUCT_RECAP_SUFFIX}`;
}

// Возвращает текст "что шить", если repliedToText — это наш вопрос про
// контакты с "провезённым" в нём ответом на первый вопрос, иначе null.
function extractProductFromRepliedQuestion(repliedToText) {
  if (!repliedToText.startsWith(PRODUCT_RECAP_PREFIX) || !repliedToText.endsWith(PRODUCT_RECAP_SUFFIX)) {
    return null;
  }
  return repliedToText.slice(PRODUCT_RECAP_PREFIX.length, -PRODUCT_RECAP_SUFFIX.length);
}

// Мягкая проверка: в нормальном номере телефона минимум 10 цифр
// (даже без учёта кода страны). Если цифр меньше — это явно не телефон.
function looksLikePhone(value) {
  const digitCount = (value.match(/\d/g) || []).length;
  return digitCount >= 10;
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

function askForceReply(token, chatId, question, placeholder) {
  return sendMessage(token, chatId, question, {
    reply_markup: { force_reply: true, input_field_placeholder: placeholder },
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
      await askForceReply(token, callback.message.chat.id, QUESTION_PRODUCT, "Например: 50 худи");
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

  // --- Команда /contacts ---
  if (isCommand(text, "/contacts") || text === "Контакты") {
    await sendMessage(token, chatId, CONTACTS_REPLY);
    return res.status(200).json({ ok: true });
  }

  // --- Команда /pricing ---
  if (isCommand(text, "/pricing") || text === "Цены и сроки") {
    await sendMessage(token, chatId, PRICING_REPLY);
    return res.status(200).json({ ok: true });
  }

  // --- Вопрос 1: пользователь ответил, что хочет сшить/отремонтировать ---
  if (repliedTo === QUESTION_PRODUCT) {
    await askForceReply(token, chatId, buildContactsQuestion(text), "Имя, телефон");
    return res.status(200).json({ ok: true });
  }

  // --- Вопрос 2: пользователь прислал имя и телефон ---
  if (repliedTo) {
    const product = extractProductFromRepliedQuestion(repliedTo);

    if (product !== null) {
      // Мягкая валидация: явный бред без номера телефона переспрашиваем,
      // не потеряв при этом ответ на первый вопрос.
      if (!looksLikePhone(text)) {
        await sendMessage(token, chatId, INVALID_CONTACTS_MESSAGE);
        await askForceReply(token, chatId, buildContactsQuestion(product), "Имя, телефон");
        return res.status(200).json({ ok: true });
      }

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
  }

  // Telegram ждёт быстрый 200 в ответ на вебхук — иначе будет слать update повторно.
  return res.status(200).json({ ok: true });
};

// Общий адрес Telegram Bot API для api/submit.js и api/bot.js. С российского
// сервера прямые запросы к api.telegram.org блокируются, поэтому адрес можно
// переопределить переменной окружения TELEGRAM_API_BASE — например, на свой
// Cloudflare Worker, который проксирует запросы к api.telegram.org.
// Публичные "бесплатные" прокси сюда не подставлять: через них проходят токен
// бота и персональные данные клиентов.

const DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org";

function telegramApiUrl(token, method) {
  const apiBase = (process.env.TELEGRAM_API_BASE || DEFAULT_TELEGRAM_API_BASE).replace(/\/+$/, "");
  return `${apiBase}/bot${token}/${method}`;
}

module.exports = { telegramApiUrl };

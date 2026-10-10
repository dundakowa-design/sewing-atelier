// Cloudflare Worker: шлюз к Telegram Bot API для сервера в РФ, откуда прямые
// запросы к api.telegram.org блокируются. Адрес воркера прописывается на
// сервере в переменной окружения TELEGRAM_API_BASE (см. api/_lib/telegramApi.js).
//
// Пропускает только пути Bot API (/bot<токен>/<метод> и /file/bot<токен>/...),
// чтобы воркер нельзя было использовать как прокси на произвольные сайты.
// Токен в воркере не хранится — он приходит в пути запроса от нашего сервера.

const TELEGRAM_API = "https://api.telegram.org";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/bot") && !url.pathname.startsWith("/file/bot")) {
      return new Response("Not found", { status: 404 });
    }

    const upstreamUrl = TELEGRAM_API + url.pathname + url.search;

    return fetch(upstreamUrl, {
      method: request.method,
      headers: { "Content-Type": request.headers.get("Content-Type") || "application/json" },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    });
  },
};

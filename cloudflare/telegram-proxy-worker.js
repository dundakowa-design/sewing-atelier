// Cloudflare Worker: шлюз между Telegram и сервером в РФ, где блокировка
// работает в обе стороны.
//
// 1) Исходящие: сервер -> Telegram Bot API. Адрес воркера прописывается на
//    сервере в TELEGRAM_API_BASE (см. api/_lib/telegramApi.js). Пропускаются
//    только пути Bot API (/bot<токен>/<метод> и /file/bot<токен>/...), чтобы
//    воркер нельзя было использовать как прокси на произвольные сайты.
//    Токен в воркере не хранится — он приходит в пути запроса от сервера.
//
// 2) Входящие: Telegram -> вебхук бота. Telegram не может достучаться до
//    сервера напрямую (Connection timed out), поэтому вебхук ставится на
//    /telegram-webhook этого воркера, а воркер пересылает апдейт на сервер.
//    Если в настройках воркера задан секрет WEBHOOK_SECRET, принимаются только
//    апдейты с заголовком X-Telegram-Bot-Api-Secret-Token (его ставит сам
//    Telegram, если вебхук задан с параметром secret_token).

const TELEGRAM_API = "https://api.telegram.org";
const BOT_WEBHOOK_TARGET = "https://stezhok-za-stezhkom.ru/api/bot";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/telegram-webhook") {
      return forwardWebhook(request, env);
    }

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

async function forwardWebhook(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = env && env.WEBHOOK_SECRET;
  if (secret && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  // Ответ сервера возвращаем Telegram как есть: если сервер недоступен
  // или вернул ошибку, Telegram повторит доставку позже.
  return fetch(BOT_WEBHOOK_TARGET, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: request.body,
  });
}

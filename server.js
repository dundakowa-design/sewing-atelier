// Запуск api/submit.js и api/bot.js на обычном сервере (не Vercel).
// Эти файлы — серверлесс-функции: они только экспортируют обработчик и сами
// порт не слушают, поэтому `node api/submit.js` сразу завершается. Здесь
// поднимается один HTTP-сервер, который отдаёт им запросы так же, как Vercel:
//   POST /api/submit — заявки с сайта
//   POST /api/bot    — вебхук Telegram-бота
//
// Переменные окружения читаются из .env в корне проекта (если файл есть).
// Запуск: node server.js   (порт и адрес — переменные PORT и HOST)

const fs = require("fs");
const http = require("http");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Файл ${filePath} не найден — используются только переменные окружения процесса`);
    return;
  }
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Переменные, заданные при запуске, важнее .env.
    if (!(key in process.env)) process.env[key] = value;
  }
}

// .env нужно прочитать ДО подключения обработчиков: api/bot.js при загрузке
// сразу регистрирует меню команд и уже должен видеть токен и TELEGRAM_API_BASE.
loadEnvFile(path.join(__dirname, ".env"));

const routes = {
  "/api/submit": require("./api/submit"),
  "/api/bot": require("./api/bot"),
};

const MAX_BODY_BYTES = 100 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Слишком большой запрос"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Некорректный JSON"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

// Хелперы ответа, которыми пользуются обработчики (как в Vercel/Express).
function withResponseHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = (body) => {
    if (typeof body === "object" && body !== null) return res.json(body);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(String(body));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  withResponseHelpers(res);
  const pathname = new URL(req.url, "http://localhost").pathname.replace(/\/+$/, "");
  const handler = routes[pathname];

  if (!handler) {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    req.body = req.method === "POST" ? await readJsonBody(req) : {};
    await handler(req, res);
  } catch (error) {
    console.error(`Ошибка в ${pathname}:`, error.message);
    if (!res.headersSent) {
      // Ошибки запроса (400/413) объясняем клиенту, детали внутренних — только в лог.
      const message = error.statusCode ? error.message : "Внутренняя ошибка сервера";
      res.status(error.statusCode || 500).json({ error: message });
    }
  }
});

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";

server.listen(port, host, () => {
  console.log(`API запущен на http://${host}:${port} (/api/submit, /api/bot)`);
  console.log(`Telegram API: ${process.env.TELEGRAM_API_BASE || "https://api.telegram.org (TELEGRAM_API_BASE не задан!)"}`);
});

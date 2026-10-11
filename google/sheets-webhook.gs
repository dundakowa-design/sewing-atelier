// Google Apps Script: приёмник заявок для таблицы «Стежок: Заявки с сайта».
// Вставляется в саму таблицу (Расширения → Apps Script) и публикуется как
// веб-приложение. server.js шлёт сюда POST с JSON (api/_lib/sheetsWebhook.js),
// скрипт дописывает заявку новой строкой на первый лист.
//
// Колонки подбираются по заголовкам в первой строке листа (см. COLUMNS ниже:
// у каждого поля несколько вариантов названия, регистр и лишние пробелы не
// важны). Если лист пустой, заголовки создаются сами; лишние колонки можно
// удалить, порядок — менять. Нераспознанные заголовки остаются пустыми, и
// скрипт возвращает их список — сервер пишет его в server.log.
//
// Защита: адрес веб-приложения открыт всем, поэтому запрос принимается только
// с секретным ключом в адресе (?key=...). Замените значение SECRET ниже на свой
// ключ — тот же, что стоит в конце SHEETS_WEBHOOK_URL в .env на сервере.

const SECRET = "ЗАМЕНИТЕ_НА_СВОЙ_СЕКРЕТНЫЙ_КЛЮЧ";

const DEFAULT_HEADERS = ["Дата и время", "Имя клиента", "Телефон", "Изделие", "Тираж", "Сумма", "Источник", "Статус"];

// Какое поле заявки (field) или постоянное значение (value) класть в колонку
// с одним из этих заголовков. Ключ "source" приходит латиницей (исторически).
const COLUMNS = [
  { field: "Дата", headers: ["дата", "дата и время", "дата создания", "дата заявки", "время"] },
  { field: "Имя", headers: ["имя", "имя клиента", "клиент", "фио", "фио клиента"] },
  { field: "Телефон", headers: ["телефон", "телефон клиента", "номер телефона", "номер"] },
  { field: "Изделие", headers: ["изделие", "что шить", "заказ"] },
  { field: "Тираж", headers: ["тираж", "количество", "кол во"] },
  { field: "Сумма", headers: ["сумма", "стоимость", "цена"] },
  { field: "source", headers: ["источник", "откуда"] },
  { value: "Новый", headers: ["статус"] },
];

// "  Имя  клиента: " -> "имя клиента"
function normalizeHeader_(header) {
  return String(header).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
}

const COLUMN_BY_HEADER = {};
COLUMNS.forEach((column) => column.headers.forEach((h) => (COLUMN_BY_HEADER[normalizeHeader_(h)] = column)));

function doPost(e) {
  try {
    if (!e || !e.parameter || e.parameter.key !== SECRET) {
      return json_({ ok: false, error: "Неверный ключ доступа" });
    }

    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Две заявки в одну секунду не должны записаться в одну и ту же строку.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const unmatched = [];
    try {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(DEFAULT_HEADERS);
        sheet.setFrozenRows(1);
      }
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const row = headers.map((header) => {
        const column = COLUMN_BY_HEADER[normalizeHeader_(header)];
        if (!column) {
          if (String(header).trim()) unmatched.push(String(header));
          return "";
        }
        return asText_(column.field ? data[column.field] : column.value);
      });
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true, unmatched: unmatched });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

// Значения пишем как текст: иначе таблица превратит "+7 999…" в число без плюса,
// а строку, начинающуюся с "=", выполнит как формулу.
function asText_(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

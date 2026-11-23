/**
 * Стим — вход сотрудников и журнал обучения.
 * Скрипт привязан к таблице «Стим — сотрудники и статистика обучения».
 * Токен бота хранится в «Свойствах скрипта» под именем BOT_TOKEN (в код его не вставлять).
 */
const MAX_AGE_SEC = 7 * 24 * 3600; // сколько живёт подпись Telegram

function doGet() {
  return out({ ok: true, service: "stim-obuchenie" });
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, reason: "bad_request" }); }
  const user = verifyTelegram_(req.initData);
  if (!user) return out({ ok: false, reason: "bad_signature" });
  const emp = findEmployee_(user);
  if (!emp) {
    log_(user, null, "нет доступа", "", "", "");
    return out({ ok: false, reason: "not_allowed", id: user.id, username: user.username || "" });
  }
  const event = String(req.event || "вход").slice(0, 40);
  if (event !== "check") {
    log_(user, emp, event, String(req.productId || "").slice(0, 20), String(req.product || "").slice(0, 200), String(req.result || "").slice(0, 200));
  }
  return out({ ok: true, name: emp.name });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Проверка подписи initData по правилам Telegram Mini Apps. */
function verifyTelegram_(initData) {
  if (!initData) return null;
  const token = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
  if (!token) return null;
  const params = {};
  String(initData).split("&").forEach(function (pair) {
    const i = pair.indexOf("=");
    if (i < 0) return;
    params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, "%20"));
  });
  const hash = params.hash;
  if (!hash) return null;
  delete params.hash;
  const check = Object.keys(params).sort().map(function (k) { return k + "=" + params[k]; }).join("\n");
  const secret = Utilities.computeHmacSha256Signature(Utilities.newBlob(token).getBytes(), Utilities.newBlob("WebAppData").getBytes());
  const sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(check).getBytes(), secret);
  const hex = sig.map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
  if (hex !== hash) return null;
  if (Date.now() / 1000 - Number(params.auth_date || 0) > MAX_AGE_SEC) return null;
  try { return JSON.parse(params.user); } catch (err) { return null; }
}

/** Ищет сотрудника на листе «Сотрудники»: по Telegram ID или @username, только с галочкой «Доступ». */
function findEmployee_(user) {
  const sh = SpreadsheetApp.getActive().getSheetByName("Сотрудники");
  const rows = sh.getDataRange().getValues();
  const uname = String(user.username || "").toLowerCase();
  const uid = String(user.id);
  for (let r = 1; r < rows.length; r++) {
    const name = String(rows[r][0] || "").trim();
    const tg = String(rows[r][1] || "").trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "").toLowerCase();
    const access = rows[r][2] === true || String(rows[r][2]).toUpperCase() === "TRUE";
    const savedId = String(rows[r][3] || "").trim();
    if (!name || !access) continue;
    if (savedId === uid || tg === uid || (uname && tg === uname)) {
      if (savedId !== uid) sh.getRange(r + 1, 4).setValue(uid);
      return { name: name, row: r + 1 };
    }
  }
  return null;
}

function log_(user, emp, event, productId, product, result) {
  const sh = SpreadsheetApp.getActive().getSheetByName("Журнал");
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  sh.appendRow([new Date(), emp ? emp.name : fullName, user.username ? "@" + user.username : "", String(user.id), event, productId, product, result]);
}

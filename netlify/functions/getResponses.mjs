import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/* 어드민 조회. 비밀번호는 서버(여기)에서 검증.
 * 시트는 wide(문항별 열)로 저장돼 있으므로, 어드민 대시보드가 기대하는
 * 중첩 구조(scenes.cond_X.answers.*)로 복원(unflatten)해서 반환한다. */

const COND_ORDER = ["A", "B", "C1", "C2"];
const META_SUFFIX = ["order", "source", "favor"];

function num(v) {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

function unflatten(o) {
  const scenes = {};
  for (const c of COND_ORDER) {
    const prefix = c + "_";
    const answers = {};
    for (const [k, v] of Object.entries(o)) {
      if (!k.startsWith(prefix)) continue;
      const item = k.slice(prefix.length);
      if (META_SUFFIX.includes(item)) continue;
      const val = num(v);
      if (val !== undefined) answers[item] = val;
    }
    const hasAny = Object.keys(answers).length > 0 || o[`${c}_order`];
    if (hasAny) {
      scenes[`cond_${c}`] = {
        conditionCode: c,
        order: num(o[`${c}_order`]),
        source: o[`${c}_source`] || "",
        favor: o[`${c}_favor`] || "",
        answers,
      };
    }
  }
  const pre = {};
  ["NAME","CONTACT","AIEXP1","AIEXP2","PRE_TR1","PRE_TR2","PRE_ID1","PRE_ID2","PRE_ID3","PRE_ID4","PRE_ID5","DEM1","DEM2","DEM3","DEM4"]
    .forEach((it) => { if (o[it] !== "" && o[it] != null) pre[it] = num(o[it]); });
  return {
    participantId: o.participantId,
    participantCode: o.participantCode || "",
    context: o.context || "",
    contextLabel: o.contextLabel || "",
    completed: String(o.completed) === "1",
    comprehension: { correct: String(o.comprehension_correct) === "1" },
    preSurvey: pre,
    postSurvey: {
      POST_CXT1: num(o.POST_CXT1), POST_CXT2: num(o.POST_CXT2), POST_CXT3: num(o.POST_CXT3),
    },
    scenes,
  };
}

let _sheet = null;
async function getSheet() {
  if (_sheet) return _sheet;
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.loadHeaderRow().catch(() => {});
  _sheet = sheet;
  return sheet;
}

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

export const handler = async (event) => {
  const key = event.headers["x-admin-key"] || event.headers["X-Admin-Key"] || "";
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return json(401, { error: "unauthorized" });
  }
  try {
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    const responses = rows.map((r) => unflatten(r.toObject())).filter((x) => x.participantId);
    return json(200, { responses });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};

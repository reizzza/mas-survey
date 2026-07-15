import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/* ---------------------------------------------------------------------------
 *  설문 응답을 "문항별 열"로 펼쳐서(wide) 저장.
 *  participantId 기준 upsert. 분석 도구(R/SPSS/JASP)에 바로 넣을 수 있는 형태.
 * ------------------------------------------------------------------------- */

const COND_ORDER = ["A", "B", "C1", "C2"];

const COMMON = ["LEG1","LEG2","LEG3","ACC1","ACC2","ACC3","REP1","REP2","REP3","REP4","EMO1","EMO2","EMO3","EMO4","MC1","MC2","MC3"];
const COND_ITEMS = {
  A:  COMMON,
  B:  ["LEG1","LEG2","LEG3","ACC1","ACC2","ACC3","REP1","REP2","REP3","REP4","EMO1","EMO2","EMO3","EMO4","ATTR_B1","ATTR_B2","MC1","MC2","MC3"],
  C1: ["LEG1","LEG2","LEG3","ACC1","ACC2","ACC3","REP1","REP2","REP3","REP4","MED1","MED2","MED3","EMO1","EMO2","EMO3","EMO4","MC1","MC2","MC3"],
  C2: ["LEG1","LEG2","LEG3","ACC1","ACC2","ACC3","REP1","REP2","REP3","REP4","MED1","MED2","MED3","EMO1","EMO2","EMO3","EMO4","ATTR_C2_1","ATTR_C2_2","MC1","MC2","MC3"],
};

const PRE_ITEMS = ["NAME","CONTACT","AIEXP1","AIEXP2","PRE_TR1","PRE_TR2","PRE_ID1","PRE_ID2","PRE_ID3","PRE_ID4","PRE_ID5","DEM1","DEM2","DEM3","DEM4"];
const POST_ITEMS = ["POST_CXT1","POST_CXT2","POST_CXT3"];

function buildHeaders() {
  const h = [
    "participantId", "participantCode", "updatedAt", "step", "completed",
    "contextLabel", "context", "comprehension_correct", "comprehension_selected",
    "consent_c1", "consent_c3", "consent_c4",
    ...PRE_ITEMS,
  ];
  for (const c of COND_ORDER) {
    h.push(`${c}_order`, `${c}_source`, `${c}_favor`);
    for (const it of COND_ITEMS[c]) h.push(`${c}_${it}`);
  }
  h.push(...POST_ITEMS, "startedAt");
  return h;
}
const HEADERS = buildHeaders();

function flatten(participantId, step, data) {
  const d = data || {};
  const row = {
    participantId,
    updatedAt: new Date().toISOString(),
    step: step || "",
    completed: step === "done" ? 1 : 0,
    contextLabel: d.contextLabel ?? "",
    context: d.context ?? "",
    comprehension_correct: d.comprehension?.correct === true ? 1 : (d.comprehension?.correct === false ? 0 : ""),
    comprehension_selected: d.comprehension?.selected ?? "",
    consent_c1: d.consent?.c1 ? 1 : "",
    consent_c3: d.consent?.c3 ? 1 : "",
    consent_c4: d.consent?.c4 ? 1 : "",
    startedAt: d.meta?.startedAt ?? "",
  };
  for (const it of PRE_ITEMS) row[it] = d.preSurvey?.[it] ?? "";
  for (const c of COND_ORDER) {
    const sc = d.scenes?.[`cond_${c}`];
    row[`${c}_order`] = sc?.order ?? "";
    row[`${c}_source`] = sc?.source ?? "";
    row[`${c}_favor`] = sc?.favor ?? "";
    const a = sc?.answers || {};
    for (const it of COND_ITEMS[c]) row[`${c}_${it}`] = a[it] ?? "";
  }
  for (const it of POST_ITEMS) row[it] = d.postSurvey?.[it] ?? "";
  return row;
}

/* 캐싱하지 않는다. 함수 인스턴스가 살아있는 동안 옛 헤더를 기억해버리면
 * 시트를 비워도 새 헤더가 생성되지 않아 데이터가 어긋난다. */
async function getSheet() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  // 현재 헤더가 기대 구조를 모두 담고 있는지 확인하고, 아니면 새로 세운다.
  let ok = false;
  try {
    await sheet.loadHeaderRow();
    const cur = sheet.headerValues || [];
    ok = cur.length > 0 && HEADERS.every((h) => cur.includes(h));
  } catch {
    ok = false; // 빈 시트 등
  }
  if (!ok) {
    await sheet.setHeaderRow(HEADERS);
    await sheet.loadHeaderRow();
  }
  return sheet;
}

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "invalid JSON" }); }

  const { participantId, step, data } = body;
  if (!participantId) return json(400, { error: "participantId required" });

  try {
    const sheet = await getSheet();
    const rowData = flatten(participantId, step, data);
    const rows = await sheet.getRows();
    const existing = rows.find((r) => r.get("participantId") === participantId);
    let participantCode;
    if (existing) {
      participantCode = existing.get("participantCode") || "";
      rowData.participantCode = participantCode;
      for (const [k, v] of Object.entries(rowData)) existing.set(k, v);
      await existing.save();
    } else {
      participantCode = "P" + String(rows.length + 1).padStart(2, "0");
      rowData.participantCode = participantCode;
      await sheet.addRow(rowData);
    }
    return json(200, { ok: true, participantCode });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};

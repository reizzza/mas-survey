import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/* 시트 헤더 (첫 행). data 열에 전체 응답 JSON을 통째로 보관하고,
 * 자주 보는 메타는 별도 열로 빼서 빠르게 훑어볼 수 있게 함. */
export const HEADERS = [
  "participantId", "updatedAt", "context", "step", "completed", "comprehensionCorrect", "data",
];

let _sheet = null;

export async function getSheet() {
  if (_sheet) return _sheet; // 워밍된 인스턴스 재사용
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  // 헤더가 없으면(빈 시트) 헤더 행을 만든다
  try {
    await sheet.loadHeaderRow();
  } catch {
    await sheet.setHeaderRow(HEADERS);
  }
  _sheet = sheet;
  return sheet;
}

export function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

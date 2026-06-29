import { getSheet, json } from "./lib/sheets.mjs";

/* 어드민 조회. 비밀번호는 클라이언트가 아니라 여기(서버)에서 검증한다.
 * 요청 헤더 x-admin-key 를 env ADMIN_KEY 와 대조해 일치할 때만 데이터 반환.
 * 불일치 → 401. 이렇게 해야 비번이 클라이언트 코드에 노출되지 않는다. */
export const handler = async (event) => {
  const key = event.headers["x-admin-key"] || event.headers["X-Admin-Key"] || "";
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return json(401, { error: "unauthorized" });
  }

  try {
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    const responses = rows
      .map((r) => {
        try { return JSON.parse(r.get("data")); } catch { return null; }
      })
      .filter(Boolean);
    return json(200, { responses });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};

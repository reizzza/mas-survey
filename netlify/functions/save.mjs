import { getSheet, json } from "./lib/sheets.mjs";

/* 설문 진행 중 증분 저장.
 * 클라이언트가 매 스텝마다 { participantId, step, data(전체 상태) }를 POST.
 * participantId가 이미 있으면 그 행을 갱신, 없으면 새 행 추가(upsert).
 * 마지막 스텝(done) 도달 시 completed=1. */
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const { participantId, step, data } = body;
  if (!participantId) return json(400, { error: "participantId required" });

  try {
    const sheet = await getSheet();
    const rows = await sheet.getRows();
    const existing = rows.find((r) => r.get("participantId") === participantId);

    const rowData = {
      participantId,
      updatedAt: new Date().toISOString(),
      context: data?.context || "",
      step: step || "",
      completed: step === "done" ? 1 : 0,
      comprehensionCorrect: data?.comprehension?.correct ? 1 : 0,
      data: JSON.stringify(data || {}),
    };

    if (existing) {
      for (const [k, v] of Object.entries(rowData)) existing.set(k, v);
      await existing.save();
    } else {
      await sheet.addRow(rowData);
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};

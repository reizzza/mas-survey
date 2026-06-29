import React, { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

/* =========================================================================
 *  MAS 정당성 연구 — 어드민 통계 대시보드  (배포 시 /admin 경로에 연결)
 *
 *  접근 제어 (2층):
 *   1) 화면 비밀번호 게이트 = 우연한 접근 차단용 (그 자체로는 보안 아님)
 *   2) 진짜 보안 = 데이터를 주는 Netlify Function이 서버에서 비번 검증.
 *      입력한 비번은 클라이언트가 판정하지 않고 Function에 실어 보내고,
 *      서버가 env var(ADMIN_KEY)와 대조해 맞을 때만 응답 데이터를 반환.
 *
 *  데이터 없음 → "아직 응답이 없습니다" 빈 상태 표시.
 * ========================================================================= */

const T = {
  ink: "#191F28", body: "#4E5968", sub: "#8B95A1",
  line: "#E5E8EB", bg: "#F9FAFB", card: "#FFFFFF", red: "#EB5757",
  font: "'Pretendard','Apple SD Gothic Neo',-apple-system,BlinkMacSystemFont,sans-serif",
};
const COND_COLOR = { A: "#3182F6", B: "#F2994A", C1: "#2D9D78", C2: "#EB5757" };
const COND_ORDER = ["A", "B", "C1", "C2"];
const CONTEXTS = ["personal", "workplace", "public"];
const CONTEXT_LABEL = { personal: "개인", workplace: "직장", public: "공공" };

/* ── 통계 helper ── */
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const variance = (a) => { const m = mean(a); return a.length > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : 0; };
const round1 = (x) => x == null ? null : Math.round(x * 10) / 10;
const r1 = (x) => x == null ? "—" : x.toFixed(1);
function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const sp = Math.sqrt(((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2));
  return sp ? (mean(a) - mean(b)) / sp : 0;
}
function scaleScore(answers, prefix, count) {
  const v = []; for (let i = 1; i <= count; i++) { const x = answers[prefix + i]; if (x != null) v.push(x); }
  return mean(v);
}
const mcCorrectIdx = (code) => code === "A" ? 0 : code === "B" ? 1 : 2;

/* 조건별 참가자 점수 배열 */
function condScores(responses, code, scorer) {
  return responses.map((r) => r.scenes?.["cond_" + code]?.answers).filter(Boolean)
    .map(scorer).filter((x) => x != null);
}

/* ── 데모 데이터 (시연용) ── */
const PROFILE = {
  A:  { LEG: 5.8, ACC: 5.6, REP: 5.7, EMO1: 5.5, EMO2: 5.4, EMO3: 2.0, EMO4: 1.9, MED: null, MC1: 5.6, MCc: 0.92 },
  B:  { LEG: 3.6, ACC: 3.9, REP: 2.9, EMO1: 2.6, EMO2: 2.8, EMO3: 4.7, EMO4: 4.9, MED: null, MC1: 2.8, MCc: 0.85 },
  C1: { LEG: 5.5, ACC: 5.3, REP: 4.7, EMO1: 5.1, EMO2: 5.0, EMO3: 2.3, EMO4: 2.1, MED: 5.6, MC1: 5.4, MCc: 0.88 },
  C2: { LEG: 4.4, ACC: 4.2, REP: 4.0, EMO1: 3.1, EMO2: 3.5, EMO3: 3.9, EMO4: 4.2, MED: 4.6, MC1: 2.9, MCc: 0.83 },
};
function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const draw = (m, sd = 1.0) => Math.max(1, Math.min(7, Math.round(m + randn() * sd)));
function makeDemoResponses(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const context = CONTEXTS[i % 3];
    const completed = Math.random() > 0.12;
    const last = completed ? 4 : 1 + Math.floor(Math.random() * 3);
    const scenes = {};
    COND_ORDER.slice(0, last).forEach((code) => {
      const p = PROFILE[code];
      const a = {
        LEG1: draw(p.LEG), LEG2: draw(p.LEG), LEG3: draw(p.LEG),
        ACC1: draw(p.ACC), ACC2: draw(p.ACC), ACC3: draw(p.ACC),
        REP1: draw(p.REP), REP2: draw(p.REP), REP3: draw(p.REP), REP4: draw(p.REP),
        EMO1: draw(p.EMO1), EMO2: draw(p.EMO2), EMO3: draw(p.EMO3), EMO4: draw(p.EMO4),
        MC1: draw(p.MC1), MC2: Math.random() < p.MCc ? mcCorrectIdx(code) : Math.floor(Math.random() * 4),
        MC3: Math.floor(Math.random() * 4),
      };
      if (p.MED != null) { a.MED1 = draw(p.MED); a.MED2 = draw(p.MED); a.MED3 = draw(p.MED); }
      if (code === "B") { a.ATTR_B1 = draw(4.4); a.ATTR_B2 = draw(3.8); }
      if (code === "C2") { a.ATTR_C2_1 = draw(4.2); a.ATTR_C2_2 = draw(4.0); }
      scenes["cond_" + code] = { conditionCode: code, answers: a };
    });
    out.push({ participantId: "id_" + Math.random().toString(36).slice(2, 8), context, completed, comprehension: { correct: Math.random() > 0.1 }, scenes });
  }
  return out;
}

/* ── 집계 ── */
function aggregate(responses) {
  const byCond = {};
  COND_ORDER.forEach((code) => {
    const rows = responses.map((r) => r.scenes?.["cond_" + code]?.answers).filter(Boolean);
    const n = rows.length;
    byCond[code] = {
      n,
      LEG: mean(rows.map((a) => scaleScore(a, "LEG", 3)).filter((x) => x != null)),
      ACC: mean(rows.map((a) => scaleScore(a, "ACC", 3)).filter((x) => x != null)),
      REP: mean(rows.map((a) => scaleScore(a, "REP", 4)).filter((x) => x != null)),
      EMO1: mean(rows.map((a) => a.EMO1).filter((x) => x != null)),
      EMO2: mean(rows.map((a) => a.EMO2).filter((x) => x != null)),
      EMO3: mean(rows.map((a) => a.EMO3).filter((x) => x != null)),
      EMO4: mean(rows.map((a) => a.EMO4).filter((x) => x != null)),
      MED: mean(rows.map((a) => scaleScore(a, "MED", 3)).filter((x) => x != null)),
      MC1: mean(rows.map((a) => a.MC1).filter((x) => x != null)),
      MC2correct: n ? rows.filter((a) => a.MC2 === mcCorrectIdx(code)).length / n : null,
      ATTR_B1: mean(rows.map((a) => a.ATTR_B1).filter((x) => x != null)),
      ATTR_B2: mean(rows.map((a) => a.ATTR_B2).filter((x) => x != null)),
      ATTR_C2_1: mean(rows.map((a) => a.ATTR_C2_1).filter((x) => x != null)),
      ATTR_C2_2: mean(rows.map((a) => a.ATTR_C2_2).filter((x) => x != null)),
    };
  });
  const total = responses.length;
  const completed = responses.filter((r) => r.completed).length;
  const byContext = {}; CONTEXTS.forEach((c) => { byContext[c] = responses.filter((r) => r.context === c).length; });
  const compCorrect = mean(responses.map((r) => (r.comprehension?.correct ? 1 : 0)));

  /* 채택 출처 효과크기 (유불리 통제): 유리 A vs C1, 불리 B vs C2 */
  const legOf = (a) => scaleScore(a, "LEG", 3), accOf = (a) => scaleScore(a, "ACC", 3);
  const eff = {
    favorable: { LEG: cohensD(condScores(responses, "A", legOf), condScores(responses, "C1", legOf)), ACC: cohensD(condScores(responses, "A", accOf), condScores(responses, "C1", accOf)) },
    unfavorable: { LEG: cohensD(condScores(responses, "B", legOf), condScores(responses, "C2", legOf)), ACC: cohensD(condScores(responses, "B", accOf), condScores(responses, "C2", accOf)) },
  };
  return { byCond, total, completed, byContext, compCorrect, eff };
}

/* ── CSV 내보내기 (wide) ── */
function toCSV(responses) {
  const itemCols = ["LEG1", "LEG2", "LEG3", "ACC1", "ACC2", "ACC3", "REP1", "REP2", "REP3", "REP4", "MED1", "MED2", "MED3", "EMO1", "EMO2", "EMO3", "EMO4", "ATTR_B1", "ATTR_B2", "ATTR_C2_1", "ATTR_C2_2", "MC1", "MC2", "MC3"];
  const header = ["participantId", "context", "completed", "comprehension_correct"];
  COND_ORDER.forEach((c) => itemCols.forEach((it) => header.push(`${c}_${it}`)));
  const lines = [header.join(",")];
  responses.forEach((r) => {
    const row = [r.participantId, r.context, r.completed ? 1 : 0, r.comprehension?.correct ? 1 : 0];
    COND_ORDER.forEach((c) => {
      const a = r.scenes?.["cond_" + c]?.answers || {};
      itemCols.forEach((it) => row.push(a[it] != null ? a[it] : ""));
    });
    lines.push(row.join(","));
  });
  return lines.join("\n");
}
function downloadCSV(responses) {
  const blob = new Blob(["\uFEFF" + toCSV(responses)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `mas_responses_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ── UI 조각 ── */
function Card({ children, style }) { return <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, ...style }}>{children}</div>; }
function Metric({ label, value, sub }) {
  return <Card><div style={{ fontSize: 13, color: T.sub, marginBottom: 8 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, color: T.ink, letterSpacing: "-0.02em" }}>{value}</div>{sub && <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>{sub}</div>}</Card>;
}
function SectionTitle({ children, hint }) {
  return <div style={{ margin: "8px 0 16px" }}><h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, margin: 0 }}>{children}</h2>{hint && <p style={{ fontSize: 13, color: T.sub, margin: "4px 0 0", lineHeight: 1.5 }}>{hint}</p>}</div>;
}
const axis = { fontSize: 12, fill: T.sub, fontFamily: T.font };
const tip = { fontSize: 13, borderRadius: 10, border: `1px solid ${T.line}`, fontFamily: T.font };
const dLabel = (d) => d == null ? "—" : `d = ${d >= 0 ? "+" : ""}${d.toFixed(2)}`;

/* ── 비밀번호 게이트 ── */
function PasswordGate({ onSubmit, error, loading }) {
  const [pw, setPw] = useState("");
  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.ink, margin: "0 0 8px" }}>연구자 전용</h1>
        <p style={{ fontSize: 14, color: T.sub, margin: "0 0 20px", lineHeight: 1.6 }}>응답 통계를 보려면 비밀번호를 입력해 주세요.</p>
        <input
          type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(pw); }}
          placeholder="비밀번호"
          style={{ width: "100%", padding: "14px 16px", fontSize: 16, fontFamily: T.font, color: T.ink, border: `1.5px solid ${T.line}`, borderRadius: 12, boxSizing: "border-box", outline: "none", marginBottom: 12 }}
        />
        {error && <p style={{ fontSize: 13, color: T.red, margin: "0 0 12px" }}>{error}</p>}
        <button onClick={() => onSubmit(pw)} disabled={loading || !pw}
          style={{ width: "100%", padding: 15, fontSize: 16, fontWeight: 600, fontFamily: T.font, color: "#fff", border: "none", borderRadius: 12, background: (loading || !pw) ? "#C9CDD2" : T.ink, cursor: (loading || !pw) ? "default" : "pointer" }}>
          {loading ? "확인 중…" : "입장"}
        </button>
      </Card>
    </div>
  );
}

/* ── 빈 상태 ── */
function EmptyState({ onDemo }) {
  return (
    <Card style={{ textAlign: "center", padding: "56px 24px" }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>아직 응답이 없습니다</div>
      <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.6, margin: "0 0 20px" }}>참가자 응답이 저장되면 이곳에 통계가 표시됩니다.</p>
      <button onClick={onDemo} style={{ padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: T.font, color: T.body, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, cursor: "pointer" }}>
        데모 데이터로 미리보기
      </button>
    </Card>
  );
}

/* ── 대시보드 본체 ── */
function Dashboard({ responses, onReload }) {
  const agg = useMemo(() => aggregate(responses), [responses]);
  const legAcc = COND_ORDER.map((c) => ({ cond: c, 정당성: round1(agg.byCond[c].LEG), 수용: round1(agg.byCond[c].ACC) }));
  const emo = COND_ORDER.map((c) => ({ cond: c, 만족: round1(agg.byCond[c].EMO1), 존중: round1(agg.byCond[c].EMO2), 분노: round1(agg.byCond[c].EMO3), 억울: round1(agg.byCond[c].EMO4) }));
  const mc1 = COND_ORDER.map((c) => ({ cond: c, MC1: round1(agg.byCond[c].MC1) }));
  const mc2 = COND_ORDER.map((c) => ({ cond: c, 정답률: agg.byCond[c].MC2correct == null ? 0 : Math.round(agg.byCond[c].MC2correct * 100) }));
  const ctx = CONTEXTS.map((c) => ({ name: CONTEXT_LABEL[c], n: agg.byContext[c] }));
  const attrB = [
    { name: "My 대리실패", v: round1(agg.byCond.B.ATTR_B1) },
    { name: "Other 우수성", v: round1(agg.byCond.B.ATTR_B2) },
  ];
  const attrC2 = [
    { name: "중립 판단", v: round1(agg.byCond.C2.ATTR_C2_1) },
    { name: "중재자 책임", v: round1(agg.byCond.C2.ATTR_C2_2) },
  ];

  return (
    <>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: "-0.02em" }}>MAS 정당성 연구 · 응답 현황</h1>
          <p style={{ fontSize: 13, color: T.sub, margin: "6px 0 0" }}>채택 출처 × 유불리 4조건 (A / B / C1 / C2) · 맥락 3종</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onReload} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: T.font, color: T.body, background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, cursor: "pointer" }}>새로고침</button>
          <button onClick={() => downloadCSV(responses)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: T.font, color: "#fff", background: T.ink, border: "none", borderRadius: 10, cursor: "pointer" }}>CSV 내보내기</button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        <Metric label="총 응답" value={`${agg.total}명`} />
        <Metric label="완료" value={`${agg.completed}명`} sub={`완료율 ${Math.round(agg.completed / agg.total * 100)}%`} />
        <Metric label="진행 중 / 이탈" value={`${agg.total - agg.completed}명`} />
        <Metric label="이해확인 정답률" value={`${Math.round(agg.compCorrect * 100)}%`} sub="My Agent 역할 문항" />
      </div>

      {/* 채택 출처 효과크기 */}
      <SectionTitle hint="유불리를 통제하고 '누가 채택했는가(My/Other vs Mediator)'의 효과만 본 Cohen's d. 불리 조건 비교(B vs C2)가 연구 핵심 — 중재자 채택이 불리 결과의 정당성을 받쳐주는지.">
        채택 출처 효과크기
      </SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 28 }}>
        <Card>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 6 }}>유리 조건 · A(My) vs C1(중재)</div>
          <div style={{ display: "flex", gap: 20 }}>
            <div><div style={{ fontSize: 12, color: T.sub }}>정당성</div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{dLabel(agg.eff.favorable.LEG)}</div></div>
            <div><div style={{ fontSize: 12, color: T.sub }}>수용</div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{dLabel(agg.eff.favorable.ACC)}</div></div>
          </div>
        </Card>
        <Card style={{ borderColor: "#F2C94C" }}>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 6 }}>불리 조건 · B(Other) vs C2(중재) <b style={{ color: "#B26A00" }}>핵심</b></div>
          <div style={{ display: "flex", gap: 20 }}>
            <div><div style={{ fontSize: 12, color: T.sub }}>정당성</div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{dLabel(agg.eff.unfavorable.LEG)}</div></div>
            <div><div style={{ fontSize: 12, color: T.sub }}>수용</div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{dLabel(agg.eff.unfavorable.ACC)}</div></div>
          </div>
        </Card>
      </div>

      {/* LEG vs ACC */}
      <SectionTitle hint="유리(A·C1)는 높고 불리(B·C2)는 낮은 게 기대. 정당성–수용 막대 간격이 두 구인의 해리를 보여줌.">조건별 정당성(LEG) · 수용(ACC)</SectionTitle>
      <Card style={{ marginBottom: 28 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={legAcc} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
            <XAxis dataKey="cond" tick={axis} tickLine={false} axisLine={{ stroke: T.line }} />
            <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} tick={axis} tickLine={false} axisLine={false} />
            <ReferenceLine y={4} stroke={T.sub} strokeDasharray="4 4" />
            <Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 13, fontFamily: T.font }} />
            <Bar dataKey="정당성" fill="#3182F6" radius={[4, 4, 0, 0]} maxBarSize={44} />
            <Bar dataKey="수용" fill="#A5C8F5" radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* EMO */}
      <SectionTitle hint="불리 조건의 분노·억울 상승, 특히 B(상대 채택) vs C2(중재자 채택)의 억울 차이 비교.">조건별 정서 반응 (EMO)</SectionTitle>
      <Card style={{ marginBottom: 28 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={emo} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
            <XAxis dataKey="cond" tick={axis} tickLine={false} axisLine={{ stroke: T.line }} />
            <YAxis domain={[1, 7]} ticks={[1, 3, 5, 7]} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 13, fontFamily: T.font }} />
            <Bar dataKey="만족" fill="#2D9D78" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="존중" fill="#7BC4A8" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="분노" fill="#EB5757" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="억울" fill="#F2994A" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ATTR 귀인 */}
      <SectionTitle hint="불리 결과의 원인을 어디로 귀인하는지. B는 My/Other로, C2는 중립판단/중재자책임으로. C2에서 '중재자 책임' 귀인이 높으면 정당성 하락·억울 상승 경로.">
        불리 결과 귀인 (ATTR · B·C2만)
      </SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 28 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 12 }}>B · Other 채택 / 불리</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attrB} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: T.line }} />
              <YAxis domain={[1, 7]} ticks={[1, 4, 7]} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="v" name="평균" fill="#F2994A" radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 12 }}>C2 · Mediator 채택 / 불리</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attrC2} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: T.line }} />
              <YAxis domain={[1, 7]} ticks={[1, 4, 7]} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="v" name="평균" fill="#EB5757" radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 조작 확인 */}
      <SectionTitle hint="MC1: 유리(A·C1) 4 초과, 불리(B·C2) 4 미만이어야 조작 성공. MC2: 채택 출처 정답률 80% 이상 목표.">조작 확인</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 28 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 12 }}>MC1 · 유불리 지각 (기준선 4)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mc1} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="cond" tick={axis} tickLine={false} axisLine={{ stroke: T.line }} />
              <YAxis domain={[1, 7]} ticks={[1, 4, 7]} tick={axis} tickLine={false} axisLine={false} />
              <ReferenceLine y={4} stroke={T.ink} strokeDasharray="4 4" />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="MC1" radius={[4, 4, 0, 0]} maxBarSize={48}>{mc1.map((d) => <Cell key={d.cond} fill={COND_COLOR[d.cond]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 12 }}>MC2 · 채택 출처 정답률 (기준선 80%)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mc2} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="cond" tick={axis} tickLine={false} axisLine={{ stroke: T.line }} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 80, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
              <ReferenceLine y={80} stroke={T.ink} strokeDasharray="4 4" />
              <Tooltip contentStyle={tip} formatter={(v) => v + "%"} />
              <Bar dataKey="정답률" radius={[4, 4, 0, 0]} maxBarSize={48}>{mc2.map((d) => <Cell key={d.cond} fill={d.정답률 >= 80 ? "#2D9D78" : "#EB5757"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 맥락 분포 + 테이블 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, alignItems: "start" }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 12 }}>맥락별 응답 수</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ctx} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="n" fill="#8B95A1" radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ overflowX: "auto" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 12 }}>조건별 변수 평균 (1–7)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ color: T.sub, textAlign: "right" }}>
              <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 500 }}>조건</th>
              {["n", "LEG", "ACC", "REP", "만족", "존중", "분노", "억울", "MED"].map((h) => <th key={h} style={{ padding: "8px 6px", fontWeight: 500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {COND_ORDER.map((c) => { const d = agg.byCond[c]; return (
                <tr key={c} style={{ borderTop: `1px solid ${T.line}`, textAlign: "right", color: T.body }}>
                  <td style={{ textAlign: "left", padding: "10px 6px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COND_COLOR[c] }} /><span style={{ color: T.ink, fontWeight: 600 }}>{c}</span></span></td>
                  <td style={{ padding: "10px 6px" }}>{d.n}</td>
                  <td style={{ padding: "10px 6px", fontWeight: 600, color: T.ink }}>{r1(d.LEG)}</td>
                  <td style={{ padding: "10px 6px", fontWeight: 600, color: T.ink }}>{r1(d.ACC)}</td>
                  <td style={{ padding: "10px 6px" }}>{r1(d.REP)}</td>
                  <td style={{ padding: "10px 6px" }}>{r1(d.EMO1)}</td>
                  <td style={{ padding: "10px 6px" }}>{r1(d.EMO2)}</td>
                  <td style={{ padding: "10px 6px" }}>{r1(d.EMO3)}</td>
                  <td style={{ padding: "10px 6px" }}>{r1(d.EMO4)}</td>
                  <td style={{ padding: "10px 6px" }}>{r1(d.MED)}</td>
                </tr>); })}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: T.sub, margin: "12px 0 0", lineHeight: 1.5 }}>MED는 중재자 조건(C1·C2)에서만 측정 · ATTR(귀인)은 위 귀인 차트 참조</p>
        </Card>
      </div>
    </>
  );
}

/* ── 루트: 경로 가드 + 게이트 + 데이터 로드 ── */
export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminKey, setAdminKey] = useState(""); // 인증된 비번 보관 (새로고침용)

  const isAdminPath = typeof window !== "undefined" &&
    window.location.pathname.replace(/\/+$/, "").endsWith("/admin");

  /* 입력한 비번을 x-admin-key 헤더로만 전송. 일치 판정은 getResponses Function이 함. */
  const fetchResponses = async (pw) => {
    const res = await fetch("/.netlify/functions/getResponses", { headers: { "x-admin-key": pw } });
    if (res.status === 401) throw new Error("비밀번호가 올바르지 않습니다.");
    if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
    const { responses } = await res.json();
    return responses || [];
  };

  const authenticate = async (pw) => {
    setLoading(true); setError("");
    try {
      const data = await fetchResponses(pw);
      setAdminKey(pw); setResponses(data); setAuth(true);
    } catch (e) { setError(e.message || "확인에 실패했습니다."); }
    finally { setLoading(false); }
  };

  const reload = async () => {
    setError("");
    try { setResponses(await fetchResponses(adminKey)); }
    catch (e) { setError(e.message || "새로고침에 실패했습니다."); }
  };

  if (!auth) return <PasswordGate onSubmit={authenticate} error={error} loading={loading} />;

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh", padding: "28px 24px 60px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {!isAdminPath && (
          <div style={{ fontSize: 12, color: "#B26A00", background: "#FFF4E0", padding: "8px 14px", borderRadius: 10, marginBottom: 16 }}>
            개발 미리보기 — 배포 시 이 페이지를 <b>/admin</b> 경로에 연결하세요.
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: T.red, background: "#FFF4F4", padding: "10px 14px", borderRadius: 10, marginBottom: 16 }}>{error}</div>
        )}
        {responses.length === 0
          ? <EmptyState onDemo={() => setResponses(makeDemoResponses(120))} />
          : <Dashboard responses={responses} onReload={reload} />}
      </div>
    </div>
  );
}

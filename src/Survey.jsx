import React, { useState, useEffect, useRef } from "react";

/* =========================================================================
 *  MAS 정당성 인식 연구 — 설문 툴 프로토타입
 *  디자인: Toss 스타일 (한 화면 한 메시지 / 풀폭 하단 CTA / 넉넉한 여백)
 *
 *  ※ 이 파일은 "화면 단위 컴포넌트 구조 + 토스 스타일" 확인용 프로토타입.
 *    데이터 저장(Google Sheets / Netlify Functions)은 saveProgress() stub으로
 *    표시만 해두었고, 실제 연동은 다음 단계에서 붙입니다.
 * ========================================================================= */

/* ---------------------------------------------------------------- 디자인 토큰 */
const T = {
  /* UI 크롬은 무채색 블랙톤으로 통일.
   * 파랑·주황은 스토리보드의 대립 에이전트 색으로만 쓸 예정이라
   * 버튼/라벨/선택 강조에서 색을 완전히 제거해 결과 오염을 방지. */
  blue: "#202124",       // 강조(버튼·선택 테두리/텍스트) — 무채색 블랙톤
  blueDark: "#000000",   // hover/press
  blueSoft: "#EDEEF0",   // 선택 배경 — 무채색
  ink: "#191F28",        // 큰 제목
  body: "#4E5968",       // 본문
  sub: "#8B95A1",        // 보조/라벨
  line: "#E5E8EB",
  bgGray: "#F9FAFB",
  cardGray: "#F2F4F6",
  white: "#FFFFFF",
  red: "#F04452",
  green: "#15803D",
  font: "'Pretendard','Apple SD Gothic Neo',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif",
};

/* ---------------------------------------------------------------- 스텝 정의 */
const STEPS = [
  "start", "consent",
  "briefing", "comprehension",
  "assign",
  "preSurvey",
  "scene1", "scene2", "scene3", "scene4",
  "contextChecks",
  "done",
];

/* 맥락 매핑: 화면엔 A/B/C, 저장엔 매핑값 (라벨 숨김 원칙) */
const CONTEXT_MAP = { A: "personal", B: "workplace", C: "public" };

/* ---------------------------------------------------------------- Pre-survey 문항 */
const LIKERT_7 = { min: "전혀 그렇지 않다", max: "매우 그렇다" };

const PRE_SURVEY_LIKERT = [
  { id: "AIEXP1", text: "생성형 AI 또는 AI 기반 서비스를 얼마나 자주 사용하십니까?", anchors: { min: "거의 안 씀", max: "매우 자주" } },
  { id: "AIEXP2", text: "AI가 나를 대신해 추천·선택·조정하는 상황을 경험해 본 적이 있다.", anchors: LIKERT_7 },
  { id: "PRE_TR1", text: "나는 일반적으로 AI 시스템의 판단을 신뢰하는 편이다.", anchors: LIKERT_7 },
  { id: "PRE_TR2", text: "AI 시스템은 대체로 일관된 판단을 내릴 수 있다고 생각한다.", anchors: LIKERT_7 },
  { id: "PRE_ID1", text: "나를 대신해 행동하는 AI 에이전트는 나의 입장을 대표할 수 있다고 느낀다.", anchors: LIKERT_7 },
  { id: "PRE_ID2", text: "My Agent가 좋은 결과를 얻으면 나도 성취감을 느낄 것 같다.", anchors: LIKERT_7 },
  { id: "PRE_ID3", text: "My Agent가 선택되지 않으면, 나의 입장도 반영되지 않은 것처럼 느껴질 것 같다.", anchors: LIKERT_7 },
  { id: "PRE_ID4", text: "My Agent의 판단은 나 자신의 판단처럼 느껴질 수 있다.", anchors: LIKERT_7 },
  { id: "PRE_ID5", text: "My Agent가 선택한 결과는 내가 선택한 결과처럼 느껴질 수 있다.", anchors: LIKERT_7 },
];

const GENDER_OPTS = ["여성", "남성", "응답하지 않음"];
const EDU_OPTS = ["고졸 이하", "대학 재학", "대학 졸업", "대학원 이상"];

/* ---------------------------------------------------------------- Context Checks */
const CONTEXT_CHECKS = [
  { id: "CXT1", text: "이 상황에서는 개인적 관계와 상대에 대한 배려가 중요하게 느껴졌다." },
  { id: "CXT2", text: "이 상황에서는 역할, 책임, 업무상 기준이 중요하게 느껴졌다." },
  { id: "CXT3", text: "이 상황에서는 공공 자원이나 기회의 공정한 배분이 중요하게 느껴졌다." },
];

/* ---------------------------------------------------------------- 용어 정의 (툴팁 공용) */
const TERMS = {
  "My Agent": "당신의 상황과 입장을 대신 설명하고 제안하는 AI",
  "Other Agent": "상대방의 상황과 입장을 대신 설명하고 제안하는 AI",
  "Mediator Agent": "두 에이전트의 제안을 비교하고 최종 판단을 제시하는 AI",
};

/* ----------------------------------------------------------------------------
 *  조건 모델 (within-subjects, 고정 순서)
 *  ※ 맥락(personal/workplace/public)과는 다른 축. 조건 코드 A/B/C1/C2는 내부용.
 *  ORDER 배열만 바꾸면 제시 순서가 바뀜. (현재: 의도된 고정 순서 가정)
 * -------------------------------------------------------------------------- */
const CONDITIONS = {
  A:  { code: "A",  source: "my",       favor: "favorable",   mediator: false, label: "My Agent 채택 · 유리" },
  B:  { code: "B",  source: "other",    favor: "unfavorable", mediator: false, label: "Other Agent 채택 · 불리" },
  C1: { code: "C1", source: "mediator", favor: "favorable",   mediator: true,  label: "Mediator 채택 · 유리" },
  C2: { code: "C2", source: "mediator", favor: "unfavorable", mediator: true,  label: "Mediator 채택 · 불리" },
};
const CONDITION_ORDER = ["A", "B", "C1", "C2"]; // 고정 순서

/* 스토리보드 placeholder — 실제 시나리오 텍스트는 맥락×조건별로 추후 주입.
 * 키: `${context}_${conditionCode}` 형태로 확장 예정. 지금은 조건별 공용 placeholder. */
/* 스토리보드 텍스트 + 이미지 경로 — 맥락×조건별로 확장 예정.
 * 이미지 공급 방식이 정해지면 stageImg / resultImg 값만 채우면 됨
 *   - base64:  "data:image/png;base64,...."
 *   - 배포경로: "/assets/cond_A_stage.png"
 * null이면 이미지 자리에 placeholder 박스가 표시됨. */
const IMG_PERSONAL = {
  stage: [
    "/assets/Personal_stage1.jpg",
    "/assets/Personal_stage2.jpg",
    "/assets/Personal_stage3.jpg",
    "/assets/Personal_stage4.jpg",
  ],
  resultA: "/assets/Personal_resultA.jpg",
  resultB: "/assets/Personal_resultB.jpg",
  resultC1: "/assets/Personal_resultC1.jpg",
  resultC2: "/assets/Personal_resultC2.jpg",
};

const IMG_WORKPLACE = {
  stage: [
    "/assets/Workplace_stage1.jpg",
    "/assets/Workplace_stage2.jpg",
    "/assets/Workplace_stage3.jpg",
    "/assets/Workplace_stage4.jpg",
  ],
  resultA: "/assets/Workplace_resultA.jpg",
  resultB: "/assets/Workplace_resultB.jpg",
  resultC1: "/assets/Workplace_resultC1.jpg",
  resultC2: "/assets/Workplace_resultC2.jpg",
};

const IMG_PUBLIC = {
  stage: [
    "/assets/Public_stage1.jpg",
    "/assets/Public_stage2.jpg",
    "/assets/Public_stage3.jpg",
    "/assets/Public_stage4.jpg",
  ],
  resultA: "/assets/Public_resultA.jpg",
  resultB: "/assets/Public_resultB.jpg",
  resultC1: "/assets/Public_resultC1.jpg",
  resultC2: "/assets/Public_resultC2.jpg",
};

const IMAGES_BY_CONTEXT = {
  personal: IMG_PERSONAL,
  workplace: IMG_WORKPLACE,
  public: IMG_PUBLIC,
};

const SCENE_TEXT = {
  A:  { outcome: "My Agent 제안이 채택되어 유리한 결과" },
  B:  { outcome: "Other Agent 제안이 채택되어 불리한 결과" },
  C1: { outcome: "Mediator 판단으로 유리한 결과" },
  C2: { outcome: "Mediator 판단으로 불리한 결과" },
};

/* 맥락별 갈등 상황 도입 텍스트 (살펴보기 화면 제목 밑에 표시) */
const CONTEXT_INTRO = {
  personal: [
    "당신과 룸메이트는 각각 자신을 대리하는 AI 에이전트를 사용하고 있습니다. 두 사람은 평소에도 거실 TV 사용 시간을 서로 조율하며 사용해 왔습니다.",
    "거실에는 집에서 유일하게 대형 화면과 외부 음향 시스템이 연결된 TV가 있습니다. 두 사람 모두 해당 환경에서 실시간 방송을 시청하기 위해 미리 계획하고 있었습니다. 노트북이나 스마트폰으로도 시청은 가능하지만, 동일한 시청 경험을 제공하지는 않습니다.",
    "내일 저녁 같은 시간대에 당신과 룸메이트 모두 거실 TV를 사용하려고 합니다. 해당 시간에는 한 사람만 TV를 사용할 수 있습니다.",
  ],
  workplace: [
    "당신과 동료 C씨는 각각 자신을 대리하는 AI 에이전트를 사용하고 있습니다. 당신과 C씨는 같은 프로젝트 팀에서 일하고 있습니다.",
    "팀에는 대용량 데이터 분석 및 시뮬레이션 작업에 사용하는 고성능 GPU 서버가 한 대뿐입니다. 이 서버는 같은 시간에 한 사람만 사용할 수 있습니다. 일반 컴퓨터로도 작업은 가능하지만, 처리 시간이 크게 늘어나 예정된 일정 안에 결과물을 완성하기 어렵습니다.",
    "다음 주 월요일, 당신과 C씨 모두 같은 시간에 해당 서버를 사용하려고 합니다.",
  ],
  public: [
    "당신과 다른 주민 D씨는 각각 자신을 대리하는 AI 에이전트를 사용하고 있습니다. 당신이 거주하는 지역의 공공 주차장은 예약 시스템을 통해 운영됩니다.",
    "이 주차장은 지역 주민 누구나 동일한 기준으로 이용할 수 있는 공공시설이며, 같은 시간대에는 한 사람만 주차 공간을 사용할 수 있습니다.",
    "내일 오전 사용할 수 있는 주차 공간이 한 자리만 남아 있습니다. 당신과 D씨는 같은 시간대에 해당 주차 공간을 예약하려고 합니다.",
  ],
};

/* ----------------------------------------------------------------------------
 *  문항 레지스트리 — 모든 조건별 측정 문항 (실제 문항 텍스트)
 *  type: "likert"(1–7) | "choice"(객관식)
 * -------------------------------------------------------------------------- */
const ITEMS = {
  // Legitimacy
  LEG1: { type: "likert", text: "이번 결과는 정당하다고 느껴졌다.", anchors: LIKERT_7 },
  LEG2: { type: "likert", text: "이번 결과는 이 상황에서 적절한 판단이라고 느껴졌다.", anchors: LIKERT_7 },
  LEG3: { type: "likert", text: "이번 결과는 타당한 판단에 기반한 것이라고 느껴졌다.", anchors: LIKERT_7 },
  // Acceptance
  ACC1: { type: "likert", text: "나는 이 결과를 받아들일 수 있다.", anchors: LIKERT_7 },
  ACC2: { type: "likert", text: "실제 상황에서도 이 결과에 따를 의향이 있다.", anchors: LIKERT_7 },
  ACC3: { type: "likert", text: "결과가 마음에 들지 않더라도, 실제 상황에서는 이 결정에 따를 수 있다.", anchors: LIKERT_7 },
  // Representation
  REP1: { type: "likert", text: "My Agent는 나의 입장을 잘 대변했다고 느껴졌다.", anchors: LIKERT_7 },
  REP2: { type: "likert", text: "My Agent는 내가 중요하게 생각했을 기준을 잘 반영했다고 느껴졌다.", anchors: LIKERT_7 },
  REP3: { type: "likert", text: "My Agent는 나를 대신해 충분히 주장했을 것이라고 느껴졌다.", anchors: LIKERT_7 },
  REP4: { type: "likert", text: "My Agent가 제시한 입장과 이유는 나의 생각과 잘 맞는다고 느껴졌다.", anchors: LIKERT_7 },
  // Mediator Neutrality (C1/C2)
  MED1: { type: "likert", text: "Mediator Agent는 어느 한쪽 편도 들지 않았다고 느껴졌다.", anchors: LIKERT_7 },
  MED2: { type: "likert", text: "Mediator Agent는 양측의 입장과 상황을 균형 있게 고려했다고 느껴졌다.", anchors: LIKERT_7 },
  MED3: { type: "likert", text: "Mediator Agent는 My Agent와 Other Agent의 제안을 같은 기준으로 검토했다고 느껴졌다.", anchors: LIKERT_7 },
  // Affective Response
  EMO1: { type: "likert", text: "이 결과에 만족감을 느꼈다.", anchors: LIKERT_7 },
  EMO2: { type: "likert", text: "이 결과로 내 입장이 존중받았다고 느꼈다.", anchors: LIKERT_7 },
  EMO3: { type: "likert", text: "이 결과에 화가 났다.", anchors: LIKERT_7 },
  EMO4: { type: "likert", text: "이 결과가 억울하게 느껴졌다.", anchors: LIKERT_7 },
  // Attribution — B
  ATTR_B1: { type: "likert", text: "이 결과는 My Agent가 나의 입장을 충분히 대변하지 못했기 때문이라고 느껴졌다.", anchors: LIKERT_7 },
  ATTR_B2: { type: "likert", text: "이 결과는 Other Agent의 제안이 더 타당했기 때문이라고 느껴졌다.", anchors: LIKERT_7 },
  // Attribution — C2
  ATTR_C2_1: { type: "likert", text: "이 결과는 Mediator Agent가 Other Agent의 제안을 더 타당하다고 보았기 때문이라고 느껴졌다.", anchors: LIKERT_7 },
  ATTR_C2_2: { type: "likert", text: "이 결과는 Mediator Agent가 My Agent의 입장을 충분히 고려하지 않았기 때문이라고 느껴졌다.", anchors: LIKERT_7 },
  // Manipulation checks (각 조건 끝)
  MC1: { type: "likert", text: "최종 결과는 나에게 유리하게 느껴졌다.", anchors: { min: "전혀 유리하지 않음", max: "매우 유리함" } },
  MC2: { type: "choice", text: "시나리오에서 최종적으로 채택된 것은 누구의 제안 또는 판단이었습니까?", options: ["My Agent", "Other Agent", "Mediator Agent", "잘 모르겠다"] },
  MC3: { type: "choice", text: "최종 결과는 누구의 입장을 가장 많이 반영한 것처럼 느껴졌습니까?", options: ["나의 입장", "상대방의 입장", "중재자의 독립적 판단", "잘 모르겠다"] },
};

/* 조건별 문항 조립 — 문서 섹션 순서(LEG→ACC→REP→MED→EMO→ATTR→MC) 따름.
 * EMO를 결과 직후(즉각 정서)로 앞당기고 싶으면 이 순서만 조정. */
function surveyForCondition(code) {
  const ids = ["LEG1", "LEG2", "LEG3", "ACC1", "ACC2", "ACC3", "REP1", "REP2", "REP3", "REP4"];
  if (code === "C1" || code === "C2") ids.push("MED1", "MED2", "MED3");
  ids.push("EMO1", "EMO2", "EMO3", "EMO4");
  if (code === "B") ids.push("ATTR_B1", "ATTR_B2");
  if (code === "C2") ids.push("ATTR_C2_1", "ATTR_C2_2");
  ids.push("MC1", "MC2", "MC3"); // 항상 마지막
  return ids;
}

/* ============================================================ 공용 UI 컴포넌트 */

function StepShell({ label, title, children, footer }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: T.white }}>
      <div style={{ flex: 1, padding: "32px 24px 24px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {label && (
          <div style={{ fontSize: 14, fontWeight: 600, color: T.sub, marginBottom: 12 }}>{label}</div>
        )}
        {title && (
          <h1 style={{ fontSize: 24, lineHeight: 1.35, fontWeight: 700, color: T.ink, margin: "0 0 28px", letterSpacing: "-0.02em", whiteSpace: "pre-line" }}>
            {title}
          </h1>
        )}
        {children}
      </div>
      {footer && (
        <div style={{ position: "sticky", bottom: 0, background: T.white, borderTop: `1px solid ${T.line}`, padding: "12px 24px 20px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>{footer}</div>
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "16px", fontSize: 17, fontWeight: 600,
        fontFamily: T.font, color: T.white, border: "none", borderRadius: 14,
        background: disabled ? "#C9CDD2" : T.blue, cursor: disabled ? "default" : "pointer",
        transition: "background .15s",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "16px", fontSize: 16, fontWeight: 600, fontFamily: T.font,
      color: T.body, border: "none", borderRadius: 14, background: T.cardGray, cursor: "pointer", marginTop: 8,
    }}>{children}</button>
  );
}

/* 7점 리커트 */
function LikertRow({ item, value, onChange }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: T.ink, lineHeight: 1.5, marginBottom: 14 }}>{item.text}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => {
          const on = value === n;
          return (
            <button key={n} onClick={() => onChange(n)} style={{
              flex: 1, aspectRatio: "1", border: on ? `2px solid ${T.blue}` : `1px solid ${T.line}`,
              background: on ? T.blueSoft : T.white, color: on ? T.blue : T.sub, borderRadius: 10,
              fontSize: 15, fontWeight: 600, fontFamily: T.font, cursor: "pointer",
            }}>{n}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: T.sub }}>
        <span>{item.anchors.min}</span><span>{item.anchors.max}</span>
      </div>
    </div>
  );
}

/* 객관식 (MC2 / MC3) */
function ChoiceRow({ item, value, onChange }) {
  const marks = ["①", "②", "③", "④", "⑤"];
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: T.ink, lineHeight: 1.5, marginBottom: 14 }}>{item.text}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {item.options.map((o, i) => {
          const on = value === i;
          return (
            <button key={i} onClick={() => onChange(i)} style={{
              textAlign: "left", padding: "14px 16px", borderRadius: 12, fontFamily: T.font,
              border: on ? `1.5px solid ${T.blue}` : `1.5px solid ${T.line}`,
              background: on ? T.blueSoft : T.white, color: on ? T.blue : T.body,
              fontSize: 15, fontWeight: 500, cursor: "pointer", lineHeight: 1.5,
            }}>{marks[i]} {o}</button>
          );
        })}
      </div>
    </div>
  );
}

/* 문항 타입에 따라 적절한 렌더러로 분기 (invalid면 빨간 표시 + 스크롤 앵커) */
function ItemRow({ id, value, onChange, invalid }) {
  const item = ITEMS[id];
  if (!item) return null;
  const inner = item.type === "choice"
    ? <ChoiceRow item={item} value={value} onChange={onChange} />
    : <LikertRow item={item} value={value} onChange={onChange} />;
  return (
    <div id={`q-${id}`} style={invalid ? { borderLeft: `3px solid ${T.red}`, paddingLeft: 13, marginLeft: -16 } : undefined}>
      {invalid && <div style={{ fontSize: 12, color: T.red, marginBottom: 6 }}>이 문항에 답해 주세요</div>}
      {inner}
    </div>
  );
}

/* [?] 용어 복습 툴팁 — 모바일 대응으로 탭(클릭) 토글 */
function TermTooltip({ term, onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => { setOpen(!open); if (!open && onOpen) onOpen(term); }}
        style={{
          marginLeft: 4, width: 18, height: 18, borderRadius: "50%", border: "none",
          background: T.cardGray, color: T.sub, fontSize: 11, fontWeight: 700,
          cursor: "pointer", verticalAlign: "middle", lineHeight: "18px", padding: 0,
        }}
        aria-label={`${term} 설명`}
      >?</button>
      {open && (
        <span style={{
          position: "absolute", left: 0, top: 26, zIndex: 10, width: 220,
          background: T.ink, color: T.white, fontSize: 13, lineHeight: 1.5,
          padding: "10px 12px", borderRadius: 10, fontWeight: 400, boxShadow: "0 4px 16px rgba(0,0,0,.18)",
        }}>{TERMS[term]}</span>
      )}
    </span>
  );
}

/* ============================================================ 화면별 본문 */

function StartBody({ next }) {
  const notes = ["응답은 모두 익명으로 처리됩니다", "정답은 없으니 직관적으로 답해 주세요", "언제든 그만두실 수 있어요", "결과는 학술 연구에만 사용됩니다"];
  return (
    <StepShell
      label="시작 전"
      title={"AI의 판단을\n어떻게 받아들이는지\n들려주세요"}
      footer={<PrimaryButton onClick={next}>시작할게요</PrimaryButton>}
    >
      <p style={{ fontSize: 16, lineHeight: 1.7, color: T.body, margin: 0 }}>
        여러 AI가 사람을 대신해 의견을 내고,<br />그 결과가 어떻게 정해지는 장면을 보게 됩니다.<br />
        각 장면에서 느낀 점을 솔직하게 답해 주세요.
      </p>
      <p style={{ fontSize: 14, color: T.sub, margin: "20px 0 28px" }}>약 15~20분 소요</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notes.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", background: T.bgGray, borderRadius: 12, padding: "14px 16px" }}>
            <span style={{ color: T.blue, fontWeight: 700, fontSize: 16 }}>✓</span>
            <span style={{ fontSize: 14, color: T.body, fontWeight: 500 }}>{it}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, marginTop: 16 }}>
        본 조사는 다중 에이전트 시스템(MAS) 관련 학술 연구이며, 개인을 식별할 수 있는 정보는 수집하지 않습니다.
      </p>
    </StepShell>
  );
}

/* 동의서 본문 — 문단 단위 (소요시간만 채움, 나머지 [ ]는 연구자 입력 자리) */
const CONSENT_PARAGRAPHS = [
  "안녕하세요. 본 연구는 다중 AI 에이전트가 사용자를 대신해 의견을 제시하거나, 에이전트 간 의견 차이가 조정되는 상황에서 사람들이 최종 결과를 어떻게 평가하는지 알아보기 위한 연구입니다.",
  "본 연구에 참여하시면, 여러 개의 가상 시나리오를 읽고 각 상황에서 제시된 최종 결과에 대해 설문에 응답하시게 됩니다. 각 시나리오에는 사용자를 대신해 제안하는 My Agent, 상대방을 대신해 제안하는 Other Agent, 그리고 경우에 따라 두 제안을 비교하고 최종 판단을 제시하는 Mediator Agent가 등장합니다. 참가자께서는 제시된 상황과 최종 결과를 바탕으로, 그 결과가 얼마나 정당하게 느껴지는지, 받아들일 수 있는지, 각 AI 에이전트가 어떻게 느껴지는지 등을 평가하게 됩니다.",
  "본 연구의 예상 소요 시간은 약 15–20분입니다. 설문 종료 후 일부 참가자에게는 추가 인터뷰 참여를 요청드릴 수 있습니다.",
  "본 연구는 학술 연구 목적으로만 수행됩니다. 수집되는 자료는 익명으로 처리되며, 연구 목적 외의 용도로 사용되지 않습니다. 응답 자료에는 이름, 주민등록번호, 연락처 등 직접적인 개인 식별 정보가 포함되지 않습니다. 단, 인터뷰 참여 의사를 밝히는 경우 연락을 위한 정보가 별도로 수집될 수 있으며, 해당 정보는 설문 응답 자료와 분리하여 보관됩니다.",
  "본 연구 참여로 인해 예상되는 신체적 위험은 없습니다. 다만 일부 시나리오에서 불공정하거나 불리한 결과를 접하는 상황이 제시될 수 있어 일시적인 불편감이 있을 수 있습니다. 불편함을 느끼는 경우 언제든지 응답을 중단할 수 있습니다.",
  "연구 참여는 전적으로 자발적입니다. 참여를 원하지 않으시면 설문을 시작하지 않아도 되며, 참여 중에도 언제든지 중단하실 수 있습니다. 참여를 거부하거나 중단하더라도 어떠한 불이익도 없습니다. 단, 설문 제출 이후에는 응답이 익명화되어 특정 개인의 자료를 식별하거나 삭제하기 어려울 수 있습니다.",
  "수집된 자료는 연구 분석 및 학술 발표, 논문 작성에 활용될 수 있습니다. 연구 결과는 개인을 식별할 수 없는 집계된 형태로만 보고됩니다. 자료는 연구 종료 후 3년 또는 IRB 기준에 따른 기간 동안 안전하게 보관한 뒤 폐기됩니다.",
];

const CONSENT_CONTACT = [
  ["연구자", "김은서 / 이자은 / 신지현"],
  ["지도교수/책임연구자", "오창훈 / 하주혜"],
  ["소속", "연세대학교 정보대학원 / axlab"],
  ["문의처", "jaeunlee301@yonsei.ac.kr"],
];

const CONSENT_CHECKS = [
  { k: "c1", label: "나는 본 연구의 목적, 절차, 예상 소요 시간, 개인정보 처리 방식, 참여 중단 가능성에 대한 설명을 읽고 이해했습니다." },
  { k: "c2", label: "나는 연구 참여가 자발적이며, 언제든지 중단할 수 있음을 이해했습니다." },
  { k: "c3", label: "나는 본 연구에 참여하는 것에 동의합니다." },
];

function ConsentBody({ next, prev, data, set }) {
  const cs = data.consent || {};
  const toggle = (k) => set({ consent: { ...cs, [k]: !cs[k] } });
  const setChoice = (v) => set({ consent: { ...cs, choice: v } });
  const allChecked = CONSENT_CHECKS.every((c) => cs[c.k]);
  const canProceed = allChecked && cs.choice === "yes";

  return (
    <StepShell label="동의" title={"연구 참여 안내 및\n동의서"}
      footer={
        cs.choice === "no"
          ? <GhostButton onClick={() => setChoice(null)}>다시 선택</GhostButton>
          : <><PrimaryButton disabled={!canProceed} onClick={next}>다음</PrimaryButton><GhostButton onClick={prev}>이전</GhostButton></>
      }>
      {/* 안내 본문 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {CONSENT_PARAGRAPHS.map((p, i) => (
          <p key={i} style={{ fontSize: 14.5, lineHeight: 1.75, color: T.body, margin: 0 }}>{p}</p>
        ))}
      </div>

      {/* 연구자 정보 */}
      <div style={{ background: T.bgGray, borderRadius: 14, padding: "18px 20px", marginTop: 24 }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: T.body, margin: "0 0 12px" }}>
          본 연구에 대해 궁금한 점이 있거나 참여와 관련해 문의 사항이 있는 경우 아래로 연락하실 수 있습니다.
        </p>
        {CONSENT_CONTACT.map(([k, v]) => {
          const ph = v.startsWith("[");
          return (
            <div key={k} style={{ display: "flex", gap: 8, fontSize: 14, lineHeight: 1.9 }}>
              <span style={{ color: T.sub, minWidth: 120, flexShrink: 0 }}>{k}</span>
              <span style={{ color: ph ? "#B0B8C1" : T.ink, fontWeight: ph ? 400 : 500, fontStyle: ph ? "italic" : "normal" }}>{v}</span>
            </div>
          );
        })}
      </div>

      {/* 확인 체크 3개 */}
      <SectionLabel>아래 내용을 확인해 주세요</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CONSENT_CHECKS.map((c) => {
          const on = !!cs[c.k];
          return (
            <button key={c.k} onClick={() => toggle(c.k)} style={{
              width: "100%", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left",
              background: on ? T.blueSoft : T.bgGray, border: on ? `1.5px solid ${T.blue}` : "1.5px solid transparent",
              borderRadius: 12, padding: "16px 18px", cursor: "pointer", fontFamily: T.font,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                background: on ? T.blue : "#D1D6DB", color: T.white,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
              }}>✓</span>
              <span style={{ fontSize: 14, color: T.ink, fontWeight: 500, lineHeight: 1.6 }}>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* 참여 여부 단일선택 */}
      <SectionLabel>참여 여부를 선택해 주세요</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { v: "yes", mark: "①", label: "위 내용을 읽고 연구 참여에 동의합니다.", disabled: !allChecked },
          { v: "no", mark: "②", label: "연구 참여에 동의하지 않습니다.", disabled: false },
        ].map((o) => {
          const on = cs.choice === o.v;
          return (
            <button key={o.v} disabled={o.disabled} onClick={() => setChoice(o.v)} style={{
              textAlign: "left", padding: "16px 18px", borderRadius: 12, fontFamily: T.font,
              border: on ? `1.5px solid ${T.blue}` : `1.5px solid ${T.line}`,
              background: on ? T.blueSoft : T.white,
              color: o.disabled ? "#C9CDD2" : on ? T.blue : T.body,
              fontSize: 15, fontWeight: 500, cursor: o.disabled ? "default" : "pointer", lineHeight: 1.5,
            }}>{o.mark} {o.label}</button>
          );
        })}
      </div>
      {!allChecked && (
        <p style={{ fontSize: 13, color: T.sub, marginTop: 12 }}>위 세 항목을 모두 확인하셔야 참여에 동의하실 수 있어요.</p>
      )}
      {cs.choice === "no" && (
        <div style={{ background: "#FFF4F4", borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
          <p style={{ fontSize: 14, color: T.red, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
            참여에 동의하지 않으셨습니다. 설문을 진행하지 않으며, 창을 닫으셔도 됩니다. 참여를 원하시면 다시 선택을 눌러 주세요.
          </p>
        </div>
      )}
    </StepShell>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, margin: "32px 0 12px", letterSpacing: "0.02em" }}>{children}</div>;
}

function BriefingBody({ next, prev }) {
  return (
    <StepShell label="안내" title={"연구 안내"}
      footer={<><PrimaryButton onClick={next}>다음</PrimaryButton><GhostButton onClick={prev}>이전</GhostButton></>}>
      {/* 1. 보게 될 것 */}
      <p style={{ fontSize: 16, lineHeight: 1.7, color: T.body, margin: 0 }}>
        AI가 사람을 대신해 의견을 제시하는 상황을 보게 됩니다. 각 장면에서는 당신의 상황, 상대방의 상황,
        두 AI 에이전트의 제안, 그리고 최종 결과가 제시됩니다. 경우에 따라 최종 판단을 내리는 AI 중재자가 등장할 수 있습니다.
      </p>

      {/* 2. 등장하는 AI (용어표) */}
      <SectionLabel>등장하는 AI</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
        {Object.entries(TERMS).map(([term, def], i) => (
          <div key={term} style={{ padding: "16px 18px", borderTop: i ? `1px solid ${T.line}` : "none", background: T.white }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.blue, marginBottom: 4 }}>{term}</div>
            <div style={{ fontSize: 14, color: T.body, lineHeight: 1.5 }}>{def}</div>
          </div>
        ))}
      </div>

      {/* 3. My Agent 역할 */}
      <SectionLabel>My Agent의 역할</SectionLabel>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: T.body, margin: "0 0 14px" }}>
        <b style={{ color: T.ink }}>My Agent</b>는 당신의 상황과 기본 선호를 바탕으로 당신을 대신해 제안합니다.
        다음을 알고 있다고 가정해 주세요.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {["당신이 처한 상황", "당신이 원하는 결과", "그 결과가 필요한 이유"].map((x) => (
          <div key={x} style={{ background: T.bgGray, borderRadius: 12, padding: "13px 16px", fontSize: 14, color: T.body, fontWeight: 500 }}>{x}</div>
        ))}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: T.body, margin: 0 }}>
        각 장면에서 My Agent의 제안은 <b style={{ color: T.ink }}>"당신의 입장을 대신 설명하는 제안"</b>으로 이해해 주세요.
      </p>

      {/* 4. 응답 방법 */}
      <SectionLabel>응답할 때</SectionLabel>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: T.body, margin: "0 0 14px" }}>
        에이전트들이 내부적으로 어떤 절차를 거쳤는지 추측하실 필요는 없습니다. 과정이 자세히 제시되지 않는 것은 의도된 설정입니다.
      </p>
      <div style={{ background: T.blueSoft, borderRadius: 14, padding: "16px 18px" }}>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: T.ink, margin: 0, fontWeight: 500 }}>
          정답은 없습니다. 실제 상황이라면 어떻게 느꼈을지를 기준으로, 결과가 얼마나 정당하게 느껴지는지·받아들일 수
          있는지·각 AI가 역할을 어떻게 수행했다고 느껴지는지를 솔직하게 평가해 주세요.
        </p>
      </div>
    </StepShell>
  );
}

function ComprehensionBody({ next, prev, data, set }) {
  const options = [
    "나의 입장을 대신 설명하는 AI",
    "상대방의 입장을 대신 설명하는 AI",
    "최종 판단만 내리는 AI",
  ];
  const correctIdx = 0;
  const sel = data.comprehension?.selected;
  const choose = (i) => set({ comprehension: { selected: i, correct: i === correctIdx } });
  return (
    <StepShell label="안내" title={"잠깐,\n확인할게요"}
      footer={<><PrimaryButton disabled={sel == null} onClick={next}>다음</PrimaryButton><GhostButton onClick={prev}>이전</GhostButton></>}>
      <p style={{ fontSize: 16, color: T.ink, fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
        이 연구에서 My Agent의 역할은 무엇인가요?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((o, i) => {
          const on = sel === i;
          return (
            <button key={i} onClick={() => choose(i)} style={{
              textAlign: "left", padding: "16px 18px", borderRadius: 12, fontFamily: T.font,
              border: on ? `1.5px solid ${T.blue}` : `1.5px solid ${T.line}`,
              background: on ? T.blueSoft : T.white, color: on ? T.blue : T.body,
              fontSize: 15, fontWeight: 500, cursor: "pointer", lineHeight: 1.5,
            }}>{["①", "②", "③"][i]} {o}</button>
          );
        })}
      </div>
      {/* 정책: 오답이어도 통과시키되 correct 플래그만 기록. 화면엔 정오답 표시 안 함. */}
    </StepShell>
  );
}

function AssignBody({ next, prev, data, set }) {
  const [picked, setPicked] = useState(data.contextLabel || null);
  const confirm = () => { set({ contextLabel: picked, context: CONTEXT_MAP[picked] }); next(); };
  if (picked) {
    return (
      <StepShell label="배정" title={`${picked} 그룹으로\n시작합니다`}
        footer={<><PrimaryButton onClick={confirm}>시작하기</PrimaryButton><GhostButton onClick={() => setPicked(null)}>다시 선택</GhostButton></>}>
        <p style={{ fontSize: 16, color: T.body, lineHeight: 1.7 }}>
          연구자가 안내한 그룹이 <b style={{ color: T.ink }}>{picked}</b> 가 맞는지 확인해 주세요.
          맞다면 시작하기를, 아니라면 다시 선택을 눌러 주세요.
        </p>
      </StepShell>
    );
  }
  return (
    <StepShell label="배정" title={"안내받은 그룹을\n선택해 주세요"}
      footer={<GhostButton onClick={prev}>이전</GhostButton>}>
      <p style={{ fontSize: 14, color: T.sub, marginBottom: 20 }}>연구자가 알려드린 그룹의 버튼을 눌러 주세요.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {["A", "B", "C"].map((g) => (
          <button key={g} onClick={() => setPicked(g)} style={{
            padding: "22px", borderRadius: 16, border: `1.5px solid ${T.line}`, background: T.white,
            fontSize: 22, fontWeight: 700, color: T.ink, fontFamily: T.font, cursor: "pointer",
          }}>{g}</button>
        ))}
      </div>
    </StepShell>
  );
}

function PreSurveyBody({ next, prev, data, set }) {
  const r = data.preSurvey || {};
  const setItem = (id, v) => set({ preSurvey: { ...r, [id]: v } });
  const demoOk = r.DEM1 && r.DEM2 && r.DEM3;
  const likertOk = PRE_SURVEY_LIKERT.every((i) => r[i.id]);
  return (
    <StepShell label="사전 조사" title={"먼저 몇 가지를\n여쭤볼게요"}
      footer={<><PrimaryButton disabled={!(demoOk && likertOk)} onClick={next}>다음</PrimaryButton><GhostButton onClick={prev}>이전</GhostButton></>}>
      {PRE_SURVEY_LIKERT.map((item) => (
        <LikertRow key={item.id} item={item} value={r[item.id]} onChange={(v) => setItem(item.id, v)} />
      ))}

      {/* Demographics */}
      <div style={{ height: 1, background: T.line, margin: "8px 0 28px" }} />
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: T.ink, marginBottom: 10 }}>연령</div>
        <input inputMode="numeric" value={r.DEM1 || ""} onChange={(e) => setItem("DEM1", e.target.value.replace(/\D/g, ""))}
          placeholder="예: 27" style={{
            width: "100%", padding: "14px 16px", fontSize: 16, fontFamily: T.font, color: T.ink,
            border: `1.5px solid ${T.line}`, borderRadius: 12, boxSizing: "border-box", outline: "none",
          }} />
      </div>
      <ChoiceBlock label="성별" opts={GENDER_OPTS} value={r.DEM2} onChange={(v) => setItem("DEM2", v)} />
      <ChoiceBlock label="직업 또는 학력" opts={EDU_OPTS} value={r.DEM3} onChange={(v) => setItem("DEM3", v)} />
    </StepShell>
  );
}

function ChoiceBlock({ label, opts, value, onChange }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: T.ink, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {opts.map((o) => {
          const on = value === o;
          return (
            <button key={o} onClick={() => onChange(o)} style={{
              padding: "12px 18px", borderRadius: 999, fontFamily: T.font, fontSize: 15, fontWeight: 500,
              border: on ? `1.5px solid ${T.blue}` : `1.5px solid ${T.line}`,
              background: on ? T.blueSoft : T.white, color: on ? T.blue : T.body, cursor: "pointer",
            }}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

/* 비네트 이미지 — src 없으면 placeholder 박스 */
function VignetteImage({ src, label }) {
  if (src) {
    return <img src={src} alt={label} style={{ width: "100%", borderRadius: 0, display: "block", marginBottom: 20, border: `1px solid ${T.line}` }} />;
  }
  return (
    <div style={{
      width: "100%", aspectRatio: "4 / 3", borderRadius: 0, marginBottom: 20,
      background: T.cardGray, border: "1px dashed #C9CDD2", display: "flex",
      alignItems: "center", justifyContent: "center", color: T.sub, fontSize: 13,
      textAlign: "center", padding: 16, boxSizing: "border-box", lineHeight: 1.5,
    }}>{label}</div>
  );
}

function SceneBody({ conditionCode, index, next, prev, data, set, onTooltip }) {
  const cond = CONDITIONS[conditionCode];
  const scene = SCENE_TEXT[conditionCode];
  const imgset = IMAGES_BY_CONTEXT[data.context] || IMG_PERSONAL;
  const stageImgs = imgset.stage;
  const resultImg = imgset["result" + conditionCode];
  const key = `cond_${conditionCode}`;
  const r = data.scenes?.[key]?.answers || {};
  const [sub, setSub] = useState(0); // 0:살펴보기(상황~충돌)  1:결과  2:평가

  const itemIds = surveyForCondition(conditionCode);
  const mcStart = itemIds.indexOf("MC1");
  const mainItems = itemIds.slice(0, mcStart);
  const mcItems = itemIds.slice(mcStart);

  const setItem = (id, v) => set({
    scenes: {
      ...data.scenes,
      [key]: { conditionCode, order: index + 1, source: cond.source, favor: cond.favor, answers: { ...r, [id]: v } },
    },
  });
  const surveyOk = itemIds.every((id) => r[id] !== undefined);
  const [showErrors, setShowErrors] = useState(false);
  const missing = itemIds.filter((id) => r[id] === undefined);
  const handleNext = () => {
    if (missing.length === 0) { next(); return; }
    setShowErrors(true);
    const el = document.getElementById(`q-${missing[0]}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ── 서브스텝 0: 상황 → 제안 → 충돌 (이미지 4장 세로 나열) ── */
  if (sub === 0) {
    const terms = ["My Agent", "Other Agent", ...(cond.mediator ? ["Mediator Agent"] : [])];
    const intro = CONTEXT_INTRO[data.context] || [];
    return (
      <StepShell label={`상황 ${index + 1} / 4`} title={`상황 ${index + 1}`}
        footer={<><PrimaryButton onClick={() => setSub(1)}>결과 보기</PrimaryButton><GhostButton onClick={prev}>이전</GhostButton></>}>
        {intro.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {intro.map((p, i) => (
              <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: T.body, margin: 0 }}>{p}</p>
            ))}
          </div>
        )}
        {stageImgs.map((src, i) => (
          <VignetteImage key={i} src={src} label={`상황 이미지 ${i + 1}`} />
        ))}
        {/* 용어 복습 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 13, color: T.sub }}>용어 복습</span>
          {terms.map((t) => (
            <span key={t} style={{ fontSize: 13, color: T.body, background: T.bgGray, borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center" }}>
              {t}<TermTooltip term={t} onOpen={onTooltip} />
            </span>
          ))}
        </div>
      </StepShell>
    );
  }

  /* ── 서브스텝 1: 결과 (별도 화면, 결과 이미지) ── */
  if (sub === 1) {
    return (
      <StepShell label={`상황 ${index + 1} / 4`} title={"최종 결과"}
        footer={<><PrimaryButton onClick={() => setSub(2)}>평가하기</PrimaryButton><GhostButton onClick={() => setSub(0)}>이전</GhostButton></>}>
        <VignetteImage src={resultImg} label="결과 이미지" />
      </StepShell>
    );
  }

  /* ── 서브스텝 2: 평가 (결과 리캡 + 설문 + 조작확인) ── */
  return (
    <StepShell label={`상황 ${index + 1} / 4`} title={"이 결과에 대해"}
      footer={<><PrimaryButton onClick={handleNext}>{index === 3 ? "다음" : "다음 상황"}</PrimaryButton><GhostButton onClick={() => setSub(1)}>이전</GhostButton></>}>
      {/* 결과 리캡 — 회상 도움 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>방금 본 결과</div>
        {resultImg
          ? <img src={resultImg} alt="결과 리캡" style={{ width: "100%", borderRadius: 0, border: `1px solid ${T.line}`, display: "block" }} />
          : <div style={{ background: T.ink, color: T.white, borderRadius: 12, padding: 16, fontSize: 14, fontWeight: 600 }}>{scene.outcome}</div>}
      </div>
      <p style={{ fontSize: 14, color: T.sub, marginBottom: 20 }}>이 결과를 떠올리며 각 문장에 답해 주세요.</p>
      {mainItems.map((id) => <ItemRow key={id} id={id} value={r[id]} invalid={showErrors && r[id] === undefined} onChange={(v) => setItem(id, v)} />)}

      {/* 조작 확인 — 종속변수 응답 후 마지막 배치 */}
      <div style={{ height: 1, background: T.line, margin: "4px 0 24px" }} />
      {mcItems.map((id) => <ItemRow key={id} id={id} value={r[id]} invalid={showErrors && r[id] === undefined} onChange={(v) => setItem(id, v)} />)}
      {showErrors && missing.length > 0 && (
        <p style={{ fontSize: 13, color: T.red, marginTop: 8 }}>아직 답하지 않은 문항이 {missing.length}개 있어요. 빨간색으로 표시된 문항에 답해 주세요.</p>
      )}
    </StepShell>
  );
}

function ContextChecksBody({ next, prev, data, set }) {
  const r = data.contextChecks || {};
  const setItem = (id, v) => set({ contextChecks: { ...r, [id]: v } });
  const ok = CONTEXT_CHECKS.every((i) => r[i.id]);
  return (
    <StepShell label="마무리" title={"마지막으로\n여쭤볼게요"}
      footer={<><PrimaryButton disabled={!ok} onClick={next}>제출하기</PrimaryButton><GhostButton onClick={prev}>이전</GhostButton></>}>
      <p style={{ fontSize: 15, color: T.body, lineHeight: 1.6, marginBottom: 24 }}>
        앞서 본 상황들을 떠올리며, 각 문장에 얼마나 동의하는지 답해 주세요.
      </p>
      {CONTEXT_CHECKS.map((item) => <LikertRow key={item.id} item={item} value={r[item.id]} onChange={(v) => setItem(item.id, v)} />)}
    </StepShell>
  );
}

function DoneBody({ data }) {
  return (
    <StepShell label="완료" title={"조사가\n완료되었습니다"}>
      <p style={{ fontSize: 16, color: T.body, lineHeight: 1.7, marginBottom: 28 }}>
        소중한 응답에 감사드립니다. 본 조사는 다중 에이전트 시스템에서 사람이 AI의 판단을 어떻게 정당한 것으로
        받아들이는지에 대한 학술 연구입니다.
      </p>
      <div style={{ background: T.bgGray, borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>응답 ID</div>
        <div style={{ fontSize: 15, color: T.ink, fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all" }}>{data.participantId}</div>
      </div>
      {/* 개발용: 수집 데이터 미리보기 */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 13, color: T.sub, cursor: "pointer" }}>수집된 데이터 보기 (개발용)</summary>
        <pre style={{ fontSize: 11, background: T.cardGray, padding: 14, borderRadius: 10, overflow: "auto", color: T.body, marginTop: 10 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </StepShell>
  );
}

/* ============================================================ 루트 앱 */

export default function App() {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState(() => ({
    participantId: "id_" + Math.random().toString(36).slice(2, 10),
    contextLabel: null,   // 화면 표시용 A/B/C (맥락)
    context: null,        // 저장용 personal/workplace/public
    consent: {}, comprehension: {}, preSurvey: {}, scenes: {}, contextChecks: {},
    meta: { startedAt: Date.now(), tooltipOpens: [] },
  }));

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const onTooltip = (term) =>
    setData((d) => ({ ...d, meta: { ...d.meta, tooltipOpens: [...d.meta.tooltipOpens, { term, t: Date.now() }] } }));

  /* 증분 저장 — 스텝마다 전체 상태를 save Function으로 전송 (participantId upsert).
   * 저장 실패가 설문 진행을 막지 않도록 조용히 무시. */
  const saveProgress = (step) => {
    fetch("/.netlify/functions/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: data.participantId, step, data }),
    }).catch(() => {});
  };
  useEffect(() => { if (stepIdx > 0) saveProgress(STEPS[stepIdx]); }, [stepIdx]);

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));
  const step = STEPS[stepIdx];

  let body;
  if (step === "start") body = <StartBody next={next} />;
  else if (step === "consent") body = <ConsentBody next={next} prev={prev} data={data} set={set} />;
  else if (step === "briefing") body = <BriefingBody next={next} prev={prev} />;
  else if (step === "comprehension") body = <ComprehensionBody next={next} prev={prev} data={data} set={set} />;
  else if (step === "assign") body = <AssignBody next={next} prev={prev} data={data} set={set} />;
  else if (step === "preSurvey") body = <PreSurveyBody next={next} prev={prev} data={data} set={set} />;
  else if (step.startsWith("scene")) {
    const idx = Number(step.replace("scene", "")) - 1;
    const code = CONDITION_ORDER[idx];
    body = <SceneBody key={code} conditionCode={code} index={idx} next={next} prev={prev} data={data} set={set} onTooltip={onTooltip} />;
  }
  else if (step === "contextChecks") body = <ContextChecksBody next={next} prev={prev} data={data} set={set} />;
  else if (step === "done") body = <DoneBody data={data} />;

  /* 진행률 (intro/done 제외 구간) */
  const progress = Math.round((stepIdx / (STEPS.length - 1)) * 100);

  return (
    <div style={{ fontFamily: T.font, background: T.cardGray, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, background: T.white, minHeight: "100vh", position: "relative", boxShadow: "0 0 40px rgba(0,0,0,.04)" }}>
        {stepIdx > 0 && step !== "done" && (
          <div style={{ height: 3, background: T.line }}>
            <div style={{ height: "100%", width: `${progress}%`, background: T.blue, transition: "width .3s" }} />
          </div>
        )}
        {body}
      </div>
    </div>
  );
}

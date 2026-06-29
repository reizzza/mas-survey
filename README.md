# MAS 정당성 인식 연구 — 배포 가이드

이 폴더는 **그대로 배포 가능한** Vite + React 프로젝트입니다.

```
deploy/
├─ index.html              진입점 (Pretendard 폰트 로드)
├─ package.json            의존성 (클라이언트 + 함수)
├─ vite.config.js
├─ netlify.toml            빌드/함수/라우팅 설정
├─ .env.example            환경변수 양식
├─ src/
│   ├─ main.jsx            /admin → 어드민, 그 외 → 설문 으로 분기
│   ├─ Survey.jsx          설문 앱
│   └─ Admin.jsx           어드민 대시보드
├─ public/assets/          비네트 이미지 24장 (이미 포함됨)
└─ netlify/functions/
    ├─ save.mjs            증분 저장
    ├─ getResponses.mjs    어드민 조회 (서버에서 비번 검증)
    └─ lib/sheets.mjs      Google Sheets 연결
```

설문은 `/`, 어드민은 `/admin` 으로 접속합니다.

---

## 0. 사전 준비 — Google Sheets 연결 (필수)

배포 전에 한 번만 해두면 됩니다.

1. **Google Cloud Console** → 프로젝트 생성 → **Google Sheets API** 사용 설정
2. **서비스 계정** 생성 → 키(JSON) 다운로드 → 안의 `client_email`, `private_key` 확인
3. **새 Google Sheet** 생성 → URL 의 `/d/` 와 `/edit` 사이가 **SHEET_ID**
4. 그 시트를 **공유 → 위 `client_email` 을 편집자로 추가** (이걸 빼먹으면 저장이 안 됩니다)
5. 첫 행은 비워둬도 됨 — 함수가 처음 실행될 때 헤더를 자동 생성

---

## 1. 배포 방법 A — GitHub 연동 (권장)

> 푸시할 때마다 자동 재배포됩니다.

1. 이 `deploy/` 폴더를 새 Git 저장소로 만들어 GitHub 에 올립니다.
   ```bash
   cd deploy
   git init && git add . && git commit -m "init"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. [Netlify](https://app.netlify.com) → **Add new site → Import an existing project** → GitHub 저장소 선택
3. 빌드 설정은 `netlify.toml` 이 자동 인식 (Build: `npm run build`, Publish: `dist`, Functions: `netlify/functions`)
4. **Site settings → Environment variables** 에서 4개 입력 (아래 표)
5. **Deploy** — 끝나면 `https://<사이트>.netlify.app` 으로 설문, `/admin` 으로 어드민 접속

## 1. 배포 방법 B — Netlify CLI

```bash
cd deploy
npm install
npm i -g netlify-cli
netlify deploy --build            # 미리보기 배포
netlify deploy --build --prod     # 운영 배포
```
환경변수는 `netlify env:set KEY value` 또는 대시보드에서 설정.

---

## 2. 환경변수 (4개)

| 변수 | 값 |
|------|-----|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 서비스 계정 `client_email` |
| `GOOGLE_PRIVATE_KEY` | 서비스 계정 `private_key` 전체 (`\n` 포함 그대로) |
| `SHEET_ID` | 시트 ID |
| `ADMIN_KEY` | 어드민 비밀번호 (직접 정함) |

---

## 3. 배포 후 점검

1. 설문을 한 번 끝까지 → 시트에 행 1개 생기고 `data` 열에 JSON 채워지는지
2. 중간에 창 닫아도 직전 단계까지 행이 남는지 (증분 저장)
3. `/admin` → `ADMIN_KEY` 입력 → 통계가 그려지는지
4. 틀린 비번 → "비밀번호가 올바르지 않습니다"

---

## 참고

- **이미지**: `public/assets/` 에 24장이 이미 들어 있습니다 (개인/직장/공공 × stage1~4·resultA/B/C1/C2). 교체하려면 같은 파일명으로 덮어쓰면 됩니다.
- **조건 순서**: 고정(A → B → C1 → C2). 바꾸려면 `Survey.jsx` 의 `CONDITION_ORDER` 수정.
- **맥락 배정**: 참가자가 연구자 안내에 따라 A/B/C 버튼을 누릅니다. 화면엔 A/B/C, 데이터엔 personal/workplace/public 으로 저장됩니다.
- **로컬 개발**: `npm install` 후 `npm run dev`. 단, 함수(저장/조회)는 `netlify dev` 로 실행해야 `/.netlify/functions/*` 가 동작합니다.

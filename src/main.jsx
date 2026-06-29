import React from "react";
import ReactDOM from "react-dom/client";
import Survey from "./Survey.jsx";
import Admin from "./Admin.jsx";

/* 경로 분기: /admin 으로 들어오면 어드민, 그 외는 설문.
 * netlify.toml 의 rewrite 가 모든 경로를 index.html 로 보내므로
 * 여기서 pathname 을 보고 어떤 화면을 띄울지 결정한다. (라우터 라이브러리 불필요) */
const path = window.location.pathname.replace(/\/+$/, "");
const Page = path.endsWith("/admin") ? Admin : Survey;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);

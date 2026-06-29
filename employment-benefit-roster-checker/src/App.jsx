// ============================================================
// 독립앱 진입 — 접속 즉시 4대보험 명부 분석기 사용.
// 향후 로그인/사용횟수/결제는 이 바깥(AccessGate)에서 감싸기 쉽게 분리.
// ============================================================
import React from "react";
import RosterDiagnosis, { ToastHost, FF } from "./features/RosterDiagnosis";
import { SERVICE } from "./config/service";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: FF }}>
      {/* 분석기 배경 헤더(모달 뒤). 분석기는 화면을 가득 채우는 패널로 즉시 열린다. */}
      <header style={{ maxWidth: 960, margin: "0 auto", padding: "22px 18px 8px", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.4px" }}>
          🩺 {SERVICE.name}
        </div>
        <div style={{ fontSize: 15, color: "#64748B", marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          {SERVICE.tagline}
        </div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 6 }}>
          명부는 브라우저에서만 분석되며 서버에 저장되지 않습니다.
        </div>
      </header>

      {/* 접속 즉시 열림(autoOpen) · 진입 버튼 숨김(hideEntry) → 분석 패널이 곧 앱 */}
      <RosterDiagnosis autoOpen hideEntry />

      <ToastHost />
    </div>
  );
}

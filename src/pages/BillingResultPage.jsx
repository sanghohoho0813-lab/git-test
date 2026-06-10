import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

const FF = "'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const btnP = { background: "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF };

function Shell({ children }) {
  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 10px 40px rgba(15,23,42,0.10)", border: "1px solid #E2E8F0", padding: "40px 32px", textAlign: "center" }}>
        {children}
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

// 토스 카드 등록 successUrl/failUrl 처리 페이지.
//  - 성공: ?plan=...&authKey=...&customerKey=... → Edge Function 으로 빌링키 발급+첫 결제
//  - 실패: ?fail=1&code=...&message=...        → 오류 안내 후 요금제로 복귀
export default function BillingResultPage() {
  const params = new URLSearchParams(window.location.search);
  const isFail = params.get("fail") === "1";
  const failCode = params.get("code");
  const failMessage = params.get("message");
  const authKey = params.get("authKey");
  const customerKey = params.get("customerKey");
  const planKey = params.get("plan");

  // processing | success | fail
  const [phase, setPhase] = useState(isFail ? "fail" : "processing");
  const [error, setError] = useState(isFail ? (failMessage || "카드 등록이 취소되었거나 실패했습니다.") : "");
  const [result, setResult] = useState(null);
  const calledRef = useRef(false); // StrictMode 등 중복 호출 방지 (이중 결제 차단)

  useEffect(() => {
    if (isFail) return;
    if (!authKey || !customerKey || !planKey) {
      setPhase("fail");
      setError("결제 정보가 누락되었습니다. 요금제 화면에서 다시 시도해주세요.");
      return;
    }
    if (calledRef.current) return;
    calledRef.current = true;

    supabase.functions.invoke("toss-issue-billing-key", {
      body: { authKey, customerKey, planKey },
    }).then(({ data, error: fnErr }) => {
      if (fnErr) {
        setPhase("fail");
        setError("결제 서버 연결에 실패했습니다: " + (fnErr.message || ""));
        return;
      }
      if (data && data.ok) {
        setResult(data);
        setPhase("success");
        // 전체 새로고침으로 이동해 구독 상태(useSub)를 다시 불러온다 → 앱 잠금 해제
        setTimeout(() => { window.location.href = "/"; }, 2800);
      } else {
        setPhase("fail");
        setError((data && data.error) || "결제에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    }).catch((e) => {
      setPhase("fail");
      setError("결제 처리 중 오류가 발생했습니다: " + (e?.message || String(e)));
    });
  }, []);

  if (phase === "processing") {
    return (
      <Shell>
        <div style={{ width: 34, height: 34, margin: "0 auto 18px", border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "#0F172A" }}>결제를 진행하고 있습니다…</h2>
        <p style={{ margin: 0, color: "#64748B", fontSize: 14, lineHeight: 1.7 }}>
          카드 등록 확인 후 첫 결제를 승인하는 중입니다.<br />
          이 화면을 닫지 말고 잠시만 기다려주세요.
        </p>
      </Shell>
    );
  }

  if (phase === "success") {
    return (
      <Shell>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 800, color: "#0F172A" }}>결제가 완료되었습니다</h2>
        <p style={{ margin: "0 0 6px", color: "#475569", fontSize: 15, fontWeight: 600 }}>구독이 활성화되었습니다.</p>
        {result && (
          <p style={{ margin: "0 0 4px", color: "#64748B", fontSize: 13.5, lineHeight: 1.7 }}>
            결제 금액: <strong>₩{(result.amount || 0).toLocaleString()}/월</strong>
            {result.launchPriceLocked && <span style={{ color: "#B45309" }}> (런칭가 적용)</span>}<br />
            {result.cardMasked && <span>카드: {result.cardCompany || ""} {result.cardMasked}</span>}
          </p>
        )}
        <p style={{ margin: "14px 0 0", color: "#94A3B8", fontSize: 13 }}>잠시 후 앱으로 이동합니다…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
      <h2 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 800, color: "#0F172A" }}>결제를 완료하지 못했습니다</h2>
      <p style={{ margin: "0 0 6px", color: "#DC2626", fontSize: 14, lineHeight: 1.7, fontWeight: 600 }}>{error}</p>
      {failCode && <p style={{ margin: "0 0 4px", color: "#94A3B8", fontSize: 12.5 }}>오류 코드: {failCode}</p>}
      <p style={{ margin: "10px 0 20px", color: "#64748B", fontSize: 13.5, lineHeight: 1.7 }}>
        카드가 청구되지 않았다면 다시 시도할 수 있습니다.<br />같은 문제가 반복되면 다른 카드로 시도해주세요.
      </p>
      <button style={btnP} onClick={() => { window.location.href = "/"; }}>요금제 화면으로 돌아가기</button>
    </Shell>
  );
}

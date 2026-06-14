import { useState } from "react";
import { verifyPin, clearPin } from "../lib/applock";

const FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";

// 화면 잠금(PIN 입력) — PIN 이 설정된 경우 앱 진입 전 표시된다.
export default function PinLock({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const ok = await verifyPin(pin);
    if (ok) { onUnlock(); }
    else { setErr("PIN 이 올바르지 않습니다."); setPin(""); }
    setBusy(false);
  }

  function forgot() {
    if (!window.confirm("PIN 잠금을 해제(초기화)합니다.\n\n· 화면 잠금만 해제되며, 업무 데이터(업체·직원 등)는 그대로 보존됩니다.\n· 해제 후 설정에서 PIN 을 다시 등록할 수 있습니다.\n\n계속할까요?")) return;
    clearPin();
    onUnlock();
  }

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "40px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 46, marginBottom: 12 }}>🔒</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, color: "#0F172A" }}>화면 잠금</h1>
        <p style={{ margin: "0 0 22px", color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>설정한 PIN 을 입력해 잠금을 해제하세요.</p>
        <form onSubmit={submit}>
          <input
            type="password" inputMode="numeric" autoFocus value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="● ● ● ●"
            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 24, letterSpacing: "8px", textAlign: "center", outline: "none", boxSizing: "border-box", fontFamily: FF }}
          />
          {err && <div style={{ marginTop: 10, color: "#DC2626", fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
          <button type="submit" disabled={busy || pin.length < 4}
            style={{ width: "100%", marginTop: 16, background: (busy || pin.length < 4) ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 15.5, fontWeight: 800, cursor: (busy || pin.length < 4) ? "default" : "pointer", fontFamily: FF }}>
            {busy ? "확인 중…" : "잠금 해제"}
          </button>
        </form>
        <button onClick={forgot} style={{ marginTop: 14, background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: FF }}>
          PIN 을 잊으셨나요? · 잠금 초기화
        </button>
      </div>
    </div>
  );
}

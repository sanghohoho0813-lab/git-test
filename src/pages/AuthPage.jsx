import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const FF = "'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const inp = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: FF };
const btnP = { background: "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FF, width: "100%" };

function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>{label}</label>
      <input style={inp} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function AuthPage() {
  const { signIn, signUp, session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | signup

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) { setError("이름을 입력해주세요."); setLoading(false); return; }
        if (!teamName.trim()) { setError("팀/사무소 이름을 입력해주세요."); setLoading(false); return; }
        await signUp(email, password, displayName.trim(), teamName.trim());
        setDone(true);
      }
    } catch (err) {
      setError(err.message || "오류가 발생했습니다. 다시 시도해주세요.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div style={{ fontFamily: FF, minHeight: "100vh", background: "linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📧</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>이메일을 확인하세요</h2>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>
            <strong>{email}</strong>로 인증 메일이 발송되었습니다.<br />
            이메일의 링크를 클릭하면 로그인됩니다.
          </p>
          <button style={{ ...btnP, marginTop: 20, background: "#F1F5F9", color: "#475569" }} onClick={() => { setMode("login"); setDone(false); }}>
            로그인 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "36px 32px 24px", textAlign: "center", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1E293B" }}>고용지원금 매니저</h1>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>Pro · 2026 지원금 15종</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid #F1F5F9" }}>
          {[["login", "로그인"], ["signup", "회원가입"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{ flex: 1, padding: "12px 0", fontSize: 14, fontWeight: mode === m ? 700 : 500, color: mode === m ? "#2563EB" : "#94A3B8", background: "none", border: "none", borderBottom: mode === m ? "2px solid #2563EB" : "2px solid transparent", marginBottom: -2, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 32px 32px" }}>
          {mode === "signup" && (
            <>
              <Field label="이름 *" value={displayName} onChange={setDisplayName} placeholder="홍길동" />
              <Field label="팀/사무소 이름 *" value={teamName} onChange={setTeamName} placeholder="○○ 노무사사무소" />
            </>
          )}
          <Field label="이메일 *" type="email" value={email} onChange={setEmail} placeholder="hong@example.com" />
          <Field label="비밀번호 *" type="password" value={password} onChange={setPassword} placeholder="8자 이상" />

          {error && (
            <div style={{ padding: "10px 12px", background: "#FEE2E2", borderRadius: 8, color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button style={btnP} type="submit" disabled={loading}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "무료 체험 시작 (14일)"}
          </button>

          {mode === "signup" && (
            <p style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 12 }}>
              가입 후 14일 무료 체험, 이후 구독 플랜 선택
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

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
        const team = teamName.trim() || (displayName.trim() + " 워크스페이스");
        const res = await signUp(email, password, displayName.trim(), team);
        // 이메일 인증이 꺼져 있으면 가입 즉시 세션이 발급됨 → 바로 대시보드(세션 효과가 이동 처리).
        // 인증이 필요한 설정이면 세션이 없으므로 안내 화면을 보여준다.
        if (!(res && res.session)) setDone(true);
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
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>인증 메일을 보냈습니다</h2>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.7 }}>
            <strong>{email}</strong> 메일함에서<br />
            <strong>‘고용지원금 Pro’</strong> 인증 메일을 확인해주세요.<br />
            인증 링크를 누르면 14일 무료 체험이 시작됩니다.
          </p>
          <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 10 }}>메일이 보이지 않으면 스팸함도 확인해주세요.</p>
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
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏛</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1E293B" }}>고용지원금 Pro</h1>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>컨설턴트를 위한 고용지원금 운영관리 시스템</p>
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
              <Field label="팀/사무소 이름 (선택)" value={teamName} onChange={setTeamName} placeholder="비워두면 자동 생성됩니다" />
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

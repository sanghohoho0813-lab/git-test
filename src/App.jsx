import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import AppPage from "./pages/AppPage";

const FF = "'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const inp = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: FF };
const btnP = { background: "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FF, width: "100%" };

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => { window.location.href = "/auth"; }, 2500);
    } catch (err) {
      setError(err.message || "오류가 발생했습니다. 링크가 만료되었을 수 있습니다.");
    }
    setLoading(false);
  }

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "36px 32px 24px", textAlign: "center", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1E293B" }}>새 비밀번호 설정</h1>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>새로 사용할 비밀번호를 입력해주세요</p>
        </div>
        {done ? (
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>비밀번호가 변경되었습니다</h2>
            <p style={{ color: "#64748B", fontSize: 14 }}>잠시 후 로그인 화면으로 이동합니다…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "24px 32px 32px" }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>새 비밀번호 *</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8자 이상" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>비밀번호 확인 *</label>
              <input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="동일하게 입력" />
            </div>
            {error && (
              <div style={{ padding: "10px 12px", background: "#FEE2E2", borderRadius: 8, color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button style={btnP} type="submit" disabled={loading}>
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Guard({ children }) {
  const { session } = useAuth();
  if (session === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", color: "#64748B" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14 }}>로딩 중...</div>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/*" element={<Guard><AppPage /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

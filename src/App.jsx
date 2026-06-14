import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import AppPage from "./pages/AppPage";
import AdminAccessPage from "./pages/AdminAccessPage";
import BillingResultPage from "./pages/BillingResultPage";

const FF = "'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const inp = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: FF };
const btnP = { background: "linear-gradient(135deg,#1D4ED8,#2563EB)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FF, width: "100%" };
const btnS = { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FF, width: "100%" };

// 비밀번호 재설정 링크 진입 신호를 "모듈 로드 시점"에 캡처.
// supabase 가 URL 해시의 토큰을 비동기로 정리하기 전에 읽어둔다.
const RECOVERY_URL = (() => {
  try {
    if (typeof window === "undefined") return { token: false, error: false, path: false };
    const h = window.location.hash || "";
    const s = window.location.search || "";
    return {
      token: /type=recovery/.test(h) || /type=recovery/.test(s),
      error: /error=|error_code=/.test(h) || /error=|error_code=/.test(s),
      path: window.location.pathname === "/reset-password",
    };
  } catch (e) {
    return { token: false, error: false, path: false };
  }
})();

const Shell = ({ children }) => (
  <div style={{ fontFamily: FF, minHeight: "100vh", background: "linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
      {children}
    </div>
  </div>
);

function ResetPasswordPage() {
  const { session, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // loading: recovery 세션 준비 대기 / ready: 입력 가능 / linkError: 만료·무효 / done: 완료
  const [phase, setPhase] = useState(RECOVERY_URL.error ? "linkError" : "loading");

  // recovery 세션이 준비되면(=토큰이 정상 교환되어 세션이 생기면) 입력을 활성화한다.
  // 일정 시간 내 준비되지 않으면 링크가 만료·무효인 것으로 처리한다.
  // 토큰이 정상 교환되었다는 신호(RECOVERY_URL.token) 없이 기존 세션만 있는 경우에는
  // ready 로 넘기지 않아, 다른 계정(예: 관리자) 비밀번호가 바뀌는 사고를 막는다.
  useEffect(() => {
    if (phase === "linkError" || phase === "done") return;
    if (RECOVERY_URL.token && session) { setPhase("ready"); return; }
    const t = setTimeout(() => {
      setPhase((p) => (p === "loading" ? "linkError" : p));
    }, 10000);
    return () => clearTimeout(t);
  }, [session, phase]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setPhase("done");
      // 보안: 재설정 직후 현재(recovery) 세션을 종료해 반드시 새 비밀번호로 다시 로그인하도록 한다.
      try { await signOut(); } catch (e2) { /* ignore */ }
      setTimeout(() => { window.location.href = "/auth"; }, 2600);
    } catch (err) {
      setError(err.message || "비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.");
    }
    setLoading(false);
  }

  const Header = (
    <div style={{ padding: "36px 32px 24px", textAlign: "center", borderBottom: "1px solid #F1F5F9" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1E293B" }}>새 비밀번호 설정</h1>
      <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>새로 사용할 비밀번호를 입력해주세요</p>
    </div>
  );

  if (phase === "done") {
    return (
      <Shell>
        {Header}
        <div style={{ padding: "40px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>비밀번호가 변경되었습니다</h2>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.7 }}>새 비밀번호로 다시 로그인해주세요.<br />잠시 후 로그인 화면으로 이동합니다…</p>
        </div>
      </Shell>
    );
  }

  if (phase === "linkError") {
    return (
      <Shell>
        {Header}
        <div style={{ padding: "36px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "#1E293B" }}>링크가 유효하지 않습니다</h2>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.7, marginBottom: 22 }}>
            재설정 링크가 만료되었거나 유효하지 않습니다.<br />비밀번호 찾기를 다시 진행해주세요.
          </p>
          <button style={btnP} onClick={() => { window.location.href = "/auth"; }}>로그인 화면으로</button>
        </div>
      </Shell>
    );
  }

  if (phase === "loading") {
    return (
      <Shell>
        {Header}
        <div style={{ padding: "44px 32px", textAlign: "center" }}>
          <div style={{ width: 30, height: 30, margin: "0 auto 16px", border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <p style={{ color: "#64748B", fontSize: 14 }}>재설정 링크를 확인하는 중입니다…</p>
        </div>
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </Shell>
    );
  }

  return (
    <Shell>
      {Header}
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
    </Shell>
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

function AppRouter() {
  const { recoveryMode } = useAuth();
  const location = useLocation();
  // 비밀번호 재설정 흐름에서는 기존 로그인 세션이 있어도 대시보드로 보내지 않고
  // 무조건 재설정 화면을 우선 렌더링한다. (Supabase 가 Site URL(/)로 리다이렉트해
  // 경로가 /reset-password 가 아니더라도, 토큰/이벤트 신호로 감지한다.)
  const inRecovery = recoveryMode || RECOVERY_URL.token || RECOVERY_URL.path || location.pathname === "/reset-password";
  if (inRecovery) return <ResetPasswordPage />;

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/billing/result" element={<Guard><BillingResultPage /></Guard>} />
      <Route path="/admin/access" element={<Guard><AdminAccessPage /></Guard>} />
      <Route path="/*" element={<Guard><AppPage /></Guard>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

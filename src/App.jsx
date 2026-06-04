import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import AppPage from "./pages/AppPage";

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
          <Route path="/*" element={<Guard><AppPage /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

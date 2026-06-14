import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { PRODUCT_KEY, expiryLabel } from "../lib/product";

const FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";
const card = { background: "#fff", border: "1px solid #E8EDF3", borderRadius: 16, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" };
const inp = { padding: "10px 13px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: FF };
const btn = (bg, fg, bd) => ({ background: bg, color: fg, border: bd || "none", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap" });

const STATUS_META = {
  approved: { label: "이용중", color: "#059669", bg: "#ECFDF5" },
  pending: { label: "승인대기", color: "#B45309", bg: "#FEF3C7" },
  blocked: { label: "차단", color: "#DC2626", bg: "#FEF2F2" },
  none: { label: "권한없음", color: "#94A3B8", bg: "#F1F5F9" },
};

function fmtDate(s) { if (!s) return "-"; const d = new Date(s); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); }

export default function AdminAccessPage() {
  const { profile, productAccess, session } = useAuth();
  const navigate = useNavigate();
  const isAdmin = !!(profile?.is_admin || productAccess?.role === "admin");

  const [users, setUsers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState("");
  const [dateEdits, setDateEdits] = useState({}); // { userId: 'YYYY-MM-DD' }

  // 초대코드 생성 폼
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [names, setNames] = useState("");
  const [genMsg, setGenMsg] = useState("");
  const [genBusy, setGenBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [u, c] = await Promise.all([
        supabase.rpc("admin_list_users", { p_product: PRODUCT_KEY }),
        supabase.from("invite_codes").select("*").eq("product_key", PRODUCT_KEY).order("created_at", { ascending: false }),
      ]);
      if (u.error) throw u.error;
      if (c.error) throw c.error;
      setUsers(u.data || []);
      setCodes(c.data || []);
    } catch (e) {
      setErr(e.message || "데이터를 불러오지 못했습니다.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [isAdmin, load]);

  // 상태 변경 시 기존 만료일/역할은 그대로 보존한다 (null 로 덮어쓰지 않음)
  async function setStatus(u, status) {
    setBusyId(u.user_id);
    try {
      const { error } = await supabase.rpc("admin_set_product_access", {
        p_user_id: u.user_id, p_product_key: PRODUCT_KEY,
        p_role: u.role === "admin" ? "admin" : "user",
        p_status: status, p_expires_at: u.expires_at || null,
      });
      if (error) throw error;
      await load();
    } catch (e) { alert(e.message || "변경 실패"); }
    setBusyId("");
  }

  // 만료일 변경: kind 'date'(YYYY-MM-DD) | 'none'(제한없음) | 'now'(즉시 만료)
  async function setExpiry(u, kind, ymd) {
    let exp = null;
    if (kind === "date") {
      if (!ymd) { alert("날짜를 선택하세요."); return; }
      exp = new Date(ymd + "T23:59:59").toISOString();
    } else if (kind === "now") {
      exp = new Date(Date.now() - 1000).toISOString();
    } // 'none' → null
    setBusyId(u.user_id);
    try {
      const { error } = await supabase.rpc("admin_set_product_access", {
        p_user_id: u.user_id, p_product_key: PRODUCT_KEY,
        p_role: u.role === "admin" ? "admin" : "user",
        p_status: u.status === "blocked" ? "blocked" : "approved",
        p_expires_at: exp,
      });
      if (error) throw error;
      await load();
    } catch (e) { alert(e.message || "변경 실패"); }
    setBusyId("");
  }

  async function deactivateCode(id) {
    if (!window.confirm("이 초대코드를 비활성화할까요?")) return;
    try {
      const { error } = await supabase.from("invite_codes").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      await load();
    } catch (e) { alert(e.message || "비활성화 실패"); }
  }

  async function createCode(single) {
    setGenBusy(true); setGenMsg("");
    try {
      const exp = expires ? new Date(expires + "T23:59:59").toISOString() : null;
      if (single) {
        const { data, error } = await supabase.rpc("admin_create_invite_code", {
          p_product_key: PRODUCT_KEY, p_label: label || null, p_role: "user",
          p_max_uses: maxUses ? Number(maxUses) : null, p_expires_at: exp, p_code: null,
        });
        if (error) throw error;
        setGenMsg("초대코드 생성 완료: " + (data?.code || ""));
      } else {
        const list = names.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        if (list.length === 0) { setGenMsg("이름을 한 줄에 한 명씩 입력하세요."); setGenBusy(false); return; }
        const created = [];
        for (const nm of list) {
          const { data, error } = await supabase.rpc("admin_create_invite_code", {
            p_product_key: PRODUCT_KEY, p_label: nm, p_role: "user", p_max_uses: 1, p_expires_at: exp, p_code: null,
          });
          if (error) throw error;
          created.push(nm + " → " + (data?.code || ""));
        }
        setGenMsg(created.length + "명 개인 코드(1회용) 생성 완료:\n" + created.join("\n"));
        setNames("");
      }
      await load();
    } catch (e) { setGenMsg("생성 실패: " + (e.message || "")); }
    setGenBusy(false);
  }

  if (!session) { navigate("/auth", { replace: true }); return null; }

  if (!isAdmin) {
    return (
      <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 18, padding: "40px 32px", maxWidth: 420, textAlign: "center", boxShadow: "0 12px 40px rgba(15,23,42,0.12)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>관리자 전용 화면입니다</h2>
          <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.7 }}>이 화면은 최고 관리자만 접근할 수 있습니다.</p>
          <button style={{ ...btn("#2563EB", "#fff"), marginTop: 18, padding: "11px 22px" }} onClick={() => navigate("/")}>대시보드로 돌아가기</button>
        </div>
      </div>
    );
  }

  const counts = users.reduce((a, u) => { const s = u.status || "none"; a[s] = (a[s] || 0) + 1; return a; }, {});

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F4F6F9", padding: "28px clamp(16px,4vw,48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.6px", color: "#0F172A" }}>🛡️ 접근 권한 관리</h1>
            <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "#64748B" }}>가입자 승인·차단, 초대코드 생성/관리 (product: {PRODUCT_KEY})</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("#fff", "#475569", "1px solid #E2E8F0")} onClick={load}>새로고침</button>
            <button style={btn("#fff", "#475569", "1px solid #E2E8F0")} onClick={() => navigate("/")}>← 대시보드</button>
          </div>
        </div>

        {err && <div style={{ ...card, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 14 }}>{err}</div>}

        {/* 요약 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {[["전체", users.length, "#0F172A", "#fff"], ["이용중", counts.approved || 0, "#059669", "#ECFDF5"], ["승인대기", counts.pending || 0, "#B45309", "#FEF3C7"], ["차단", counts.blocked || 0, "#DC2626", "#FEF2F2"]].map((s, i) => (
            <div key={i} style={{ flex: "1 1 130px", background: s[3], border: "1px solid #E8EDF3", borderRadius: 13, padding: "14px 16px" }}>
              <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{s[0]}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s[2], letterSpacing: "-0.5px" }}>{s[1]}</div>
            </div>
          ))}
        </div>

        {/* 초대코드 생성 */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 14 }}>초대코드 생성</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", display: "block", marginBottom: 5 }}>제품</label>
              <select style={{ ...inp, width: "100%" }} value={PRODUCT_KEY} disabled>
                <option value="employment">employment (고용지원금)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", display: "block", marginBottom: 5 }}>라벨 (메모)</label>
              <input style={{ ...inp, width: "100%" }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 6월 베타 1차" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", display: "block", marginBottom: 5 }}>최대 사용 횟수</label>
              <input style={{ ...inp, width: "100%" }} type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="비우면 무제한" />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", display: "block", marginBottom: 5 }}>만료일</label>
              <input style={{ ...inp, width: "100%" }} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <button style={btn("#2563EB", "#fff")} disabled={genBusy} onClick={() => createCode(true)}>+ 코드 생성 (위 설정 사용)</button>
          </div>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed #E2E8F0" }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", display: "block", marginBottom: 5 }}>사람별 1회용 개인 코드 일괄 생성 (한 줄에 한 명)</label>
            <textarea style={{ ...inp, width: "100%", height: 80, resize: "vertical" }} value={names} onChange={(e) => setNames(e.target.value)} placeholder={"홍길동\n김철수\n이영희"} />
            <div style={{ marginTop: 8 }}>
              <button style={btn("#0F172A", "#fff")} disabled={genBusy} onClick={() => createCode(false)}>{genBusy ? "생성 중…" : "이름별 개인 코드 일괄 생성 (각 1회용, 만료일 적용)"}</button>
            </div>
          </div>
          {genMsg && <pre style={{ marginTop: 12, padding: "12px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 13, color: "#166534", whiteSpace: "pre-wrap", fontFamily: FF }}>{genMsg}</pre>}
        </div>

        {/* 초대코드 목록 */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 14 }}>초대코드 목록 ({codes.length})</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#F8FAFC" }}>
                {["코드", "라벨", "사용/최대", "만료", "상태", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: "#64748B", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94A3B8" }}>생성된 초대코드가 없습니다.</td></tr>
                ) : codes.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: "#0F172A", borderBottom: "1px solid #F1F5F9", fontFamily: "monospace" }}>{c.code}</td>
                    <td style={{ padding: "10px 12px", color: "#475569", borderBottom: "1px solid #F1F5F9" }}>{c.label || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#475569", borderBottom: "1px solid #F1F5F9" }}>{c.used_count}{c.max_uses ? " / " + c.max_uses : " / ∞"}</td>
                    <td style={{ padding: "10px 12px", color: "#475569", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" }}>{fmtDate(c.expires_at)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: c.is_active ? "#ECFDF5" : "#F1F5F9", color: c.is_active ? "#059669" : "#94A3B8" }}>{c.is_active ? "활성" : "비활성"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9", textAlign: "right" }}>
                      {c.is_active && <button style={btn("#fff", "#DC2626", "1px solid #FECACA")} onClick={() => deactivateCode(c.id)}>비활성화</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 가입자 목록 */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 14 }}>가입자 목록 ({users.length})</div>
          {loading ? <div style={{ padding: 20, color: "#94A3B8" }}>불러오는 중…</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ background: "#F8FAFC" }}>
                  {["이메일", "이름", "역할", "상태", "만료", "만료일 관리", "권한 변경"].map((h) => <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: "#64748B", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {users.map((u) => {
                    const sm = STATUS_META[u.status || "none"] || STATUS_META.none;
                    const busy = busyId === u.user_id;
                    return (
                      <tr key={u.user_id}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0F172A", borderBottom: "1px solid #F1F5F9" }}>{u.email}</td>
                        <td style={{ padding: "10px 12px", color: "#475569", borderBottom: "1px solid #F1F5F9" }}>{u.display_name || "-"}</td>
                        <td style={{ padding: "10px 12px", color: "#475569", borderBottom: "1px solid #F1F5F9" }}>{u.role || "-"}</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: sm.bg, color: sm.color }}>{sm.label}</span>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" }}>{(function(){ var e = expiryLabel(u.expires_at); var c = e.tone === "expired" ? "#DC2626" : e.tone === "soon" ? "#B45309" : e.tone === "none" ? "#94A3B8" : "#475569"; var w = (e.tone === "expired" || e.tone === "soon") ? 800 : 500; return <span style={{ color: c, fontWeight: w }}>{e.text}</span>; })()}</td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <input type="date" disabled={busy} value={dateEdits[u.user_id] || (u.expires_at ? new Date(u.expires_at).toISOString().slice(0, 10) : "")}
                              onChange={(e) => setDateEdits({ ...dateEdits, [u.user_id]: e.target.value })}
                              style={{ ...inp, padding: "6px 8px", fontSize: 13 }} />
                            <button disabled={busy} style={btn("#EFF6FF", "#1D4ED8", "1px solid #BFDBFE")} onClick={() => setExpiry(u, "date", dateEdits[u.user_id])}>저장</button>
                            <button disabled={busy} style={btn("#F8FAFC", "#475569", "1px solid #E2E8F0")} onClick={() => setExpiry(u, "none")}>제한없음</button>
                            <button disabled={busy} style={btn("#FEF2F2", "#DC2626", "1px solid #FECACA")} onClick={() => { if (window.confirm("이 사용자를 즉시 만료 처리할까요?")) setExpiry(u, "now"); }}>즉시 만료</button>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button disabled={busy || u.status === "approved"} style={btn(u.status === "approved" ? "#F1F5F9" : "#ECFDF5", u.status === "approved" ? "#94A3B8" : "#059669", "1px solid #A7F3D0")} onClick={() => setStatus(u, "approved")}>승인</button>
                            <button disabled={busy || u.status === "pending"} style={btn("#FEF3C7", "#B45309", "1px solid #FDE68A")} onClick={() => setStatus(u, "pending")}>대기</button>
                            <button disabled={busy || u.status === "blocked"} style={btn("#FEF2F2", "#DC2626", "1px solid #FECACA")} onClick={() => setStatus(u, "blocked")}>차단</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 12, lineHeight: 1.6 }}>승인=approved(이용 가능) · 대기=pending(차단) · 차단=blocked(차단). 권한 회수는 "차단" 또는 "대기"로 변경하세요.</p>
        </div>
      </div>
    </div>
  );
}

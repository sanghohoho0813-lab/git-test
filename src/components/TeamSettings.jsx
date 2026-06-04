import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

const FF = "'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const inp = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: FF };

const ROLE_LABELS = { owner: "소유자", admin: "관리자", member: "멤버" };

export function TeamSettings({ onClose }) {
  const { org, orgRole, session, refreshOrg } = useAuth();
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org) return;
    supabase
      .from("organization_members")
      .select("*, profiles(display_name, title)")
      .eq("org_id", org.id)
      .then(({ data }) => setMembers(data || []));
  }, [org]);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    try {
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { orgId: org.id, email: inviteEmail.trim(), invitedBy: session.user.id },
      });
      if (error) throw error;
      setInviteLink(data.inviteUrl || "이메일이 발송되었습니다.");
      setInviteEmail("");
    } catch (err) {
      setError(err.message || "초대 실패");
    }
    setInviting(false);
  }

  async function removeMember(userId) {
    if (userId === session.user.id) return;
    await supabase.from("organization_members").delete().eq("org_id", org.id).eq("user_id", userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  async function changeRole(userId, role) {
    await supabase.from("organization_members").update({ role }).eq("org_id", org.id).eq("user_id", userId);
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
  }

  const canManage = orgRole === "owner" || orgRole === "admin";

  return (
    <div style={{ fontFamily: FF }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>👥 팀 멤버 ({members.length}명)</div>
        {members.map((m) => (
          <div key={m.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "#F8FAFC", marginBottom: 6, border: "1px solid #F1F5F9" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.profiles?.display_name || m.user_id}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>{m.profiles?.title || ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canManage && m.user_id !== session.user.id && m.role !== "owner" ? (
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.user_id, e.target.value)}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff" }}>
                  <option value="admin">관리자</option>
                  <option value="member">멤버</option>
                </select>
              ) : (
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: m.role === "owner" ? "#DBEAFE" : "#F1F5F9", color: m.role === "owner" ? "#2563EB" : "#64748B", fontWeight: 600 }}>
                  {ROLE_LABELS[m.role] || m.role}
                </span>
              )}
              {canManage && m.user_id !== session.user.id && m.role !== "owner" && (
                <button onClick={() => removeMember(m.user_id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 13 }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div style={{ padding: "14px 16px", background: "#F0F7FF", borderRadius: 10, border: "1px solid #BFDBFE" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", marginBottom: 8 }}>+ 팀원 초대</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inp, flex: 1, fontSize: 13, padding: "8px 12px" }}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="초대할 이메일"
              onKeyDown={(e) => { if (e.key === "Enter") sendInvite(); }}
            />
            <button
              onClick={sendInvite}
              disabled={inviting}
              style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {inviting ? "..." : "초대"}
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>{error}</p>}
          {inviteLink && <p style={{ fontSize: 12, color: "#059669", marginTop: 6 }}>{inviteLink}</p>}
        </div>
      )}
    </div>
  );
}

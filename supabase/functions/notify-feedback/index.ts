/**
 * notify-feedback — Supabase Edge Function
 *
 * 피드백 제출 성공 후 앱에서 호출됩니다.
 * Resend API를 통해 관리자 이메일(Gmail 가능)로 알림을 발송합니다.
 *
 * ── 필수 환경변수 설정 ──────────────────────────────────────
 * Supabase Dashboard → Project Settings → Edge Functions → Secrets에서 추가:
 *
 *   RESEND_API_KEY   Resend 대시보드(https://resend.com)에서 발급
 *   ADMIN_EMAIL      알림 수신 주소 (예: yourname@gmail.com)
 *   FROM_EMAIL       발신 주소 — Resend에서 인증된 도메인 필요
 *                    (테스트 시 onboarding@resend.dev 임시 사용 가능)
 *
 * ── 배포 명령어 ─────────────────────────────────────────────
 *   npx supabase functions deploy notify-feedback --no-verify-jwt
 *
 * ── 대안 이메일 서비스 ───────────────────────────────────────
 *   SendGrid: https://api.sendgrid.com/v3/mail/send + SENDGRID_API_KEY
 *   Gmail SMTP: nodemailer + App Password (Vercel Serverless 쪽이 편리)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const row = body?.row ?? {};

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const ADMIN_EMAIL    = Deno.env.get("ADMIN_EMAIL") ?? "";
    const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

    if (!RESEND_API_KEY || !ADMIN_EMAIL) {
      console.warn("[notify-feedback] RESEND_API_KEY 또는 ADMIN_EMAIL 미설정 — 발송 건너뜀");
      return new Response(JSON.stringify({ ok: false, reason: "env_missing" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // 답변 HTML 생성
    const answersHtml = Object.entries(row.answers ?? {})
      .map(([qid, ans]) => {
        const val = Array.isArray(ans) ? ans.join(", ") : String(ans);
        return `<li><b>${qid}</b>: ${val}</li>`;
      })
      .join("");

    const html = `
<div style="font-family:'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:24px;
  border:1px solid #E2E8F0;border-radius:12px;color:#1E293B;background:#fff">
  <h2 style="margin:0 0 16px;color:#2563EB">💬 새 피드백이 접수되었습니다</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#64748B;width:110px">제출 시각</td>
        <td>${row.created_at ?? ""}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">조직명</td>
        <td>${row.org_name ?? "(없음)"}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">사용자 이메일</td>
        <td>${row.user_email ?? "(없음)"}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">페이지</td>
        <td>${row.page_path ?? ""}</td></tr>
    <tr><td style="padding:6px 0;color:#64748B">버전</td>
        <td>${row.app_version ?? ""}</td></tr>
  </table>
  <h3 style="margin:20px 0 8px;font-size:15px">설문 답변</h3>
  <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.8">${answersHtml}</ul>
  ${row.free_text
    ? `<h3 style="margin:20px 0 8px;font-size:15px">자유 의견</h3>
       <blockquote style="margin:0;padding:10px 14px;background:#F8FAFC;
         border-left:3px solid #93C5FD;border-radius:4px;font-size:14px;color:#334155">
         ${row.free_text}
       </blockquote>`
    : ""}
  <p style="margin-top:24px;font-size:12px;color:#94A3B8">
    고용지원금 Pro 자동 알림 — 피드백 버튼 제출 시 발송됩니다.
  </p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `[고용지원금Pro] 피드백 — ${row.org_name ?? "신규"} (${row.user_email ?? ""})`,
        html,
      }),
    });

    const data = await res.json();
    console.log("[notify-feedback] Resend 응답:", JSON.stringify(data));

    return new Response(JSON.stringify({ ok: res.ok, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("[notify-feedback] 처리 오류:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});

/**
 * notify-feedback — Supabase Edge Function
 *
 * 피드백이 feedback_responses 에 정상 저장된 후 앱에서 호출됩니다.
 * Resend API를 통해 관리자 이메일(Gmail 가능)로 "사람이 읽기 좋은 요약 리포트"를 발송합니다.
 *
 * ── 필수 환경변수 (Supabase Dashboard → Project Settings → Edge Functions → Secrets) ──
 *   RESEND_API_KEY   Resend 대시보드(https://resend.com)에서 발급한 API 키
 *   ADMIN_EMAIL      알림 수신 주소 (예: kim90813@naver.com) — 콤마로 여러 명 가능
 *   FROM_EMAIL       발신 주소 — Resend에서 인증된 도메인 필요
 *                    (테스트 시 onboarding@resend.dev 임시 사용 가능)
 *
 * ── 배포 ──
 *   npx supabase functions deploy notify-feedback --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// q1~q11 → 사람이 읽기 좋은 라벨
const LABELS: Record<string, string> = {
  q1: "전체 첫인상",
  q2: "엑셀 대비 평가",
  q3: "가장 유용하다고 느낀 기능",
  q4: "가장 불편한 부분",
  q5: "실제 업무에서 자주 쓸 기능",
  q6: "영업자료 활용 가능성",
  q7: "보고서에서 더 보강되면 좋은 부분",
  q8: "적정 월 이용료",
  q9: "유료 사용 시 중요 기준",
  q10: "완성도 점수",
  q11: "개선이 가장 시급한 부분",
};
// 리포트 표시 순서 (핵심 단일지표 먼저 → 복수선택 상세)
const ORDER = ["q1", "q2", "q6", "q8", "q10", "q3", "q4", "q5", "q7", "q9", "q11"];

function fmtDateTime(ds?: string): string {
  if (!ds) return "";
  const d = new Date(ds);
  if (isNaN(d.getTime())) return String(ds);
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function answerToText(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => "- " + x).join("\n") : "—";
  return String(v);
}

function answerToHtml(v: unknown): string {
  if (v === undefined || v === null) return '<span style="color:#94A3B8">—</span>';
  if (Array.isArray(v)) {
    if (!v.length) return '<span style="color:#94A3B8">—</span>';
    return v
      .map(
        (x) =>
          `<span style="display:inline-block;font-size:13px;font-weight:600;padding:3px 10px;margin:2px 4px 2px 0;border-radius:14px;background:#EFF6FF;color:#2563EB">${x}</span>`,
      )
      .join("");
  }
  return `<b>${v}</b>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const row = body?.row ?? {};
    const answers: Record<string, unknown> = row.answers ?? {};

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

    if (!RESEND_API_KEY || !ADMIN_EMAIL) {
      console.warn("[notify-feedback] RESEND_API_KEY 또는 ADMIN_EMAIL 미설정 — 발송 건너뜀");
      return new Response(JSON.stringify({ ok: false, reason: "env_missing" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // ── 텍스트 리포트 (이메일 클라이언트가 HTML 미지원일 때 fallback) ──
    const lines: string[] = [];
    lines.push("==================================================");
    lines.push("📋 베타 피드백 요약 리포트");
    lines.push("==================================================");
    lines.push("");
    lines.push(`제출일시: ${fmtDateTime(row.created_at)}`);
    lines.push(`제출자: ${row.user_email || "(이메일 없음)"}`);
    lines.push(`조직명: ${row.org_name || "(없음)"}`);
    lines.push("");
    for (const qid of ORDER) {
      lines.push(`${LABELS[qid] || qid}:`);
      lines.push(answerToText(answers[qid]));
      lines.push("");
    }
    lines.push("자유 의견:");
    lines.push(row.free_text ? String(row.free_text) : "(없음)");
    lines.push("");
    lines.push("==================================================");
    lines.push("전체 응답은 Supabase Table Editor > feedback_responses에서 확인할 수 있습니다.");
    const textReport = lines.join("\n");

    // ── HTML 리포트 ──
    const score = (() => {
      const m = String(answers.q10 ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    })();
    const scoreColor = score === null ? "#94A3B8" : score >= 8 ? "#059669" : score >= 6 ? "#D97706" : "#DC2626";

    const rowsHtml = ORDER.map((qid) => {
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;vertical-align:top;width:170px;color:#64748B;font-weight:600;font-size:14px">${LABELS[qid] || qid}</td>
        <td style="padding:10px 0 10px 16px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#1E293B;line-height:1.7">${answerToHtml(answers[qid])}</td>
      </tr>`;
    }).join("");

    const html = `
<div style="font-family:'Noto Sans KR',sans-serif;max-width:600px;margin:0 auto;padding:28px 26px;border:1px solid #E2E8F0;border-radius:14px;color:#1E293B;background:#fff">
  <h2 style="margin:0 0 4px;color:#2563EB;font-size:20px">📋 베타 피드백 요약 리포트</h2>
  <p style="margin:0 0 18px;color:#94A3B8;font-size:13px">새 베타 피드백이 도착했습니다.</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;background:#F8FAFC;border-radius:10px">
    <tr><td style="padding:8px 14px;color:#64748B;width:90px">제출일시</td><td style="padding:8px 14px;font-weight:600">${fmtDateTime(row.created_at)}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748B">제출자</td><td style="padding:8px 14px;font-weight:600">${row.user_email || "(이메일 없음)"}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748B">조직명</td><td style="padding:8px 14px;font-weight:600">${row.org_name || "(없음)"}</td></tr>
    ${score !== null ? `<tr><td style="padding:8px 14px;color:#64748B">완성도</td><td style="padding:8px 14px"><b style="color:${scoreColor};font-size:16px">${score} / 10</b></td></tr>` : ""}
  </table>

  <table style="width:100%;border-collapse:collapse">${rowsHtml}</table>

  ${
    row.free_text
      ? `<div style="margin-top:18px;padding:14px 16px;background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px">
           <div style="font-size:13px;font-weight:700;color:#0369A1;margin-bottom:6px">💬 자유 의견</div>
           <div style="font-size:14px;color:#1E293B;line-height:1.7;white-space:pre-wrap">${row.free_text}</div>
         </div>`
      : ""
  }

  <p style="margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;line-height:1.6">
    전체 응답은 Supabase Table Editor &gt; feedback_responses 또는 앱 내 "📋 베타 피드백" 관리자 화면에서 확인할 수 있습니다.
  </p>
</div>`;

    const toList = ADMIN_EMAIL.split(",").map((s) => s.trim()).filter(Boolean);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toList,
        subject: "[고용지원금 Pro] 새 베타 피드백이 도착했습니다",
        html,
        text: textReport,
      }),
    });

    const data = await res.json();
    console.log("[notify-feedback] Resend 응답:", JSON.stringify(data));

    return new Response(JSON.stringify({ ok: res.ok, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    console.error("[notify-feedback] 처리 오류:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});

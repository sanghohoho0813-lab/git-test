// 사용자 "마지막 활동 시간" 추적 (자동 로그아웃 없음 · 5분 throttle).
//
// 운영자가 사용자별 최근 사용 여부를 파악할 수 있도록 user_activity 테이블에
// 사용자당 1행을 upsert 한다. 너무 잦은 DB write 를 막기 위해 같은 사용자는
// 5분에 한 번만 갱신한다(주요 액션 직후라도 throttle 창 안이면 건너뜀).
//
// 표는 supabase/migrations/009_user_activity.sql 로 생성. 미생성/RLS 거부 시에도
// 조용히 무시하여 사용성에 영향을 주지 않는다.

import { supabase } from "./supabase";

var THROTTLE_MS = 5 * 60 * 1000; // 5분
// 같은 탭에서의 중복 호출 방지용 인메모리 캐시
var lastWriteAt = {};

function readLast(uid) {
  if (lastWriteAt[uid] != null) return lastWriteAt[uid];
  try {
    var v = localStorage.getItem("hrsp_lastSeenWrite_" + uid);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch (e) {
    return 0;
  }
}
function writeLast(uid, ts) {
  lastWriteAt[uid] = ts;
  try { localStorage.setItem("hrsp_lastSeenWrite_" + uid, String(ts)); } catch (e) {}
}

/**
 * 활동 기록 (throttle 5분).
 * @param {{userId:string,userEmail?:string,orgId?:string,orgName?:string}} identity
 * @param {string} action  ex) "app.open" / "nav.dashboard" / "company.create"
 * @param {string} [path]  현재 경로 (기본 location.pathname)
 */
export function trackActivity(identity, action, path) {
  try {
    if (!identity || !identity.userId) return;
    var uid = identity.userId;
    var now = Date.now();
    if (now - readLast(uid) < THROTTLE_MS) return; // throttle 창 안 → 건너뜀
    writeLast(uid, now); // 먼저 기록해 동시 호출 중복 write 방지

    var nowIso = new Date().toISOString();
    var row = {
      user_id: uid,
      user_email: identity.userEmail || null,
      org_id: identity.orgId || null,
      org_name: identity.orgName || null,
      last_seen_at: nowIso,
      last_active_path: path || (typeof location !== "undefined" ? location.pathname : null),
      last_active_action: action || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      updated_at: nowIso,
    };
    supabase
      .from("user_activity")
      .upsert(row, { onConflict: "user_id" })
      .then(function (res) {
        if (res && res.error && import.meta.env.DEV) {
          console.warn("[activity] upsert 실패(무시):", res.error.message);
        }
      });
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[activity] 예외(무시):", e && e.message);
  }
}

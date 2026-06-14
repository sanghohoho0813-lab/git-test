// ============================================================
// 로컬 화면 잠금(PIN) + 자동 잠금 — 데모/공용 PC 대비 최소 보안.
// PIN 은 평문 저장하지 않고 SHA-256(salt+pin) 해시만 localStorage 에 저장.
// (4~6자리 PIN 은 본질적으로 약하므로 "화면 가림" 수준의 보호임)
// 실제 업무 데이터는 서버(Supabase)에 있으며, PIN 해제와 무관하게 보존된다.
// ============================================================

const PIN_KEY = "hrSubsidyPro_pinHash";
const SALT = "hrSubsidyPro::pin::v1";
export const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30분 무조작 시 자동 잠금

let lastActive = Date.now();

export async function hashPin(pin) {
  const enc = new TextEncoder().encode(SALT + ":" + String(pin));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isPinSet() {
  try { return !!localStorage.getItem(PIN_KEY); } catch (e) { return false; }
}

export async function setPin(pin) {
  const h = await hashPin(pin);
  try { localStorage.setItem(PIN_KEY, h); } catch (e) { /* ignore */ }
}

export function clearPin() {
  try { localStorage.removeItem(PIN_KEY); } catch (e) { /* ignore */ }
}

export async function verifyPin(pin) {
  try {
    const h = await hashPin(pin);
    const saved = localStorage.getItem(PIN_KEY);
    return !!saved && h === saved;
  } catch (e) { return false; }
}

export function isValidPin(pin) {
  return /^[0-9]{4,6}$/.test(String(pin || ""));
}

export function markActive() { lastActive = Date.now(); }
export function isIdleExpired() { return Date.now() - lastActive > IDLE_LIMIT_MS; }

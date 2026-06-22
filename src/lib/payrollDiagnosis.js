// ============================================================
// 4대보험 가입자 명부 자동진단 — 순수 분석 로직 (React/DOM 비의존)
//
// 안전 원칙(중요):
//  - 이 모듈은 파일을 "브라우저 메모리에서만" 읽는다. 서버/Storage/Supabase 저장 없음.
//  - 주민등록번호 원본은 절대 보관/반환하지 않는다.
//    파싱 즉시 생년월일·성별만 도출하고, 화면 표시는 마스킹값(900101-1******)만 사용한다.
//  - 결과는 "확정"이 아니라 1차 검토(가능성/확인 필요/추가자료 필요/판단 불가)로만 표시한다.
//  - 세액공제 단가는 귀속연도별로 바뀌므로 기본값은 "법령표 확인 필요" 전제의 편집 가능한 값이다.
// ============================================================

// ── 결과 단계(레벨) 정의 ──────────────────────────────────
export const LEVELS = {
  likely: { key: "likely", label: "가능성 높음", color: "#059669", bg: "#ECFDF5", bd: "#A7F3D0" },
  check:  { key: "check",  label: "확인 필요",   color: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" },
  more:   { key: "more",   label: "추가자료 필요", color: "#1D4ED8", bg: "#EFF6FF", bd: "#BFDBFE" },
  unknown:{ key: "unknown",label: "판단 불가",   color: "#64748B", bg: "#F1F5F9", bd: "#E2E8F0" },
};

// ── 지원금 정의(메타) ────────────────────────────────────
// site 는 공식 안내 참고용. classify 는 명부+추가입력으로 1차 분류만 한다.
export const SUBSIDY_DEFS = [
  { key: "youth_jump",      name: "청년일자리도약장려금",  site: "https://www.work24.go.kr", basis: "나이·입사일 1차 / 취업애로청년 요건 확인 필요" },
  { key: "emp_promo",       name: "고용촉진장려금",        site: "https://www.work24.go.kr", basis: "취업취약계층·워크넷 구직등록 등 추가자료 필요" },
  { key: "senior_continue", name: "고령자 계속고용장려금",  site: "https://www.work24.go.kr", basis: "연령 1차 / 정년·계속고용제도·취업규칙 확인 필요" },
  { key: "senior_intern",   name: "시니어 인턴십",         site: "https://www.kordi.or.kr",  basis: "연령 1차 / 참여기관·사업요건 확인 필요" },
  { key: "saeil_women",     name: "새일여성인턴제",         site: "https://saeil.mogef.go.kr", basis: "성별·연령 1차 / 경력단절 여부·새일센터 연계 확인 필요" },
  { key: "parental",        name: "육아휴직/대체인력 지원", site: "https://www.work24.go.kr", basis: "4대보험 명부만으로 확인 불가 · 추가자료 필요" },
];
export function subsidyName(key) {
  var f = SUBSIDY_DEFS.find(function (d) { return d.key === key; });
  return f ? f.name : key;
}

// ── 명부 컬럼 자동 인식 사전 ──────────────────────────────
export const ROSTER_FIELDS = [
  { key: "name",      aliases: ["성명", "이름", "근로자명", "가입자명", "직원명", "대상자명", "피보험자명", "성 명"] },
  { key: "rrn",       aliases: ["주민등록번호", "주민번호", "주민", "생년월일", "주민등록번호앞자리", "주민앞자리", "생년월일6자리", "주민(앞)"] },
  { key: "gender",    aliases: ["성별", "남녀구분", "성 별"] },
  { key: "hireDate",  aliases: ["자격취득일", "취득일", "자격취득연월일", "취득연월일", "입사일", "입사일자", "고용일", "고용일자", "취득일자"] },
  { key: "loseDate",  aliases: ["자격상실일", "상실일", "자격상실연월일", "퇴사일", "상실일자"] },
  { key: "status",    aliases: ["자격상태", "재직구분", "재직여부", "가입상태", "상태", "취득상실구분"] },
  { key: "insurance", aliases: ["보험구분", "가입보험", "보험종류", "적용보험", "가입여부", "보험"] },
  { key: "workplace", aliases: ["사업장명", "사업장", "사업장명칭", "상호", "상호명", "회사명", "기관명"] },
  { key: "bizNo",     aliases: ["사업자등록번호", "사업자번호", "사업장관리번호", "사업자", "관리번호"] },
];

function normHead(h) {
  return String(h == null ? "" : h).replace(/\(.*?\)|（.*?）/g, "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}
function digitsOnly(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

// 한 행을 헤더로 가정한 자동 매핑 ({fieldKey: colIndex|-1})
function autoMapRow(headerCells) {
  var norm = (headerCells || []).map(normHead);
  var map = {};
  ROSTER_FIELDS.forEach(function (f) {
    var exact = -1, partial = -1;
    norm.forEach(function (h, idx) {
      if (!h) return;
      if (f.aliases.some(function (a) { return normHead(a) === h; })) { if (exact === -1) exact = idx; return; }
      if (f.aliases.some(function (a) { var an = normHead(a); return an.length >= 2 && h.length >= 2 && (h.indexOf(an) >= 0 || an.indexOf(h) >= 0); })) { if (partial === -1) partial = idx; }
    });
    map[f.key] = exact >= 0 ? exact : partial;
  });
  // 한 컬럼이 여러 필드에 잡히면 첫 필드 우선(간단 처리)
  var used = {};
  ROSTER_FIELDS.forEach(function (f) {
    var c = map[f.key]; if (c == null || c < 0) return;
    if (used[c]) map[f.key] = -1; else used[c] = true;
  });
  return map;
}

// 헤더 행 자동 탐지 (앞 15행 중 매칭 점수 최고)
export function detectRoster(grid) {
  var best = 0, bestScore = 0, bestMap = null;
  for (var i = 0; i < Math.min(15, grid.length); i++) {
    var m = autoMapRow(grid[i] || []);
    var score = 0;
    ROSTER_FIELDS.forEach(function (f) { if (m[f.key] >= 0) score += (f.key === "name" || f.key === "rrn" || f.key === "hireDate") ? 3 : 1; });
    if (score > bestScore) { bestScore = score; best = i; bestMap = m; }
  }
  if (!bestMap) bestMap = autoMapRow(grid[0] || []);
  // 사업장/사업자번호는 헤더가 아닌 상단 안내영역에 있을 수 있어 보조 추출
  var meta = extractMeta(grid, best);
  return { headerIdx: best, map: bestMap, score: bestScore, meta: meta };
}

// 사업장명/사업자번호를 헤더 위 안내영역에서 보조 추출(있으면)
function extractMeta(grid, headerIdx) {
  var workplace = "", bizNo = "";
  for (var i = 0; i < Math.min(headerIdx + 1, grid.length); i++) {
    var row = grid[i] || [];
    for (var j = 0; j < row.length; j++) {
      var cell = String(row[j] == null ? "" : row[j]);
      if (!bizNo) { var bm = cell.match(/\d{3}-\d{2}-\d{5}/); if (bm) bizNo = bm[0]; }
      if (!workplace && /사업장|상호|회사명|기관명/.test(cell)) {
        var after = String(row[j + 1] == null ? "" : row[j + 1]).trim();
        if (after) workplace = after;
      }
    }
  }
  return { workplace: workplace, bizNo: bizNo };
}

// ── 날짜 정규화 → "YYYY-MM-DD" | null ─────────────────────
export function normDate(v) {
  if (v == null) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
  var s = String(v).trim(); if (!s) return null;
  if (/^\d{5}$/.test(s)) { var d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]; }
  var m = s.replace(/[.·/년월]/g, "-").replace(/일/g, "").replace(/\s+/g, "").replace(/-+/g, "-").replace(/-$/, "");
  if (/^\d{8}$/.test(m)) m = m.slice(0, 4) + "-" + m.slice(4, 6) + "-" + m.slice(6, 8);
  if (/^\d{6}$/.test(m)) { var yy = Number(m.slice(0, 2)); var cur = new Date().getFullYear() % 100; var century = yy <= cur ? 2000 : 1900; m = (century + yy) + "-" + m.slice(2, 4) + "-" + m.slice(4, 6); }
  var mm = m.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mm) { var y = Number(mm[1]), mo = Number(mm[2]), da = Number(mm[3]); if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) return y + "-" + pad2(mo) + "-" + pad2(da); }
  return null;
}

// ── 주민등록번호 → 생년월일/성별 도출 + 마스킹 ────────────
// 원본 RRN 은 반환하지 않는다.
export function deriveFromRRN(raw) {
  var d = digitsOnly(raw);
  if (d.length < 7) return null;
  var yy = d.slice(0, 2), mm = d.slice(2, 4), dd = d.slice(4, 6), g = d.charAt(6);
  var century = "12".indexOf(g) >= 0 ? 1900 : "34".indexOf(g) >= 0 ? 2000 : "56".indexOf(g) >= 0 ? 1900 : "78".indexOf(g) >= 0 ? 2000 : (g === "9" || g === "0") ? 1800 : null;
  var gender = "13579".indexOf(g) >= 0 ? "M" : "02468".indexOf(g) >= 0 ? "F" : null;
  // 9,0 보정 (9=남,0=여 는 위 규칙에 이미 포함)
  if (century === null) return { birthDate: null, gender: gender };
  var mo = Number(mm), da = Number(dd);
  var birthDate = (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) ? (century + Number(yy)) + "-" + pad2(mm) + "-" + pad2(dd) : null;
  return { birthDate: birthDate, gender: gender };
}
export function maskRRN(raw) {
  var d = digitsOnly(raw);
  if (d.length >= 7) return d.slice(0, 6) + "-" + d.charAt(6) + "******";
  if (d.length === 6) return d.slice(0, 6) + "-*******";
  return null;
}

// ── 나이 계산 (기준일 선택 가능) ─────────────────────────
export function calcAge(birthDate, baseDate) {
  if (!birthDate) return null;
  var b = new Date(birthDate), base = new Date(baseDate || new Date());
  if (isNaN(b.getTime()) || isNaN(base.getTime())) return null;
  var age = base.getFullYear() - b.getFullYear();
  var md = base.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && base.getDate() < b.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

function isLostStatus(raw) {
  var s = String(raw || "");
  return /상실|퇴사|해지|탈퇴|종료/.test(s);
}

// ── 명부 행 → 직원 객체 추출 (RRN 원본 미보관) ────────────
export function extractEmployees(grid, det) {
  var map = det.map, h = det.headerIdx;
  function cell(row, key) { var i = map[key]; return (i == null || i < 0) ? "" : String(row[i] == null ? "" : row[i]).trim(); }
  var out = [];
  for (var i = h + 1; i < grid.length; i++) {
    var row = grid[i];
    if (!row || row.every(function (v) { return String(v == null ? "" : v).trim() === ""; })) continue;
    var name = cell(row, "name");
    if (!name) continue;
    if (/^(합계|소계|총계|계|total|합 계)$/i.test(name.replace(/\s+/g, ""))) continue;

    var rrnRaw = cell(row, "rrn");
    var birthDate = null, gender = null, rrnMasked = null;
    var rd = digitsOnly(rrnRaw);
    if (rd.length >= 7) {
      var der = deriveFromRRN(rrnRaw);
      if (der) { birthDate = der.birthDate; gender = der.gender; }
      rrnMasked = maskRRN(rrnRaw);
    } else if (rrnRaw) {
      birthDate = normDate(rrnRaw);
      rrnMasked = rd.length === 6 ? maskRRN(rrnRaw) : null;
    }
    // 성별 컬럼이 명시되어 있으면 우선
    var gc = cell(row, "gender");
    if (/남|^m$|male/i.test(gc)) gender = "M"; else if (/여|^f$|female/i.test(gc)) gender = "F";

    out.push({
      name: name,
      birthDate: birthDate,           // 도출값(저장 안 함, 메모리 표시용)
      gender: gender,                 // 'M' | 'F' | null
      rrnMasked: rrnMasked,           // 마스킹값만
      hireDate: normDate(cell(row, "hireDate")),
      loseDate: normDate(cell(row, "loseDate")),
      statusRaw: cell(row, "status"),
      insuranceRaw: cell(row, "insurance"),
      workplace: cell(row, "workplace") || (det.meta && det.meta.workplace) || "",
      bizNo: cell(row, "bizNo") || (det.meta && det.meta.bizNo) || "",
    });
    // rrnRaw/rd 는 이 블록을 벗어나면 참조되지 않음 → 원본 미보관
  }
  return out;
}

// ── 파일 파싱 (엑셀/CSV) — 브라우저 메모리에서만 ──────────
// 반환: { ok, employees, meta, headerIdx, error }
export async function parseRosterFile(file) {
  var ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return { ok: false, error: "pdf_unsupported" };
  if (["xlsx", "xls", "csv"].indexOf(ext) === -1) return { ok: false, error: "unsupported" };
  try {
    var XLSX = await import("xlsx");
    var buf = await file.arrayBuffer();
    var wb = XLSX.read(buf, { type: "array", cellDates: true });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", dateNF: "yyyy-mm-dd" });
    if (!grid || grid.length < 2) return { ok: false, error: "empty" };
    var det = detectRoster(grid);
    var emps = extractEmployees(grid, det);
    if (!emps.length) return { ok: false, error: "no_rows", headerIdx: det.headerIdx };
    return { ok: true, employees: emps, meta: det.meta, headerIdx: det.headerIdx };
  } catch (e) {
    return { ok: false, error: "read_failed", message: e && e.message };
  }
}

// ── PDF 텍스트 추출 (브라우저 워커, 서버 업로드 없음) ──────
// pdfjs 본체는 사용 시점에만 동적 import. OCR 없음(텍스트 PDF 전용).
async function loadPdfDoc(file) {
  var pdfjs = await import("pdfjs-dist");
  // 워커 URL 도 사용 시점에만 로드(Vite 가 별도 에셋으로 방출). 본체/워커 모두 lazy.
  try {
    var workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch { /* worker 미설정 시 pdfjs 기본값 */ }
  var buf = await file.arrayBuffer();
  return pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableAutoFetch: true }).promise;
}

// 텍스트 아이템을 y좌표로 묶어 "줄" 문자열 배열로 변환
function groupItemsToLines(items) {
  var rows = {};
  (items || []).forEach(function (it) {
    if (!it || !it.str || !String(it.str).trim()) return;
    var tr = it.transform || [];
    var y = tr.length >= 6 ? Math.round(tr[5] / 2) * 2 : 0; // 미세한 y 차이 흡수
    var x = tr.length >= 6 ? tr[4] : 0;
    if (!rows[y]) rows[y] = [];
    rows[y].push({ x: x, s: it.str });
  });
  var keys = Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }); // 위→아래
  return keys.map(function (k) {
    return rows[k].sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s; }).join(" ").replace(/\s+/g, " ").trim();
  }).filter(function (l) { return l; });
}

// 각 페이지 텍스트를 줄 단위로 추출 (onProgress(phase, cur, total))
// opts.maxPages: 모바일 등에서 과부하 방지를 위해 처리 페이지 수 제한
export async function extractPdfLines(file, onProgress, opts) {
  opts = opts || {};
  var doc = await loadPdfDoc(file);
  var lines = [];
  var total = doc.numPages;
  var limit = opts.maxPages && opts.maxPages > 0 ? Math.min(opts.maxPages, total) : total;
  var truncated = limit < total;
  try {
    for (var p = 1; p <= limit; p++) {
      if (onProgress) onProgress("extract", p, limit);
      var page = await doc.getPage(p);
      var tc = await page.getTextContent();
      lines = lines.concat(groupItemsToLines(tc.items));
      try { page.cleanup(); } catch { /* ignore */ }
    }
  } finally {
    try { doc.destroy(); } catch { /* ignore */ }
  }
  return { lines: lines, totalPages: total, processedPages: limit, truncated: truncated };
}

// 헤더/합계 등 직원명이 아닌 토큰
var PDF_NAME_STOP = ["성명", "합계", "소계", "총계", "사업장", "가입자", "보험료", "국민연금", "건강보험", "고용보험", "산재보험", "연번", "순번", "번호", "자격", "취득", "상실", "구분", "비고", "주민", "생년", "입사", "퇴사", "대상", "근로자", "피보험자", "사업주", "관리"];
function cleanName(s) { return String(s || "").replace(/[^가-힣]/g, "").trim(); }

function extractPdfMeta(lines) {
  var workplace = "", bizNo = "";
  lines.slice(0, 20).forEach(function (l) {
    if (!bizNo) { var bm = l.match(/\d{3}-\d{2}-\d{5}/); if (bm) bizNo = bm[0]; }
    if (!workplace) {
      var wm = l.match(/사업장\s*(?:명|명칭)?\s*[:：]?\s*([가-힣A-Za-z0-9()㈜\s]{2,40})/);
      if (wm) {
        // 사업자/관리번호/숫자 구간 직전까지만 + 다중 공백 정리
        var v = wm[1].split(/사업자|관리번호|등록번호|\s{2,}|\s\d{3}-/)[0].replace(/\s+/g, " ").trim();
        if (v && !/^명/.test(v)) workplace = v;
      }
    }
  });
  return { workplace: workplace, bizNo: bizNo };
}

// PDF 텍스트 줄 → 직원 객체 (주민번호 원본 미보관 · 마스킹값만)
// 양식이 다양하므로 주민/생년 패턴이 있는 줄만 직원 행으로 추정한다.
export function parsePdfRosterLines(lines) {
  var meta = extractPdfMeta(lines);
  var emps = [];
  var missing = 0;
  (lines || []).forEach(function (line) {
    var rm = line.match(/(\d{6})\s*[-~]\s*([0-9*]{1,7})/);
    if (!rm) return; // 주민/생년 패턴 없는 줄 제외(헤더·합계·안내 회피)
    var front = rm[1];
    var genderDigit = (rm[2] || "").charAt(0);
    if (!/[0-9]/.test(genderDigit)) genderDigit = ""; // 성별 자리까지 마스킹된 경우
    var der = genderDigit ? deriveFromRRN(front + genderDigit) : { birthDate: normDate(front), gender: null };
    var rrnMasked = front + "-" + (genderDigit || "*") + "******";

    // 이름: 주민번호 앞 구간의 마지막 한글 토큰
    var before = line.slice(0, rm.index);
    var name = "";
    var tokens = before.split(/\s+/).filter(Boolean);
    for (var i = tokens.length - 1; i >= 0; i--) {
      var cand = cleanName(tokens[i]);
      if (cand.length >= 2 && cand.length <= 4 && PDF_NAME_STOP.indexOf(cand) === -1) { name = cand; break; }
    }
    if (!name) {
      var gm = before.match(/[가-힣]{2,4}/g);
      if (gm) { for (var j = gm.length - 1; j >= 0; j--) { if (PDF_NAME_STOP.indexOf(gm[j]) === -1) { name = gm[j]; break; } } }
    }

    // 날짜(취득/상실) — 주민번호 뒤 구간에서 탐지
    var after = line.slice(rm.index + rm[0].length);
    var dates = [];
    var dre = /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g;
    var dmm;
    while ((dmm = dre.exec(after))) { var nd = normDate(dmm[1] + "-" + dmm[2] + "-" + dmm[3]); if (nd) dates.push(nd); }

    var statusRaw = /상실|퇴사|해지|종료/.test(line) ? "상실" : /취득|정상|재직/.test(line) ? "취득" : "";

    var emp = {
      name: name || "(이름 확인 필요)",
      birthDate: der ? der.birthDate : null,
      gender: der ? der.gender : null,
      rrnMasked: rrnMasked,
      hireDate: dates[0] || null,
      loseDate: dates[1] || null,
      statusRaw: statusRaw,
      insuranceRaw: "",
      workplace: meta.workplace || "",
      bizNo: meta.bizNo || "",
    };
    if (!emp.birthDate || !emp.hireDate || !name) missing++;
    emps.push(emp);
    // front/genderDigit/rm 은 블록을 벗어나면 참조되지 않음 → 주민번호 원본 미보관
  });
  return { employees: emps, meta: meta, missingCount: missing };
}

// PDF 명부 파싱 (텍스트 추출 → 직원 추정). 스캔 이미지 PDF 는 no_text 반환.
// opts.maxPages 로 처리 페이지 수 제한(모바일 안정화).
export async function parsePdfRoster(file, onProgress, opts) {
  try {
    if (onProgress) onProgress("read");
    var ex = await extractPdfLines(file, onProgress, opts);
    var lines = ex.lines || [];
    var textLen = lines.join("").replace(/\s/g, "").length;
    if (!lines.length || textLen < 8) return { ok: false, error: "no_text" }; // 스캔 이미지 등 텍스트 없음
    if (onProgress) onProgress("find");
    var res = parsePdfRosterLines(lines);
    if (!res.employees.length) return { ok: false, error: "no_rows", truncated: ex.truncated, totalPages: ex.totalPages };
    return { ok: true, employees: res.employees, meta: res.meta, missingCount: res.missingCount, truncated: ex.truncated, totalPages: ex.totalPages, processedPages: ex.processedPages };
  } catch (e) {
    return { ok: false, error: "read_failed", message: e && e.message };
  }
}

// PDF 에서 "검수용 텍스트"만 추출(직원 추정 전 단계). 실패해도 text 는 가능한 만큼 반환.
export async function extractPdfText(file, onProgress, opts) {
  try {
    if (onProgress) onProgress("read");
    var ex = await extractPdfLines(file, onProgress, opts);
    var lines = ex.lines || [];
    var text = lines.join("\n");
    var textLen = text.replace(/\s/g, "").length;
    if (!lines.length || textLen < 8) return { ok: false, error: "no_text", text: text, truncated: ex.truncated, totalPages: ex.totalPages };
    return { ok: true, text: text, truncated: ex.truncated, totalPages: ex.totalPages, processedPages: ex.processedPages };
  } catch (e) {
    return { ok: false, error: "read_failed", message: e && e.message, text: "" };
  }
}

// 사용자가 검수·붙여넣기한 텍스트 → 직원 후보 추출 (PDF 줄 파서 재사용)
export function parseTextRoster(text) {
  var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  return parsePdfRosterLines(lines);
}

export function isYouthAge(age) { return age != null && age >= 15 && age <= 34; }
export function isSeniorAge(age) { return age != null && age >= 60; }

// ── 직원별 지원금 후보 1차 분류 ───────────────────────────
// opts: { baseDate, year }
export function classifyEmployee(emp, opts) {
  opts = opts || {};
  var base = opts.baseDate || new Date();
  var age = calcAge(emp.birthDate, base);
  var youth = isYouthAge(age);
  var senior = isSeniorAge(age);
  var female = emp.gender === "F";
  var active = !isLostStatus(emp.statusRaw);

  var recentHire = false;
  if (emp.hireDate) {
    var hd = new Date(emp.hireDate);
    var diff = (new Date(base) - hd) / 86400000;
    recentHire = diff >= 0 && diff <= 400; // 약 13개월 이내 입사 추정
  }

  var cands = [];
  if (youth) cands.push({ key: "youth_jump", level: "check", note: "청년 연령(만 " + age + "세) 1차 해당 · 취업애로청년 요건·신청기간 확인 필요" });
  if (recentHire) cands.push({ key: "emp_promo", level: "more", note: "신규 입사 추정 · 취업취약계층·워크넷 구직등록 등 추가자료 필요" });
  if (senior) {
    cands.push({ key: "senior_continue", level: "check", note: "고령 연령(만 " + age + "세) 1차 해당 · 정년·계속고용제도·취업규칙 확인 필요" });
    cands.push({ key: "senior_intern", level: "check", note: "고령 연령 1차 해당 · 참여기관·사업요건 확인 필요" });
  }
  if (female && age != null && age >= 20 && age <= 59) cands.push({ key: "saeil_women", level: "check", note: "여성 1차 해당 · 경력단절 여부·새일센터 연계 확인 필요" });

  return { age: age, isYouth: youth, isSenior: senior, isFemale: female, recentHire: recentHire, active: active, candidates: cands };
}

// ── 전체 분석 (직원 목록 → 진단 결과) ─────────────────────
// 반환: { rows:[{emp,diag}], counts, subsidySummary, estimatedYouth, estimatedTotal, estimatedNew }
export function analyzeRoster(employees, opts) {
  opts = opts || {};
  var base = opts.baseDate || new Date();
  var year = opts.year || new Date(base).getFullYear();

  var rows = employees.map(function (e) { return { emp: e, diag: classifyEmployee(e, { baseDate: base, year: year }) }; });
  var activeRows = rows.filter(function (r) { return r.diag.active; });

  var totalEmp = rows.length;
  var youthCount = activeRows.filter(function (r) { return r.diag.isYouth; }).length;
  var seniorCount = activeRows.filter(function (r) { return r.diag.isSenior; }).length;
  var generalCount = Math.max(0, activeRows.length - youthCount);
  var newHireCount = activeRows.filter(function (r) { return r.diag.recentHire; }).length;

  // 지원금별 요약 — 재직 추정 직원만 집계(퇴사/상실 추정 제외)
  var summary = SUBSIDY_DEFS.map(function (d) {
    var likely = 0, check = 0, more = 0;
    activeRows.forEach(function (r) {
      var c = r.diag.candidates.find(function (x) { return x.key === d.key; });
      if (!c) return;
      if (c.level === "likely") likely++; else if (c.level === "check") check++; else if (c.level === "more") more++;
    });
    var note = d.basis;
    var level = d.key === "parental" ? "more" : (likely > 0 ? "likely" : check > 0 ? "check" : more > 0 ? "more" : "unknown");
    return { key: d.key, name: d.name, site: d.site, likely: likely, check: check, more: more, candidateCount: likely + check, note: note, level: level };
  });

  // 후보 건수 / 확인 필요 항목 수 (재직 추정 기준)
  var candidateSubsidyCount = summary.filter(function (s) { return s.candidateCount > 0; }).length;
  var checkItemCount = activeRows.reduce(function (acc, r) { return acc + r.diag.candidates.filter(function (c) { return c.level === "check" || c.level === "more"; }).length; }, 0);

  return {
    rows: rows,
    counts: { totalEmp: totalEmp, youthCount: youthCount, seniorCount: seniorCount, generalCount: generalCount, newHireCount: newHireCount, activeCount: activeRows.length },
    subsidySummary: summary,
    candidateSubsidyCount: candidateSubsidyCount,
    checkItemCount: checkItemCount,
  };
}

// ── 통합고용세액공제 기본 단가 (만원/인, 편집 가능) ───────
// 귀속연도별로 바뀌므로 반드시 "법령표 확인 필요" 전제. 기본값은 참고용.
export function defaultTaxUnits(region, sizeType) {
  if (sizeType === "sme") return region === "local" ? { youth: 1550, normal: 950 } : { youth: 1450, normal: 850 };
  if (sizeType === "mid") return { youth: 800, normal: 450 };
  return { youth: 0, normal: 0 }; // 기타/확인 필요 → 직접 입력
}

// ── 통합고용세액공제 예상 검토 계산 ───────────────────────
// params: { region, sizeType, prevTotal, prevYouth, curTotal, curYouth, unitYouth, unitNormal }
// "모름"은 null 로 전달. 단가는 만원 단위. 반환 금액은 원 단위.
export function estimateTaxCredit(params) {
  var p = params || {};
  var computable = typeof p.prevTotal === "number" && typeof p.curTotal === "number";
  var incTotal = computable ? Math.max(0, p.curTotal - p.prevTotal) : null;

  var youthKnown = typeof p.prevYouth === "number" && typeof p.curYouth === "number";
  var incYouth = youthKnown ? Math.max(0, p.curYouth - p.prevYouth) : null;
  var incNormal = (incTotal != null && incYouth != null) ? Math.max(0, incTotal - incYouth) : null;

  var unitY = Number(p.unitYouth) || 0, unitN = Number(p.unitNormal) || 0;
  var creditYouth = incYouth != null ? incYouth * unitY * 10000 : null;
  var creditNormal = incNormal != null ? incNormal * unitN * 10000 : null;
  var creditTotal = (creditYouth || 0) + (creditNormal || 0);

  return {
    computable: computable,
    youthKnown: youthKnown,
    incTotal: incTotal,
    incYouth: incYouth,
    incNormal: incNormal,
    creditYouth: creditYouth,
    creditNormal: creditNormal,
    creditTotal: (creditYouth != null || creditNormal != null) ? creditTotal : null,
  };
}

// ── 세액공제 확인 필요 체크리스트(고정) ───────────────────
export const TAX_CHECKLIST = [
  "전년도 평균 상시근로자 수 확인",
  "월별 상시근로자 수 산정(평균) 확인",
  "기간 중 퇴사자 여부 확인",
  "특수관계인(친족 등) 제외 여부 확인",
  "소비성 서비스업 등 제외 업종 여부 확인",
  "최저한세·중복공제 적용 여부 확인",
  "세무대리인(세무사) 최종 검토 필요",
];

// ── 결과 요약 복사 문구 (민감정보 미포함) ─────────────────
export function buildCopyText(ctx) {
  var c = ctx || {};
  var lines = [];
  lines.push("[4대보험 가입자 명부 1차 검토 결과]");
  lines.push("");
  lines.push("· 명부 기준으로 1차 검토한 결과, 총 " + c.totalEmp + "명 중 " + c.youthCount + "명이 청년 등 요건 검토 대상으로 추정되며, " + c.candidateSubsidyCount + "건의 지원금 후보가 확인되었습니다.");
  if (c.seniorCount) lines.push("· 고령(만 60세 이상) 추정 인원은 " + c.seniorCount + "명입니다.");
  lines.push("· 통합고용세액공제는 전년도 인원 및 소재지 확인 후 예상 공제액 검토가 가능합니다.");
  if (c.estimate && c.estimate.computable && c.estimate.creditTotal != null) {
    lines.push("· (참고) 입력값 기준 예상 공제액은 약 " + formatWon(c.estimate.creditTotal) + " 수준으로 추정되나, 확정 금액이 아니며 세무 검토가 필요합니다.");
  }
  lines.push("");
  lines.push("※ 본 결과는 4대보험 명부 기준 1차 검토이며, 실제 신청·공제 가능 여부는 공식 요건과 추가자료, 세무·노무 검토가 필요합니다. (확정 아님)");
  return lines.join("\n");
}

export function formatWon(n) {
  if (n == null) return "—";
  if (n >= 100000000) return (Math.round(n / 1000000) / 100) + "억원";
  if (n >= 10000) return Math.round(n / 10000).toLocaleString() + "만원";
  return Math.round(n).toLocaleString() + "원";
}

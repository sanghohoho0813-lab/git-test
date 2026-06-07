import re
import streamlit as st
import pandas as pd
from collections import Counter
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

from youtube_api import fetch_all_data, load_cache

MY_CHANNEL_HANDLE = "김팀장의경영노트"  # @핸들에서 @ 제거한 값

STOP_WORDS = {
    # 조사/어미
    "이","그","저","것","수","등","및","에","를","을","가","의","은","는","로","으로",
    "에서","와","과","도","만","하는","하기","있는","없는","합니다","입니다","됩니다",
    "대한","위한","통해","위해","하면","하고","이번","지금","바로","정말","드디어",
    "속보","중요","긴급","총정리","요약","정리","방법","이유","결과","확인","신청",
    "까지","부터","동안","이후","이전","최대","최소","모든","각종","관련","내용",
    "사람","경우","우리","여기","어디","무엇","얼마","어떻게","하지","않는","없이",
    "있어","했다","된다","한다","않고","되고","하고","이런","그런","저런","어떤",
    "누가","뭔가","아직","이미","같은","다른","라는","라고","에도","에서는","으로는",
    # 화폐단위 — 숫자 제거 후 남는 단위어 ("55만원" → "만원")
    "만원","억원","천원","백원","십만","억대","만대","원짜리",
    # 접속사/부사 파편
    "그렇다면","이라면","따라서","그래서","하지만","그러나","그런데","그래도","이처럼",
    # 행정 단어 (단독으로는 주제 아님)
    "대상자","신청자","수혜자","수령자","신청하세요","확인하세요","보세요","아세요",
    # 동사/명령형 파편
    "꺼두","켜두","쉬세요","십시오","겠습니까","드립니다","합니다만","봅니다",
    "알려드림","알려드린","정리드림","설명드림","말씀드림","안내드림",
    # 시간
    "올해","내년","작년","지난해","이번달","지난달","다음달","요즘","최근",
    # 과도하게 일반적인 단어
    "정보","공지","발표","안내","시행","개정","최신","공개","단독","핵심","완벽",
    "비밀번호","아이디","이메일",
    # YouTube 제목 관용구 (주제 아님)
    "알아보자","살펴보자","해봅시다","총망라","세금신고","서류제출",
    # 화폐/금액 단위
    "천만원","천만","수수료","수수료율",
    # 행정 복합어 — 단독으론 주제 아님
    "신청방법","신청날짜","신청기간","신청서류",
    # 동사 원형 파편
    "줍니다","드립니다","나왔습니다","됐습니다","했습니다",
    # 사용자 지목 단어 — 너무 일반적이거나 채널명 파생
    "때문에","연매출","사장님","지자체","생활문화","위험한",
    "회계사","절세미녀","하이닉스","컨설턴트",
    # 지시·강조 부사 (부사는 키워드 아님)
    "이렇게","그렇게","저렇게","이러한","그러한","이러면","그러면",
    "무조건","결국엔","솔직히","정직하게",
    # 발화 동사 파편
    "알려드림","설명드림","말씀드림","안내드림",
}

# 동사/형용사 어미로 끝나는 단어 필터 (보시고, 신청해야, 있을까 등)
_VERB_ENDINGS = re.compile(
    r'(드림|드린|드릴|드렸|시고|세요|십시오|해야|이면|라면'
    r'|는지|은지|을까|없을|합니다|됩니다|니까|아세요|이야기'
    r'|하면서|이므로|보면서|했더니|됐더니|한다면|이라며|라며'
    r'|려면|려고|더라도|더라면|했는데|됐는데|대해서'
    r'|니다|지는|이는|으로|아요|어요|는데|은데|ㄴ다면'
    # 추가: 동사·형용사 활용형 전반
    r'|나요|리는|오는|하면|드는|르면|한다|된다'
    r'|는|한|은)$'  # 관계절(-는), 형용사(-한), 주제격(-은) 어미
)

# 채널 제목에서 추출한 단어들 — 채널명 파편이 키워드로 오염되는 것 방지
# ch_map 빌드 후 채워짐
_CHANNEL_TITLE_WORDS: set = set()

def is_meaningful(word: str) -> bool:
    """키워드로 표시할 가치가 있는 단어인지 판단."""
    return (
        word not in STOP_WORDS
        and not _VERB_ENDINGS.search(word)
        and word not in _CHANNEL_TITLE_WORDS
    )

COPY_TEMPLATE_SETS = [
    [
        "{kw} 완벽 정리 | 소상공인이 절대 놓치면 안 되는 핵심",
        "지금 당장 확인! {kw} — 이것만 알면 됩니다",
        "{kw}, 사장님 유형별 대처법 총정리",
    ],
    [
        "모르면 손해! {kw} 한 번에 정리해드립니다",
        "{kw} 신청 전에 이것 먼저 보세요",
        "사장님들 주목! {kw} A to Z 완벽 가이드",
    ],
    [
        "{kw}, 지금 바로 확인하세요 | 실전 핵심 정리",
        "{kw}으로 달라지는 것들 | 핵심만 짚어드립니다",
        "꼭 알아야 할 {kw} | 놓치면 진짜 손해",
    ],
    [
        "{kw} 완전 정복 | 처음부터 끝까지",
        "{kw} 제대로 활용하는 법 | 실전 가이드",
        "{kw} 핵심 포인트 3가지 | 사장님들 보세요",
    ],
]

st.set_page_config(
    page_title="김팀장 벤치마킹 대시보드",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# 레이아웃 열 수 — 기본 2열 (모바일 최적화)
if "ncols" not in st.session_state:
    st.session_state.ncols = 2

st.markdown("""
<style>
/* ─── Inter font ──────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
html, body, [class*="css"], .stMarkdown, .stApp {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}

/* ─── App background ─────────────────────────────────────── */
.stApp { background: #0b0b14 !important; }

/* ─── Grid card ──────────────────────────────────────────── */
.grid-card {
    background: #16162a;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 16px;
    box-shadow: 0 2px 20px rgba(0,0,0,0.45);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.grid-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 40px rgba(0,0,0,0.65);
    border-color: rgba(255,255,255,0.13);
}
.grid-card.mine {
    border: 1.5px solid rgba(251,191,36,0.5);
    box-shadow: 0 4px 24px rgba(251,191,36,0.12), 0 2px 20px rgba(0,0,0,0.45);
}

/* ─── Thumbnail ──────────────────────────────────────────── */
.thumb-wrap { display:block; position:relative; width:100%; }
.thumb-wrap img {
    width:100%; display:block;
    border-radius:16px 16px 0 0;
    aspect-ratio:16/9; object-fit:cover;
}

/* ─── Badges ─────────────────────────────────────────────── */
.rank-badge {
    position:absolute; top:8px; left:8px;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    font-size:14px; font-weight:900;
    padding:3px 9px; border-radius:8px;
    pointer-events:none;
    border: 1px solid rgba(255,255,255,0.1);
}
.mine-badge {
    position:absolute; top:8px; right:8px;
    background: rgba(251,191,36,0.9);
    color:#000; font-size:10px; font-weight:900;
    padding:2px 7px; border-radius:6px;
    pointer-events:none;
}
.rising-badge {
    position:absolute; bottom:8px; right:8px;
    background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
    color:#fff; font-size:10px; font-weight:900;
    padding:2px 7px; border-radius:6px;
    pointer-events:none;
}

/* ─── Card body ──────────────────────────────────────────── */
.card-body { padding: 11px 13px 13px; }
.card-channel {
    font-size:10px; color:#55556a;
    margin-bottom:3px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    text-transform:uppercase; letter-spacing:0.05em;
}
.card-title {
    font-size:13px; font-weight:700; color:#ddddf0;
    line-height:1.45;
    display:-webkit-box; -webkit-line-clamp:2;
    -webkit-box-orient:vertical; overflow:hidden;
    min-height:38px; margin-bottom:8px;
    text-decoration:none;
}
.card-title:hover { color:#9898e8; }
.card-stats { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }

/* ─── Pills ──────────────────────────────────────────────── */
.pill {
    font-size:10px; font-weight:600;
    padding:3px 8px; border-radius:20px;
    white-space:nowrap;
}
.pill-view  { background:rgba(59,130,246,0.16); color:#7ec8e3; }
.pill-like  { background:rgba(139,92,246,0.16); color:#c4b5fd; }
.pill-cmt   { background:rgba(52,211,153,0.14); color:#6ee7b7; }
.pill-short { background:rgba(236,72,153,0.16); color:#f9a8d4; }
.pill-long  { background:rgba(20,184,166,0.14); color:#5eead4; }
.pill-date  { background:rgba(255,255,255,0.04); color:#44445a; }
.pill-mine  { background:rgba(251,191,36,0.16); color:#fcd34d; }
.pill-rate  { background:rgba(74,222,128,0.14); color:#4ade80; }

/* ─── Summary boxes ─────────────────────────────────────── */
.summary-box {
    background: #16162a;
    border-radius:14px;
    padding:16px 18px;
    border: 1px solid rgba(255,255,255,0.06);
    text-align:center; margin-bottom:18px;
    box-shadow: 0 2px 14px rgba(0,0,0,0.32);
}
.summary-label {
    font-size:10px; color:#44445a; margin-bottom:5px;
    text-transform:uppercase; letter-spacing:0.06em; font-weight:600;
}
.summary-value { font-size:26px; font-weight:900; color:#ededf5; }
.summary-sub   { font-size:11px; color:#38384e; margin-top:4px; }

/* ─── Keyword section ────────────────────────────────────── */
.keyword-section {
    background: #16162a;
    border-radius:14px;
    padding:14px 18px;
    border: 1px solid rgba(255,255,255,0.06);
    margin-bottom:18px;
}
.keyword-title {
    font-size:10px; color:#44446a;
    margin-bottom:10px; font-weight:700;
    text-transform:uppercase; letter-spacing:0.06em;
}
.kw-tag {
    display:inline-block;
    background:rgba(91,141,238,0.12);
    color:#7eb8f0;
    border:1px solid rgba(91,141,238,0.2);
    border-radius:20px;
    padding:4px 12px; margin:3px;
    font-size:12px; font-weight:700;
}
.kw-tag.top3 {
    background:rgba(251,191,36,0.14);
    color:#fcd34d;
    border-color:rgba(251,191,36,0.28);
    font-size:13px;
}

/* ─── Topic rec cards ────────────────────────────────────── */
.topic-rec-card {
    background: #13132a;
    border-radius:14px;
    padding:18px 20px;
    border: 1px solid rgba(255,255,255,0.06);
    margin-bottom:16px; height:100%;
    box-shadow: 0 2px 16px rgba(0,0,0,0.35);
}
.topic-rank {
    font-size:10px; color:#4466bb; font-weight:700; margin-bottom:4px;
    text-transform:uppercase; letter-spacing:0.05em;
}
.topic-keyword { font-size:20px; font-weight:900; color:#fbbf24; margin-bottom:8px; }
.topic-stat    { font-size:12px; color:#5577aa; margin-bottom:8px; }
.topic-rep     { font-size:11px; color:#44445a; margin-bottom:12px; line-height:1.5; }
.topic-ideas-title {
    font-size:10px; color:#7799bb; font-weight:700; margin-bottom:7px;
    text-transform:uppercase; letter-spacing:0.05em;
}
.topic-idea {
    font-size:12px; color:#99aacc; margin-bottom:5px; line-height:1.5;
    padding:6px 11px; background:rgba(255,255,255,0.04); border-radius:7px;
}

/* ─── Analysis sections ──────────────────────────────────── */
.analysis-section {
    background: #16162a;
    border-radius:14px;
    padding:18px 22px;
    border: 1px solid rgba(255,255,255,0.06);
    margin-bottom:22px;
    box-shadow: 0 2px 14px rgba(0,0,0,0.32);
}
.analysis-title { font-size:17px; font-weight:800; color:#ddddf0; margin-bottom:4px; }
.analysis-desc  { font-size:12px; color:#38385a; margin-bottom:14px; }

/* ─── Weekly banner ──────────────────────────────────────── */
.weekly-banner { display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.weekly-mini-card {
    flex:1; min-width:110px;
    background: #13132a;
    border-radius:10px;
    padding:10px 14px;
    border: 1px solid rgba(255,255,255,0.07);
    display:flex; align-items:center; gap:8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}
.wmini-rank { font-size:10px; color:#3355aa; font-weight:800; white-space:nowrap; }
.wmini-kw   { font-size:13px; font-weight:900; color:#fbbf24; }
.wmini-stat { font-size:10px; color:#333352; margin-left:auto; white-space:nowrap; }
</style>
""", unsafe_allow_html=True)

# ── 헤더 ───────────────────────────────────────────────────────
api_key = st.secrets.get("youtube_api_key", "")
cache   = load_cache()

hc1, hc2, hc3, hc4, hc5 = st.columns([3, 1, 1, 1, 2])
with hc1:
    st.markdown("## 📊 김팀장 벤치마킹 대시보드")
with hc2:
    do_refresh = st.button("🔄 새로고침", use_container_width=True)
with hc3:
    if cache:
        _csv_bytes = (
            pd.DataFrame(cache.get("videos", []))
            .to_csv(index=False, encoding="utf-8-sig")
            .encode("utf-8-sig")
        )
        st.download_button(
            "📥 CSV", data=_csv_bytes,
            file_name=f"videos_{datetime.now(KST).strftime('%Y%m%d')}.csv",
            mime="text/csv", use_container_width=True,
        )
with hc4:
    if st.session_state.ncols == 2:
        if st.button("💻 5열", use_container_width=True, help="PC 5열 보기로 전환"):
            st.session_state.ncols = 5
            st.rerun()
    else:
        if st.button("📱 2열", use_container_width=True, help="모바일 2열 보기로 전환"):
            st.session_state.ncols = 2
            st.rerun()
with hc5:
    if cache:
        dt = datetime.fromisoformat(cache["fetched_at"]).astimezone(KST)
        st.caption(f"마지막 수집: {dt.strftime('%Y-%m-%d %H:%M')} (KST)")

# ── 세션 첫 진입 시 자동 새로고침 (캐시 파일 없을 때만) ───────────
# 캐시 파일이 존재하면 자동 수집을 건너뜀 — 수동 새로고침 버튼으로 제어
if not st.session_state.get("auto_refreshed") and api_key and cache is None:
    st.session_state.auto_refreshed = True
    with st.spinner("최신 데이터 불러오는 중..."):
        cache = fetch_all_data(api_key)
    st.rerun()
else:
    st.session_state.auto_refreshed = True  # 이후 세션 재진입 시 재발동 방지

if do_refresh:
    if not api_key:
        st.error("API 키가 설정되지 않았습니다.")
        st.stop()
    with st.spinner("유튜브 데이터 수집 중... (1~2분 소요)"):
        cache = fetch_all_data(api_key)
    st.rerun()

if not cache:
    st.info("'🔄 새로고침' 버튼을 눌러 데이터를 가져오세요.")
    st.stop()

channels_raw = cache.get("channels", [])
videos_raw   = cache.get("videos", [])
if not videos_raw:
    st.warning(
        "**데이터 수집에 실패했습니다.**\n\n"
        "원인은 대부분 **YouTube API 일일 할당량 초과(10,000 유닛/일)**입니다.  \n"
        "Google 할당량은 **태평양 시간 자정(한국 시간 매일 오후 4시, 16:00 KST)**에 초기화됩니다.  \n"
        "오늘 **오후 4시 이후** 🔄 새로고침 버튼을 눌러주세요."
    )
    st.stop()

# 내 채널 ID를 캐시된 채널 목록에서 핸들로 검색
_my_ch = next(
    (r for r in channels_raw
     if r.get("custom_url", "").lower() == MY_CHANNEL_HANDLE.lower()
     or MY_CHANNEL_HANDLE.lower() in r.get("title", "").lower()),
    None
)
MY_CHANNEL_ID = _my_ch["channel_id"] if _my_ch else ""

def duration_bucket(sec: int) -> str:
    if sec <= 60:   return "① 쇼츠 (1분 이하)"
    if sec <= 300:  return "② 5분 이하"
    if sec <= 900:  return "③ 5~15분"
    if sec <= 1800: return "④ 15~30분"
    return "⑤ 30분 이상"

ch_map   = {r["channel_id"]: r["title"] for r in channels_raw}

# 채널 제목에서 4자+ 한글 단어를 추출 → 채널명 파편이 키워드로 노출되는 것 방지
_CHANNEL_TITLE_WORDS.clear()
for _ct in ch_map.values():
    for _cw in re.findall(r"[가-힣]{4,}", _ct):
        _CHANNEL_TITLE_WORDS.add(_cw)

vdf      = pd.DataFrame(videos_raw)
vdf["published_at"]     = pd.to_datetime(vdf["published_at"], utc=True)
vdf["days_ago"]         = (datetime.now(KST) - vdf["published_at"].dt.tz_convert(KST)).dt.days
vdf["channel_name"]     = vdf["channel_id"].map(ch_map).fillna("알 수 없음")
vdf["is_mine"]          = (vdf["channel_id"] == MY_CHANNEL_ID) if MY_CHANNEL_ID else False
vdf["duration_bucket"]  = vdf["duration_sec"].apply(duration_bucket)
vdf["weekday"]          = vdf["published_at"].dt.tz_convert(KST).dt.dayofweek
vdf["upload_hour"]      = vdf["published_at"].dt.tz_convert(KST).dt.hour

# ── 필터 ────────────────────────────────────────────────────────
st.markdown("---")
fc1, fc2, fc3, fc4 = st.columns([2, 2, 3, 1])
with fc1:
    type_filter = st.radio("영상 종류", ["전체", "롱폼만", "쇼츠만"], horizontal=True)
with fc2:
    sort_by = st.radio("정렬 기준", ["조회수순"], horizontal=True)
with fc3:
    all_ch = sorted(vdf["channel_name"].unique().tolist())
    sel_ch = st.multiselect("채널 선택 (선택 안 하면 전체)", all_ch, placeholder="채널을 골라보세요...")
with fc4:
    top_n = st.selectbox("표시 개수", [20, 30, 40, 60], index=1)

def apply_filter(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    if type_filter == "롱폼만":
        d = d[~d["is_short"]]
    elif type_filter == "쇼츠만":
        d = d[d["is_short"]]
    if sel_ch:
        d = d[d["channel_name"].isin(sel_ch)]
    return d

# ── 키워드 추출 ────────────────────────────────────────────────
def _extract_keyword_list(df: pd.DataFrame, max_kw: int = 15) -> list:
    """조회수 가중 키워드 목록 [(word, video_count), ...] 반환."""
    word_scores: Counter = Counter()
    word_video_cnt: Counter = Counter()
    word_channels: dict = {}   # word → set of channel names

    for _, row in df.iterrows():
        title = str(row["title"])
        views = max(int(row.get("view_count", 1)), 1)
        channel = str(row.get("channel_name", ""))
        tokens = re.findall(r"[가-힣]{3,}", title)
        filtered = [w for w in tokens if is_meaningful(w)]
        seen = set()

        for w in filtered:
            word_scores[w] += views
            if w not in seen:
                word_video_cnt[w] += 1
                word_channels.setdefault(w, set()).add(channel)
                seen.add(w)

        for i in range(len(filtered) - 1):
            phrase = filtered[i] + " " + filtered[i + 1]
            word_scores[phrase] += int(views * 1.3)
            if phrase not in seen:
                word_video_cnt[phrase] += 1
                word_channels.setdefault(phrase, set()).add(channel)
                seen.add(phrase)

    return [
        (w, word_video_cnt[w]) for w, _ in word_scores.most_common()
        if word_video_cnt[w] >= 2 and len(word_channels.get(w, set())) >= 2
    ][:max_kw]


def render_keywords(df: pd.DataFrame, tab_key: str = "") -> str | None:
    """키워드 섹션 렌더링 + 클릭 필터 pills. 선택된 키워드(없으면 None) 반환."""
    qualified = _extract_keyword_list(df)
    if not qualified:
        return None

    tags = ""
    for i, (word, cnt) in enumerate(qualified):
        cls = "kw-tag top3" if i < 3 else "kw-tag"
        tags += f'<span class="{cls}">#{word} <small style="opacity:.55">({cnt}영상)</small></span>'
    st.markdown(f"""
    <div class="keyword-section">
        <div class="keyword-title">🔑 인기 핵심 키워드 — 클릭 시 관련 영상만 표시</div>
        {tags}
    </div>""", unsafe_allow_html=True)

    kw_options = ["전체 보기"] + [w for w, _ in qualified]
    choice = st.radio(
        "키워드 필터 (선택 → 관련 영상만 / 전체 보기 → 전체)",
        kw_options,
        horizontal=True,
        index=0,
        key=f"kw_pills_{tab_key or 'default'}",
        label_visibility="collapsed",
    )
    return None if choice == "전체 보기" else choice

# ── 주목 콘텐츠 추천 ──────────────────────────────────────────
def _extract_top_topics(df: pd.DataFrame, n: int = 4) -> list:
    """상위 n개 주제 [(keyword, topic_data_dict), ...] 반환."""
    word_scores: Counter = Counter()
    video_cnt: Counter = Counter()
    topic_data: dict = {}

    for _, row in df.iterrows():
        title = str(row["title"])
        views = max(int(row.get("view_count", 1)), 1)
        channel = str(row.get("channel_name", ""))
        tokens = re.findall(r"[가-힣]{3,}", title)
        filtered = [w for w in tokens if is_meaningful(w)]
        seen = set()

        for w in filtered:
            word_scores[w] += views
            if w not in seen:
                video_cnt[w] += 1
                seen.add(w)
            if w not in topic_data:
                topic_data[w] = {"videos": [], "channels": set()}
            topic_data[w]["videos"].append((title, channel, views))
            topic_data[w]["channels"].add(channel)

        for i in range(len(filtered) - 1):
            phrase = filtered[i] + " " + filtered[i + 1]
            word_scores[phrase] += int(views * 1.3)
            if phrase not in seen:
                video_cnt[phrase] += 1
                seen.add(phrase)
            if phrase not in topic_data:
                topic_data[phrase] = {"videos": [], "channels": set()}
            topic_data[phrase]["videos"].append((title, channel, views))
            topic_data[phrase]["channels"].add(channel)

    phrases = [(w, s) for w, s in word_scores.most_common()
               if " " in w and video_cnt[w] >= 2
               and len(topic_data[w]["channels"]) >= 2]
    singles = [(w, s) for w, s in word_scores.most_common()
               if " " not in w and video_cnt[w] >= 3
               and len(topic_data[w]["channels"]) >= 2]

    seen_words: set = set()
    candidates: list = []
    for word, _ in phrases:
        if len(candidates) >= n:
            break
        candidates.append((word, topic_data[word]))
        for part in word.split():
            seen_words.add(part)
    for word, _ in singles:
        if len(candidates) >= n:
            break
        if word not in seen_words:
            candidates.append((word, topic_data[word]))

    return candidates


def render_topic_recommendations(df: pd.DataFrame, section_label: str = ""):
    """상위 4개 주목 주제를 카피라이팅 아이디어와 함께 표시."""
    candidates = _extract_top_topics(df, n=4)

    if not candidates:
        st.info("이 기간 2개 이상 채널에서 다룬 공통 주제가 없습니다.")
        return

    if section_label:
        st.markdown(f"##### {section_label}")

    left_col, right_col = st.columns(2)
    col_pair = [left_col, right_col]

    for rank, (keyword, data) in enumerate(candidates):
        vids = sorted(data["videos"], key=lambda x: x[2], reverse=True)
        ch_count = len(data["channels"])
        top_title, top_channel, top_views = vids[0]
        avg_views = int(sum(v[2] for v in vids) / len(vids))

        templates = COPY_TEMPLATE_SETS[rank % len(COPY_TEMPLATE_SETS)]
        ideas_html = "".join(
            f'<div class="topic-idea">· {t.format(kw=keyword)}</div>'
            for t in templates
        )
        title_esc   = top_title.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        channel_esc = top_channel.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

        card = (
            f'<div class="topic-rec-card">'
            f'<div class="topic-rank">#{rank + 1} 주목 주제</div>'
            f'<div class="topic-keyword">🔥 {keyword}</div>'
            f'<div class="topic-stat">{ch_count}개 채널 다룸 &nbsp;·&nbsp; 최고 {top_views:,}회 &nbsp;·&nbsp; 평균 {avg_views:,}회</div>'
            f'<div class="topic-rep">대표 영상: <em>"{title_esc}"</em> ({channel_esc})</div>'
            f'<div class="topic-ideas-title">📝 제목 아이디어</div>'
            f'{ideas_html}'
            f'</div>'
        )
        with col_pair[rank % 2]:
            st.markdown(card, unsafe_allow_html=True)


# ── 카드 HTML 생성 ──────────────────────────────────────────────
NCOLS = st.session_state.ncols

def build_card(rank: int, row, avg_views: int = 0) -> str:
    vid_id  = str(row.get("video_id", ""))
    thumb   = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else ""
    url     = str(row["url"])
    title   = str(row["title"]).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    channel = str(row["channel_name"]).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    raw_views  = int(row["view_count"])
    raw_likes  = int(row["like_count"])
    views      = f"{raw_views:,}"
    likes      = f"{raw_likes:,}"
    cmts       = f"{int(row['comment_count']):,}"
    like_rate  = round(raw_likes / raw_views * 100, 1) if raw_views > 0 else 0.0
    rate_str   = f"{like_rate:.1f}%"
    dt      = row["published_at"]
    date    = f"{dt.year}년 {dt.month}월 {dt.day}일"
    t_cls   = "pill-short" if row["is_short"] else "pill-long"
    t_txt   = "쇼츠" if row["is_short"] else "롱폼"
    is_mine = bool(row.get("is_mine", False))
    is_rising = (
        int(row.get("days_ago", 999)) <= 14
        and avg_views > 0
        and raw_views >= avg_views * 2
    )

    if rank == 1:   rc = "#fbbf24"
    elif rank == 2: rc = "#c0c0c0"
    elif rank == 3: rc = "#cd7f32"
    else:           rc = "#66668a"

    mine_cls      = " mine" if is_mine else ""
    mine_badge    = '<span class="mine-badge">👤 내 채널</span>' if is_mine else ""
    rising_badge  = '<span class="rising-badge">🚀 급상승</span>' if is_rising else ""
    mine_pill     = '<span class="pill pill-mine">👤 내 채널</span>' if is_mine else ""

    return (
        f'<div class="grid-card{mine_cls}">'
        f'<a class="thumb-wrap" href="{url}" target="_blank">'
        f'<img src="{thumb}" alt="thumbnail" loading="lazy">'
        f'<span class="rank-badge" style="color:{rc}">#{rank}</span>'
        f'{mine_badge}'
        f'{rising_badge}'
        f'</a>'
        f'<div class="card-body">'
        f'<div class="card-channel">{channel}</div>'
        f'<a href="{url}" target="_blank" style="text-decoration:none;">'
        f'<div class="card-title">{title}</div>'
        f'</a>'
        f'<div class="card-stats">'
        f'<span class="pill pill-view">👁 {views}</span>'
        f'<span class="pill pill-like">👍 {likes}</span>'
        f'<span class="pill pill-cmt">💬 {cmts}</span>'
        f'<span class="pill pill-rate">❤️ {rate_str}</span>'
        f'<span class="pill {t_cls}">{t_txt}</span>'
        f'<span class="pill pill-date">📅 {date}</span>'
        f'{mine_pill}'
        f'</div>'
        f'</div>'
        f'</div>'
    )

def render_grid(df: pd.DataFrame, tab_key: str = "default"):
    if df.empty:
        st.info("해당 기간에 영상이 없습니다.")
        return

    # 키워드 섹션 + pills 클릭 필터
    selected_kw = render_keywords(df, tab_key=tab_key)

    # 키워드 선택 시 해당 키워드 포함 영상만
    display_df = df
    if selected_kw:
        if " " in selected_kw:
            parts = selected_kw.split()
            mask = df["title"].apply(lambda t: all(p in str(t) for p in parts))
        else:
            mask = df["title"].str.contains(re.escape(selected_kw), na=False)
        display_df = df[mask]
        if display_df.empty:
            st.info(f"'{selected_kw}' 포함 영상이 없습니다.")
            return

    # 그리드 표시용: 조회수 상위 top_n 개만
    dsp = display_df.nlargest(top_n, "view_count").reset_index(drop=True)

    top_v = dsp.iloc[0]
    avg_v = int(dsp["view_count"].mean())
    total = len(dsp)
    mine_rows = dsp[dsp["is_mine"]]

    s1, s2, s3 = st.columns(3)
    with s1:
        st.markdown(f"""<div class="summary-box">
            <div class="summary-label">👑 조회수 1위</div>
            <div class="summary-value">{int(top_v['view_count']):,}회</div>
            <div class="summary-sub">{top_v['channel_name']}</div>
        </div>""", unsafe_allow_html=True)
    with s2:
        st.markdown(f"""<div class="summary-box">
            <div class="summary-label">📊 평균 조회수</div>
            <div class="summary-value">{avg_v:,}회</div>
            <div class="summary-sub">분석 영상 {total}개</div>
        </div>""", unsafe_allow_html=True)
    with s3:
        if not mine_rows.empty:
            best = mine_rows.iloc[0]
            best_rank = int(mine_rows.index[0]) + 1
            st.markdown(f"""<div class="summary-box" style="border-color:rgba(251,191,36,0.4);">
                <div class="summary-label">👤 내 채널 최고 순위</div>
                <div class="summary-value" style="color:#fbbf24;">#{best_rank}위</div>
                <div class="summary-sub">👁 {int(best['view_count']):,}회</div>
            </div>""", unsafe_allow_html=True)
        else:
            top2 = dsp.iloc[1] if len(dsp) > 1 else top_v
            st.markdown(f"""<div class="summary-box">
                <div class="summary-label">🥈 조회수 2위</div>
                <div class="summary-value">{int(top2['view_count']):,}회</div>
                <div class="summary-sub">{top2['channel_name']}</div>
            </div>""", unsafe_allow_html=True)

    period_avg = int(display_df["view_count"].mean()) if not display_df.empty else 0

    ncols = st.session_state.ncols
    col_buckets: list[list[str]] = [[] for _ in range(ncols)]
    for i, row in dsp.iterrows():
        col_buckets[i % ncols].append(build_card(i + 1, row, period_avg))

    cols = st.columns(ncols)
    for col_widget, cards in zip(cols, col_buckets):
        with col_widget:
            st.markdown("".join(cards), unsafe_allow_html=True)

# ── 이번 주 핫토픽 배너 ──────────────────────────────────────────
_banner_topics = _extract_top_topics(vdf[vdf["days_ago"] <= 7], n=3)
if _banner_topics:
    _banner_html = ""
    for _bi, (_bkw, _bdata) in enumerate(_banner_topics):
        _bvids = sorted(_bdata["videos"], key=lambda x: x[2], reverse=True)
        _btv   = _bvids[0][2] if _bvids else 0
        _bcc   = len(_bdata["channels"])
        _banner_html += (
            f'<div class="weekly-mini-card">'
            f'<span class="wmini-rank">#{_bi+1}</span>'
            f'<span class="wmini-kw">{_bkw}</span>'
            f'<span class="wmini-stat">{_bcc}채널 · {_btv:,}뷰</span>'
            f'</div>'
        )
    st.markdown(
        f'<div style="font-size:11px;color:#334488;font-weight:700;margin-bottom:6px;'
        f'text-transform:uppercase;letter-spacing:0.06em;">⚡ 이번 주 주목 주제 TOP 3</div>'
        f'<div class="weekly-banner">{_banner_html}</div>',
        unsafe_allow_html=True,
    )

# ── 탭 ────────────────────────────────────────────────────────
tab1, tab2, tab3, tab_shorts, tab_rec, tab4, tab5 = st.tabs([
    "🔥 이번 주 TOP",
    "📅 이번 달 TOP",
    "🏆 올해 TOP",
    "⚡ 쇼츠 TOP",
    "📌 콘텐츠 추천",
    "📊 채널 현황",
    "🔍 심층 분석",
])

with tab1:
    st.caption("최근 7일 이내 업로드 기준")
    render_grid(apply_filter(vdf[vdf["days_ago"] <= 7]), tab_key="week")

with tab2:
    st.caption("최근 30일 이내 업로드 기준")
    render_grid(apply_filter(vdf[vdf["days_ago"] <= 30]), tab_key="month")

with tab3:
    st.caption("최근 365일 이내 업로드 기준 · 채널 선택 필터 적용")
    _df3 = vdf[vdf["days_ago"] <= 365].copy()
    if type_filter == "롱폼만":
        _df3 = _df3[~_df3["is_short"]]
    elif type_filter == "쇼츠만":
        _df3 = _df3[_df3["is_short"]]
    if sel_ch:
        _df3 = _df3[_df3["channel_name"].isin(sel_ch)]
    render_grid(_df3, tab_key="year")

with tab_shorts:
    st.caption("최근 90일 쇼츠 영상 기준 · 채널 선택 필터 적용")
    shorts_df = vdf[(vdf["is_short"]) & (vdf["days_ago"] <= 90)].copy()
    if sel_ch:
        shorts_df = shorts_df[shorts_df["channel_name"].isin(sel_ch)]
    render_grid(shorts_df, tab_key="shorts")

with tab_rec:
    st.markdown("### 📌 콘텐츠 주제 추천")
    st.caption("벤치마킹 채널에서 2개 이상 다룬 주제만 표시 · 2단어 구절 우선 선정 · 조회수 가중 점수 기준")
    st.markdown("---")

    rec_w7  = apply_filter(vdf[vdf["days_ago"] <= 7])
    rec_w30 = apply_filter(vdf[vdf["days_ago"] <= 30])

    st.markdown("#### 🔥 이번 주 주목 주제 (최근 7일)")
    render_topic_recommendations(rec_w7)
    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown("#### 📅 이번 달 주목 주제 (최근 30일)")
    render_topic_recommendations(rec_w30)

with tab4:
    st.subheader("벤치마킹 채널 현황")
    if channels_raw:
        ch_df = pd.DataFrame(channels_raw)[["channel_id","title","subscriber_count","video_count","view_count"]]
        ch_df["구독자당 조회수"] = (
            ch_df["view_count"] / ch_df["subscriber_count"].replace(0, 1)
        ).round(1)
        ch_df["내 채널"] = ch_df["channel_id"].apply(lambda x: "👤" if x == MY_CHANNEL_ID else "")
        ch_df = ch_df.drop(columns=["channel_id"])
        ch_df.columns = ["채널명","구독자 수","총 영상 수","총 조회수","구독자당 조회수",""]
        ch_df = ch_df.sort_values("구독자 수", ascending=False).reset_index(drop=True)
        ch_df.index += 1
        st.caption("구독자당 조회수: 총 조회수 ÷ 구독자 수 — 숫자가 클수록 구독자 규모 대비 영향력이 큰 채널")
        st.dataframe(
            ch_df.style.format({
                "구독자 수": "{:,}",
                "총 영상 수": "{:,}",
                "총 조회수": "{:,}",
                "구독자당 조회수": "{:.1f}",
            }),
            use_container_width=True,
        )

with tab5:
    st.markdown("### 🔍 심층 분석")
    st.caption("벤치마킹 채널 전체 수집 데이터 기준 (필터 미적용)")

    # ── 0. 내 채널 vs 벤치마킹 비교 ──────────────────────────────
    if MY_CHANNEL_ID:
        st.markdown("""<div class="analysis-section">
            <div class="analysis-title">👤 내 채널 vs 벤치마킹 평균 비교</div>
            <div class="analysis-desc">내 채널의 주요 지표를 벤치마킹 채널 평균과 나란히 비교합니다.</div>
        </div>""", unsafe_allow_html=True)

        _my_info   = next((r for r in channels_raw if r["channel_id"] == MY_CHANNEL_ID), None)
        _bench_chs = [r for r in channels_raw if r["channel_id"] != MY_CHANNEL_ID]

        if _my_info and _bench_chs:
            _my_vids    = vdf[vdf["channel_id"] == MY_CHANNEL_ID]
            _bench_vids = vdf[vdf["channel_id"] != MY_CHANNEL_ID]

            _my_avg_v    = int(_my_vids["view_count"].mean())    if not _my_vids.empty    else 0
            _bench_avg_v = int(_bench_vids["view_count"].mean()) if not _bench_vids.empty else 0

            _my_sr    = round(_my_vids["is_short"].mean() * 100, 1)    if not _my_vids.empty    else 0.0
            _bench_sr = round(_bench_vids["is_short"].mean() * 100, 1) if not _bench_vids.empty else 0.0

            _my_30      = int((_my_vids["days_ago"] <= 30).sum())
            _b30        = _bench_vids[_bench_vids["days_ago"] <= 30]
            _bench_30avg = round(_b30.groupby("channel_id").size().mean(), 1) if not _b30.empty else 0.0

            _bench_subs_avg = int(
                sum(r.get("subscriber_count", 0) for r in _bench_chs) / len(_bench_chs)
            )

            _cmp = pd.DataFrame({
                "항목": ["구독자 수", "영상당 평균 조회수", "쇼츠 비율", "최근 30일 업로드"],
                "내 채널": [
                    f"{_my_info.get('subscriber_count', 0):,}명",
                    f"{_my_avg_v:,}회",
                    f"{_my_sr:.1f}%",
                    f"{_my_30}편",
                ],
                "벤치마킹 평균": [
                    f"{_bench_subs_avg:,}명",
                    f"{_bench_avg_v:,}회",
                    f"{_bench_sr:.1f}%",
                    f"{_bench_30avg:.1f}편",
                ],
            }).set_index("항목")
            st.dataframe(_cmp, use_container_width=True)

        st.markdown("<br>", unsafe_allow_html=True)

    # ── 1. 최적 업로드 요일 ───────────────────────────────────
    st.markdown("""<div class="analysis-section">
        <div class="analysis-title">📅 최적 업로드 요일</div>
        <div class="analysis-desc">경쟁 채널들이 어느 요일에 올린 영상이 평균적으로 가장 많이 봤는지 보여줍니다.</div>
    </div>""", unsafe_allow_html=True)

    day_map = {0:"월요일", 1:"화요일", 2:"수요일", 3:"목요일", 4:"금요일", 5:"토요일", 6:"일요일"}
    day_stats = (
        vdf.groupby("weekday")["view_count"]
        .agg(평균조회수="mean", 영상수="count", 최고조회수="max")
        .round(0)
        .astype(int)
    )
    day_stats.index = day_stats.index.map(day_map)
    day_stats.columns = ["평균 조회수", "영상 수", "최고 조회수"]
    day_stats = day_stats.sort_values("평균 조회수", ascending=False)
    best_day = day_stats.index[0]
    st.info(f"📌 평균 조회수 1위 요일: **{best_day}** — 이 요일에 업로드하면 노출 경쟁에서 유리할 수 있습니다.")
    st.dataframe(
        day_stats.style.format({"평균 조회수": "{:,}", "영상 수": "{:,}", "최고 조회수": "{:,}"}),
        use_container_width=True,
    )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 1-2. 최적 업로드 시간대 ──────────────────────────────
    st.markdown("""<div class="analysis-section">
        <div class="analysis-title">🕐 최적 업로드 시간대 (KST)</div>
        <div class="analysis-desc">경쟁 채널들이 어느 시간에 올린 영상이 평균적으로 가장 많이 봤는지 보여줍니다.</div>
    </div>""", unsafe_allow_html=True)

    hour_stats = (
        vdf.groupby("upload_hour")["view_count"]
        .agg(평균조회수="mean", 영상수="count", 최고조회수="max")
        .round(0).astype(int)
    )
    hour_stats.index = hour_stats.index.map(lambda h: f"{h:02d}:00~{h:02d}:59")
    hour_stats.columns = ["평균 조회수", "영상 수", "최고 조회수"]
    hour_stats = hour_stats[hour_stats["영상 수"] >= 2]  # 샘플 2개 이상만
    best_hour = hour_stats["평균 조회수"].idxmax() if not hour_stats.empty else "정보 없음"
    st.info(f"📌 평균 조회수 1위 시간대: **{best_hour}** — 이 시간대 업로드 영상이 평균적으로 가장 많이 봤습니다.")
    st.dataframe(
        hour_stats.sort_values("평균 조회수", ascending=False)
        .style.format({"평균 조회수": "{:,}", "영상 수": "{:,}", "최고 조회수": "{:,}"}),
        use_container_width=True,
    )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 2. 롱폼 vs 쇼츠 채널별 비교 ─────────────────────────
    st.markdown("""<div class="analysis-section">
        <div class="analysis-title">📐 롱폼 vs 쇼츠 채널별 성과 비교</div>
        <div class="analysis-desc">채널마다 롱폼과 쇼츠 중 어떤 포맷이 더 잘 되는지 비교합니다.</div>
    </div>""", unsafe_allow_html=True)

    fmt_grp = vdf.groupby(["channel_name", "is_short"])["view_count"].agg(["mean", "count"]).round(0)
    fmt_avg = fmt_grp["mean"].unstack(level=1).fillna(0).astype(int)
    fmt_cnt = fmt_grp["count"].unstack(level=1).fillna(0).astype(int)
    fmt_avg.columns = [("쇼츠 평균조회수" if c else "롱폼 평균조회수") for c in fmt_avg.columns]
    fmt_cnt.columns = [("쇼츠 편수" if c else "롱폼 편수") for c in fmt_cnt.columns]
    fmt_df = pd.concat([fmt_avg, fmt_cnt], axis=1)
    fmt_df = fmt_df[["롱폼 평균조회수", "쇼츠 평균조회수", "롱폼 편수", "쇼츠 편수"]].sort_values(
        "롱폼 평균조회수", ascending=False
    )
    fmt_df.index.name = "채널명"
    st.dataframe(
        fmt_df.style.format({
            "롱폼 평균조회수": "{:,}", "쇼츠 평균조회수": "{:,}",
            "롱폼 편수": "{:,}", "쇼츠 편수": "{:,}",
        }),
        use_container_width=True,
    )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 3. 영상 길이 구간별 성과 ─────────────────────────────
    st.markdown("""<div class="analysis-section">
        <div class="analysis-title">⏱ 영상 길이 구간별 성과</div>
        <div class="analysis-desc">어느 길이의 영상이 가장 높은 조회수를 기록하는지 분석합니다.</div>
    </div>""", unsafe_allow_html=True)

    buck_stats = (
        vdf.groupby("duration_bucket")["view_count"]
        .agg(평균조회수="mean", 영상수="count", 최고조회수="max")
        .round(0)
        .astype(int)
        .sort_index()
    )
    buck_stats.columns = ["평균 조회수", "영상 수", "최고 조회수"]
    buck_stats.index.name = "길이 구간"
    best_buck = buck_stats["평균 조회수"].idxmax()
    st.info(f"📌 평균 조회수 최고 구간: **{best_buck}** — 이 길이 영상이 가장 높은 반응을 얻고 있습니다.")
    st.dataframe(
        buck_stats.style.format({"평균 조회수": "{:,}", "영상 수": "{:,}", "최고 조회수": "{:,}"}),
        use_container_width=True,
    )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── 4. 채널별 업로드 주기 ────────────────────────────────
    st.markdown("""<div class="analysis-section">
        <div class="analysis-title">📆 채널별 업로드 주기</div>
        <div class="analysis-desc">경쟁 채널들이 얼마나 자주 영상을 올리는지 분석합니다. 숫자가 낮을수록 업로드가 잦습니다.</div>
    </div>""", unsafe_allow_html=True)

    freq_rows = []
    for ch_name, grp in vdf.groupby("channel_name"):
        dates = grp["published_at"].dt.tz_convert(KST).sort_values()
        recent7  = int((grp["days_ago"] <= 7).sum())
        recent30 = int((grp["days_ago"] <= 30).sum())
        if len(dates) >= 2:
            diffs = dates.diff().dt.total_seconds().dropna() / 86400
            avg_days = round(diffs.mean(), 1)
        else:
            avg_days = None
        freq_rows.append({
            "채널명": ch_name,
            "수집 영상": len(grp),
            "최근 7일 업로드": recent7,
            "최근 30일 업로드": recent30,
            "평균 업로드 주기(일)": avg_days,
        })
    freq_df = pd.DataFrame(freq_rows).sort_values("평균 업로드 주기(일)").reset_index(drop=True)
    freq_df.index += 1
    st.dataframe(
        freq_df.style.format({
            "수집 영상": "{:,}",
            "최근 7일 업로드": "{:,}",
            "최근 30일 업로드": "{:,}",
            "평균 업로드 주기(일)": lambda x: f"{x:.1f}일" if x is not None and x == x else "데이터 부족",
        }),
        use_container_width=True,
    )

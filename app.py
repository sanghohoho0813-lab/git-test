import re
import streamlit as st
import pandas as pd
from collections import Counter
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

from youtube_api import fetch_all_data, load_cache

# 김팀장 본인 채널 ID (채널 URL 확인 후 입력하세요)
MY_CHANNEL_ID = ""

STOP_WORDS = {
    "이","그","저","것","수","등","및","에","를","을","가","의","은","는","로","으로",
    "에서","와","과","도","만","하는","하기","있는","없는","합니다","입니다","됩니다",
    "대한","위한","통해","위해","하면","하고","이번","지금","바로","정말","드디어",
    "속보","중요","긴급","총정리","요약","정리","방법","이유","결과","확인","신청",
    "까지","부터","동안","이후","이전","최대","최소","모든","각종","관련","내용",
    "사람","경우","우리","여기","어디","무엇","얼마","어떻게","하지","않는","없이",
    "있어","했다","된다","한다","않고","되고","하고","이런","그런","저런","어떤",
    "누가","뭔가","아직","이미","같은","다른","라는","라고","에도","에서는","으로는",
}

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

st.markdown("""
<style>
.grid-card {
    background: #16213e;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #2a2a5a;
    margin-bottom: 18px;
}
.grid-card:hover { border-color: #5a5aaa; }
.grid-card.mine  { border: 2px solid #ffd700; }

.thumb-wrap {
    display: block;
    position: relative;
    width: 100%;
}
.thumb-wrap img {
    width: 100%;
    display: block;
    border-radius: 14px 14px 0 0;
    aspect-ratio: 16/9;
    object-fit: cover;
}
.rank-badge {
    position: absolute;
    top: 8px; left: 8px;
    background: rgba(0,0,0,0.82);
    font-size: 22px;
    font-weight: 900;
    padding: 3px 12px;
    border-radius: 9px;
    pointer-events: none;
}
.mine-badge {
    position: absolute;
    top: 8px; right: 8px;
    background: rgba(255,200,0,0.92);
    color: #000;
    font-size: 13px;
    font-weight: 900;
    padding: 3px 9px;
    border-radius: 8px;
    pointer-events: none;
}

.card-body { padding: 12px 13px 14px; }

.card-channel {
    font-size: 20px;
    color: #8888dd;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.card-title {
    font-size: 20px;
    font-weight: 700;
    color: #e8e8ff;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 56px;
    margin-bottom: 10px;
    text-decoration: none;
}
.card-title:hover { color: #a0a0ff; }

.card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 4px;
}
.pill {
    font-size: 18px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 8px;
    white-space: nowrap;
}
.pill-view  { background:#1a2d60; color:#90c8ff; font-size:20px; font-weight:800; }
.pill-like  { background:#2d1a50; color:#d090ff; font-size:20px; font-weight:800; }
.pill-cmt   { background:#1a3a2a; color:#60e0a0; }
.pill-short { background:#3a1030; color:#ff80c0; }
.pill-long  { background:#103030; color:#60d8e8; }
.pill-date  { background:#222; color:#aaa; font-size:18px; }
.pill-mine  { background:#3a3000; color:#ffd700; font-weight:800; }

.summary-box {
    background: #16213e;
    border-radius: 12px;
    padding: 16px 20px;
    border: 1px solid #2a2a5a;
    text-align: center;
    margin-bottom: 20px;
}
.summary-label { font-size: 18px; color: #888; margin-bottom: 4px; }
.summary-value { font-size: 30px; font-weight: 900; color: #e8e8ff; }
.summary-sub   { font-size: 15px; color: #666; margin-top: 3px; }

.keyword-section {
    background: #16213e;
    border-radius: 14px;
    padding: 18px 22px;
    border: 1px solid #2a2a5a;
    margin-bottom: 22px;
}
.keyword-title { font-size: 18px; color: #888; margin-bottom: 12px; font-weight: 600; }
.kw-tag {
    display: inline-block;
    background: #1e2d5a;
    color: #90c8ff;
    border-radius: 20px;
    padding: 5px 14px;
    margin: 4px;
    font-size: 17px;
    font-weight: 700;
}
.kw-tag.top3 { background: #2d4080; color: #ffd700; font-size: 20px; }

.topic-rec-card {
    background: #0f1f3d;
    border-radius: 14px;
    padding: 20px 22px;
    border: 1px solid #2a4a8a;
    margin-bottom: 18px;
    height: 100%;
}
.topic-rank   { font-size: 14px; color: #5577cc; font-weight: 700; margin-bottom: 4px; }
.topic-keyword { font-size: 26px; font-weight: 900; color: #ffd700; margin-bottom: 10px; }
.topic-stat   { font-size: 14px; color: #7799cc; margin-bottom: 8px; }
.topic-rep    { font-size: 13px; color: #8888aa; margin-bottom: 14px; line-height: 1.5; }
.topic-ideas-title { font-size: 14px; color: #aaccff; font-weight: 700; margin-bottom: 8px; }
.topic-idea   { font-size: 14px; color: #cce0ff; margin-bottom: 6px; line-height: 1.5;
                padding: 7px 12px; background: #1a2d5a; border-radius: 8px; }
</style>
""", unsafe_allow_html=True)

# ── 헤더 ───────────────────────────────────────────────────────
api_key = st.secrets.get("youtube_api_key", "")

hc1, hc2, hc3 = st.columns([4, 1, 2])
with hc1:
    st.markdown("## 📊 김팀장 벤치마킹 대시보드")
with hc2:
    do_refresh = st.button("🔄 새로고침", use_container_width=True)
with hc3:
    cache = load_cache()
    if cache:
        dt = datetime.fromisoformat(cache["fetched_at"]).astimezone(KST)
        st.caption(f"마지막 수집: {dt.strftime('%Y-%m-%d %H:%M')} (KST)")

# ── 세션 첫 진입 시 자동 새로고침 ─────────────────────────────
if not st.session_state.get("auto_refreshed") and api_key:
    st.session_state.auto_refreshed = True
    with st.spinner("최신 데이터 불러오는 중..."):
        cache = fetch_all_data(api_key)
    st.rerun()

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
    st.warning("데이터가 없습니다. 새로고침을 눌러주세요.")
    st.stop()

ch_map   = {r["channel_id"]: r["title"] for r in channels_raw}
vdf      = pd.DataFrame(videos_raw)
vdf["published_at"]  = pd.to_datetime(vdf["published_at"], utc=True)
vdf["days_ago"]      = (datetime.now(KST) - vdf["published_at"].dt.tz_convert(KST)).dt.days
vdf["channel_name"]  = vdf["channel_id"].map(ch_map).fillna("알 수 없음")
vdf["is_mine"]       = (vdf["channel_id"] == MY_CHANNEL_ID) if MY_CHANNEL_ID else False

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
    top_n = st.selectbox("표시 개수", [20, 40, 60], index=0)

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
def render_keywords(df: pd.DataFrame):
    """df는 해당 기간 전체 영상 (top_n 컷 전). 조회수 가중치 + 2단어 구절 지원."""
    word_scores: Counter = Counter()
    word_video_cnt: Counter = Counter()

    for _, row in df.iterrows():
        title = str(row["title"])
        views = max(int(row.get("view_count", 1)), 1)
        tokens = re.findall(r"[가-힣]{2,}", title)
        filtered = [w for w in tokens if w not in STOP_WORDS]
        seen = set()

        for w in filtered:
            word_scores[w] += views
            if w not in seen:
                word_video_cnt[w] += 1
                seen.add(w)

        # 2단어 구절 (조회수 1.3배 가중)
        for i in range(len(filtered) - 1):
            phrase = filtered[i] + " " + filtered[i + 1]
            word_scores[phrase] += int(views * 1.3)
            if phrase not in seen:
                word_video_cnt[phrase] += 1
                seen.add(phrase)

    if not word_scores:
        return
    top_kw = word_scores.most_common(15)
    tags = ""
    for i, (word, _) in enumerate(top_kw):
        cls = "kw-tag top3" if i < 3 else "kw-tag"
        cnt = word_video_cnt[word]
        tags += f'<span class="{cls}">#{word} <small style="opacity:.6">({cnt}영상)</small></span>'
    st.markdown(f"""
    <div class="keyword-section">
        <div class="keyword-title">🔑 이 기간 인기 영상 핵심 키워드 (조회수 가중)</div>
        {tags}
    </div>""", unsafe_allow_html=True)

# ── 주목 콘텐츠 추천 ──────────────────────────────────────────
def render_topic_recommendations(df: pd.DataFrame):
    """기간 내 주목 콘텐츠 주제 상위 4개를 카피라이팅 아이디어와 함께 표시."""
    word_scores: Counter = Counter()
    topic_data: dict = {}

    for _, row in df.iterrows():
        title = str(row["title"])
        views = max(int(row.get("view_count", 1)), 1)
        channel = str(row.get("channel_name", ""))
        tokens = re.findall(r"[가-힣]{2,}", title)
        filtered = [w for w in tokens if w not in STOP_WORDS]

        for w in filtered:
            word_scores[w] += views
            if w not in topic_data:
                topic_data[w] = {"videos": [], "channels": set()}
            topic_data[w]["videos"].append((title, channel, views))
            topic_data[w]["channels"].add(channel)

        for i in range(len(filtered) - 1):
            phrase = filtered[i] + " " + filtered[i + 1]
            word_scores[phrase] += int(views * 1.3)
            if phrase not in topic_data:
                topic_data[phrase] = {"videos": [], "channels": set()}
            topic_data[phrase]["videos"].append((title, channel, views))
            topic_data[phrase]["channels"].add(channel)

    top_topics = word_scores.most_common(8)[:4]
    if not top_topics:
        return

    st.markdown("#### 📌 주목 콘텐츠 주제 추천")
    left_col, right_col = st.columns(2)
    col_pair = [left_col, right_col]

    for rank, (keyword, _) in enumerate(top_topics):
        data = topic_data[keyword]
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

    st.markdown("---")


# ── 카드 HTML 생성 ──────────────────────────────────────────────
NCOLS = 5

def build_card(rank: int, row) -> str:
    vid_id  = str(row.get("video_id", ""))
    thumb   = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else ""
    url     = str(row["url"])
    title   = str(row["title"]).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    channel = str(row["channel_name"]).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    views   = f"{int(row['view_count']):,}"
    likes   = f"{int(row['like_count']):,}"
    cmts    = f"{int(row['comment_count']):,}"
    dt      = row["published_at"]
    date    = f"{dt.year}년 {dt.month}월 {dt.day}일"
    t_cls   = "pill-short" if row["is_short"] else "pill-long"
    t_txt   = "쇼츠" if row["is_short"] else "롱폼"
    is_mine = bool(row.get("is_mine", False))

    if rank == 1:   rc = "#ffd700"
    elif rank == 2: rc = "#c0c0c0"
    elif rank == 3: rc = "#cd7f32"
    else:           rc = "#aaa"

    mine_cls    = " mine" if is_mine else ""
    # span 태그 사용 — div 중첩으로 인한 Streamlit 렌더링 오류 방지
    mine_badge  = '<span class="mine-badge">👤 내 채널</span>' if is_mine else ""
    mine_pill   = '<span class="pill pill-mine">👤 내 채널</span>' if is_mine else ""

    return (
        f'<div class="grid-card{mine_cls}">'
        f'<a class="thumb-wrap" href="{url}" target="_blank">'
        f'<img src="{thumb}" alt="thumbnail" loading="lazy">'
        f'<span class="rank-badge" style="color:{rc}">#{rank}</span>'
        f'{mine_badge}'
        f'</a>'
        f'<div class="card-body">'
        f'<div class="card-channel">{channel}</div>'
        f'<a href="{url}" target="_blank" style="text-decoration:none;">'
        f'<div class="card-title">{title}</div>'
        f'</a>'
        f'<div class="card-stats">'
        f'<span class="pill pill-view">조회수 {views}</span>'
        f'<span class="pill pill-like">좋아요 {likes}</span>'
        f'<span class="pill pill-cmt">댓글 {cmts}</span>'
        f'<span class="pill {t_cls}">{t_txt}</span>'
        f'<span class="pill pill-date">📅 {date}</span>'
        f'{mine_pill}'
        f'</div>'
        f'</div>'
        f'</div>'
    )

def render_grid(df: pd.DataFrame):
    if df.empty:
        st.info("해당 기간에 영상이 없습니다.")
        return

    # 키워드 + 주제 추천은 기간 내 전체 영상 기준 (top_n 컷 전)
    render_keywords(df)
    render_topic_recommendations(df)

    # 그리드 표시용: 조회수 상위 top_n 개만
    dsp = df.nlargest(top_n, "view_count").reset_index(drop=True)

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
            st.markdown(f"""<div class="summary-box" style="border-color:#ffd700;">
                <div class="summary-label">👤 내 채널 최고 순위</div>
                <div class="summary-value" style="color:#ffd700;">#{best_rank}위</div>
                <div class="summary-sub">👁 {int(best['view_count']):,}회</div>
            </div>""", unsafe_allow_html=True)
        else:
            top2 = dsp.iloc[1] if len(dsp) > 1 else top_v
            st.markdown(f"""<div class="summary-box">
                <div class="summary-label">🥈 조회수 2위</div>
                <div class="summary-value">{int(top2['view_count']):,}회</div>
                <div class="summary-sub">{top2['channel_name']}</div>
            </div>""", unsafe_allow_html=True)

    col_buckets: list[list[str]] = [[] for _ in range(NCOLS)]
    for i, row in dsp.iterrows():
        col_buckets[i % NCOLS].append(build_card(i + 1, row))

    cols = st.columns(NCOLS)
    for col_widget, cards in zip(cols, col_buckets):
        with col_widget:
            st.markdown("".join(cards), unsafe_allow_html=True)

# ── 탭 ────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "🔥 이번 주 TOP",
    "📅 이번 달 TOP",
    "🏆 올해 TOP",
    "📊 채널 현황",
])

with tab1:
    st.caption("최근 7일 이내 업로드 기준")
    render_grid(apply_filter(vdf[vdf["days_ago"] <= 7]))

with tab2:
    st.caption("최근 30일 이내 업로드 기준")
    render_grid(apply_filter(vdf[vdf["days_ago"] <= 30]))

with tab3:
    st.caption("최근 365일 이내 업로드 기준")
    render_grid(apply_filter(vdf[vdf["days_ago"] <= 365]))

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

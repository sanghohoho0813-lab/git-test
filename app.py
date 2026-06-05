import streamlit as st
import pandas as pd
from datetime import datetime, timezone

from youtube_api import fetch_all_data, load_cache

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
    margin-bottom: 20px;
}
.grid-card:hover { border-color: #5a5aaa; }

.thumb-wrap {
    position: relative;
    display: block;
    width: 100%;
}
.thumb-wrap img {
    width: 100%;
    display: block;
    border-radius: 14px 14px 0 0;
    object-fit: cover;
    aspect-ratio: 16/9;
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

.card-body { padding: 12px 14px 14px; }

.card-channel {
    font-size: 20px;
    color: #8888dd;
    margin-bottom: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.card-title {
    font-size: 21px;
    font-weight: 700;
    color: #e8e8ff;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 58px;
    margin-bottom: 10px;
    text-decoration: none;
}
.card-title:hover { color: #a0a0ff; }

.card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
}
.pill {
    font-size: 19px;
    font-weight: 600;
    padding: 4px 11px;
    border-radius: 8px;
    white-space: nowrap;
}
.pill-view  { background:#1a2d60; color:#90c8ff; font-size:21px; font-weight:800; }
.pill-like  { background:#2d1a50; color:#d090ff; font-size:21px; font-weight:800; }
.pill-cmt   { background:#1a3a2a; color:#60e0a0; }
.pill-eng   { background:#3a2a10; color:#ffcc44; font-weight:800; }
.pill-short { background:#3a1030; color:#ff80c0; }
.pill-long  { background:#103030; color:#60d8e8; }
.pill-date  { background:#222; color:#888; }

.summary-box {
    background: #16213e;
    border-radius: 12px;
    padding: 16px 20px;
    border: 1px solid #2a2a5a;
    text-align: center;
    margin-bottom: 20px;
}
.summary-label { font-size: 17px; color: #888; margin-bottom: 4px; }
.summary-value { font-size: 28px; font-weight: 900; color: #e8e8ff; }
.summary-sub   { font-size: 15px; color: #666; margin-top: 3px; }
</style>
""", unsafe_allow_html=True)

# ── 비밀번호 ───────────────────────────────────────────────────
pw_stored = st.secrets.get("dashboard_password", "")
if pw_stored and not st.session_state.get("authenticated"):
    with st.form("login_form"):
        st.markdown("### 🔒 비밀번호 입력")
        pwd_input = st.text_input("비밀번호", type="password")
        if st.form_submit_button("접속"):
            if pwd_input == pw_stored:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error("비밀번호가 틀렸습니다.")
    st.stop()

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
        dt = datetime.fromisoformat(cache["fetched_at"]).astimezone()
        st.caption(f"마지막 수집: {dt.strftime('%Y-%m-%d %H:%M')}")

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
vdf["days_ago"]      = (datetime.now(timezone.utc) - vdf["published_at"]).dt.days
vdf["channel_name"]  = vdf["channel_id"].map(ch_map).fillna("알 수 없음")
vdf["engagement"]    = (
    (vdf["like_count"] + vdf["comment_count"])
    / vdf["view_count"].replace(0, 1) * 100
).round(2)

# ── 필터 ────────────────────────────────────────────────────────
st.markdown("---")
fc1, fc2, fc3, fc4 = st.columns([2, 2, 3, 1])
with fc1:
    type_filter = st.radio("영상 종류", ["전체", "롱폼만", "쇼츠만"], horizontal=True)
with fc2:
    sort_by = st.radio("정렬 기준", ["조회수순", "참여율순"], horizontal=True)
with fc3:
    all_ch = sorted(vdf["channel_name"].unique().tolist())
    sel_ch = st.multiselect("채널 필터 (비우면 전체)", all_ch, placeholder="채널 선택...")
with fc4:
    top_n = st.selectbox("표시 개수", [20, 40, 60], index=1)

def apply_filter(df):
    if type_filter == "롱폼만":
        df = df[~df["is_short"]]
    elif type_filter == "쇼츠만":
        df = df[df["is_short"]]
    if sel_ch:
        df = df[df["channel_name"].isin(sel_ch)]
    col = "view_count" if sort_by == "조회수순" else "engagement"
    return df.nlargest(top_n, col).reset_index(drop=True)

# ── 카드 그리드 ────────────────────────────────────────────────
def render_grid(df: pd.DataFrame):
    if df.empty:
        st.info("해당 기간에 영상이 없습니다.")
        return

    # 요약 지표
    top_v  = df.iloc[0]
    top_e  = df.nlargest(1, "engagement").iloc[0]
    avg_v  = int(df["view_count"].mean())
    s1, s2, s3 = st.columns(3)
    with s1:
        st.markdown(f"""<div class='summary-box'>
            <div class='summary-label'>👑 조회수 1위</div>
            <div class='summary-value'>{top_v['view_count']:,}회</div>
            <div class='summary-sub'>{top_v['channel_name']}</div>
        </div>""", unsafe_allow_html=True)
    with s2:
        st.markdown(f"""<div class='summary-box'>
            <div class='summary-label'>🔥 최고 참여율</div>
            <div class='summary-value'>{top_e['engagement']}%</div>
            <div class='summary-sub'>{top_e['channel_name']}</div>
        </div>""", unsafe_allow_html=True)
    with s3:
        st.markdown(f"""<div class='summary-box'>
            <div class='summary-label'>📊 평균 조회수</div>
            <div class='summary-value'>{avg_v:,}회</div>
            <div class='summary-sub'>분석 영상 {len(df)}개</div>
        </div>""", unsafe_allow_html=True)

    # 4열 그리드 — 카드 전체를 단일 HTML 블록으로
    cols = st.columns(4)
    for i, row in df.iterrows():
        rank    = i + 1
        vid_id  = row.get("video_id", "")
        # 고화질 썸네일 (hqdefault = 480x360)
        thumb   = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else ""
        url     = row["url"]
        title   = row["title"].replace("<", "&lt;").replace(">", "&gt;")
        channel = row["channel_name"].replace("<", "&lt;")
        views   = f"{row['view_count']:,}"
        likes   = f"{row['like_count']:,}"
        cmts    = f"{row['comment_count']:,}"
        eng     = f"{row['engagement']}%"
        date    = row["published_at"].strftime("%m/%d")
        t_cls   = "pill-short" if row["is_short"] else "pill-long"
        t_txt   = "쇼츠" if row["is_short"] else "롱폼"
        rank_color = "#ffd700" if rank <= 3 else ("#c0c0c0" if rank == 2 else "#888")
        if rank == 1:   rank_color = "#ffd700"
        elif rank == 2: rank_color = "#c0c0c0"
        elif rank == 3: rank_color = "#cd7f32"
        else:           rank_color = "#aaa"

        card = f"""
        <div class="grid-card">
            <a class="thumb-wrap" href="{url}" target="_blank">
                <img src="{thumb}" alt="thumbnail" loading="lazy">
                <div class="rank-badge" style="color:{rank_color}">#{rank}</div>
            </a>
            <div class="card-body">
                <div class="card-channel">{channel}</div>
                <a href="{url}" target="_blank" style="text-decoration:none;">
                    <div class="card-title">{title}</div>
                </a>
                <div class="card-stats">
                    <span class="pill pill-view">👁️ {views}</span>
                    <span class="pill pill-like">👍 {likes}</span>
                    <span class="pill pill-cmt">💬 {cmts}</span>
                    <span class="pill pill-eng">참여율 {eng}</span>
                    <span class="pill {t_cls}">{t_txt}</span>
                    <span class="pill pill-date">{date}</span>
                </div>
            </div>
        </div>
        """
        with cols[i % 4]:
            st.markdown(card, unsafe_allow_html=True)

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
        ch_df = pd.DataFrame(channels_raw)[["title", "subscriber_count", "video_count", "view_count"]]
        ch_df.columns = ["채널명", "구독자 수", "총 영상 수", "총 조회수"]
        ch_df = ch_df.sort_values("구독자 수", ascending=False).reset_index(drop=True)
        ch_df.index += 1
        st.dataframe(
            ch_df.style.format({"구독자 수": "{:,}", "총 영상 수": "{:,}", "총 조회수": "{:,}"}),
            use_container_width=True,
        )

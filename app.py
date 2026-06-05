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
.video-card {
    background: #1a1a2e;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 10px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    border: 1px solid #2a2a4a;
}
.rank-badge {
    font-size: 22px;
    font-weight: 900;
    color: #888;
    min-width: 32px;
    padding-top: 4px;
}
.rank-badge.top3 { color: #ffd700; }
.video-meta {
    font-size: 13px;
    color: #aaa;
    margin-top: 5px;
    line-height: 1.8;
}
.stat-pill {
    display: inline-block;
    background: #2a2a4a;
    border-radius: 6px;
    padding: 2px 8px;
    margin-right: 6px;
    font-size: 12px;
    color: #ccc;
}
.type-short { background: #2d1b4e; color: #c084fc; }
.type-long  { background: #1b2d4e; color: #60a5fa; }
.eng-rate   { background: #1b3a2d; color: #4ade80; }
</style>
""", unsafe_allow_html=True)

# ── 비밀번호 인증 ──────────────────────────────────────────────
def check_password():
    password = st.secrets.get("dashboard_password", "")
    if not password:
        return True
    if st.session_state.get("authenticated"):
        return True
    with st.form("login"):
        st.markdown("### 🔒 비밀번호 입력")
        pwd = st.text_input("비밀번호", type="password")
        if st.form_submit_button("접속"):
            if pwd == password:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error("비밀번호가 틀렸습니다.")
    return False

if not check_password():
    st.stop()

# ── 헤더 ───────────────────────────────────────────────────────
api_key = st.secrets.get("youtube_api_key", "")

col_title, col_refresh, col_status = st.columns([3, 1, 2])
with col_title:
    st.markdown("## 📊 김팀장 벤치마킹 대시보드")
with col_refresh:
    do_refresh = st.button("🔄 새로고침", use_container_width=True)
with col_status:
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
    st.success("완료!")
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
videos_df = pd.DataFrame(videos_raw)
videos_df["published_at"] = pd.to_datetime(videos_df["published_at"], utc=True)
videos_df["days_ago"]     = (datetime.now(timezone.utc) - videos_df["published_at"]).dt.days
videos_df["channel_name"] = videos_df["channel_id"].map(ch_map).fillna("알 수 없음")
videos_df["engagement"]   = (
    (videos_df["like_count"] + videos_df["comment_count"])
    / videos_df["view_count"].replace(0, 1) * 100
).round(2)

# ── 영상 카드 렌더링 함수 ──────────────────────────────────────
def render_video_list(df: pd.DataFrame, top_n: int = 20):
    df = df.nlargest(top_n, "view_count").reset_index(drop=True)
    if df.empty:
        st.info("해당 기간에 영상이 없습니다.")
        return
    for i, row in df.iterrows():
        rank = i + 1
        rank_class = "top3" if rank <= 3 else ""
        type_label = "🩳 쇼츠" if row["is_short"] else "🎬 롱폼"
        type_class  = "type-short" if row["is_short"] else "type-long"
        views  = f"{row['view_count']:,}"
        likes  = f"{row['like_count']:,}"
        cmts   = f"{row['comment_count']:,}"
        eng    = f"{row['engagement']}%"
        date   = row["published_at"].strftime("%Y-%m-%d")
        ch     = row["channel_name"]
        title  = row["title"]
        url    = row["url"]
        thumb  = row.get("thumbnail", "")

        col_img, col_info = st.columns([1, 4])
        with col_img:
            st.markdown(f"<div class='rank-badge {rank_class}'>#{rank}</div>", unsafe_allow_html=True)
            if thumb:
                try:
                    st.image(thumb, width=150)
                except Exception:
                    pass
        with col_info:
            st.markdown(f"**[{title}]({url})**")
            st.markdown(
                f"<div class='video-meta'>"
                f"📺 {ch} &nbsp;|&nbsp; 📅 {date}<br>"
                f"<span class='stat-pill'>👁️ {views}회</span>"
                f"<span class='stat-pill'>👍 {likes}</span>"
                f"<span class='stat-pill'>💬 {cmts}</span>"
                f"<span class='stat-pill eng-rate'>참여율 {eng}</span>"
                f"<span class='stat-pill {type_class}'>{type_label}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )
        st.divider()

# ── 필터 공통 ──────────────────────────────────────────────────
col_f1, col_f2 = st.columns([2, 1])
with col_f1:
    type_filter = st.radio("영상 종류", ["전체", "롱폼만", "쇼츠만"], horizontal=True)
with col_f2:
    top_n = st.selectbox("표시 개수", [10, 20, 30], index=1)

def apply_type_filter(df):
    if type_filter == "롱폼만":
        return df[~df["is_short"]]
    if type_filter == "쇼츠만":
        return df[df["is_short"]]
    return df

# ── 탭 ────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "🔥 이번 주 인기 TOP",
    "📅 이번 달 인기 TOP",
    "🏆 올해 인기 TOP",
    "📊 채널 현황",
])

with tab1:
    st.caption("최근 7일 이내 업로드된 영상 기준")
    df7 = apply_type_filter(videos_df[videos_df["days_ago"] <= 7])
    render_video_list(df7, top_n)

with tab2:
    st.caption("최근 30일 이내 업로드된 영상 기준")
    df30 = apply_type_filter(videos_df[videos_df["days_ago"] <= 30])
    render_video_list(df30, top_n)

with tab3:
    st.caption("최근 365일 이내 업로드된 영상 기준")
    df365 = apply_type_filter(videos_df[videos_df["days_ago"] <= 365])
    render_video_list(df365, top_n)

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

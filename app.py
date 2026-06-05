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
/* 전체 폰트 크기 업 */
html, body, [class*="css"] { font-size: 16px !important; }

.grid-card {
    background: #16213e;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #2a2a5a;
    margin-bottom: 18px;
    position: relative;
    transition: border-color 0.2s;
}
.grid-card:hover { border-color: #4a4a9a; }

.rank-overlay {
    position: absolute;
    top: 8px; left: 8px;
    background: rgba(0,0,0,0.75);
    color: #fff;
    font-size: 17px;
    font-weight: 900;
    padding: 2px 9px;
    border-radius: 8px;
    z-index: 10;
}
.rank-overlay.gold { color: #ffd700; }
.rank-overlay.silver { color: #c0c0c0; }
.rank-overlay.bronze { color: #cd7f32; }

.card-body { padding: 11px 13px 13px; }

.card-channel {
    font-size: 13px;
    color: #8888cc;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.card-title {
    font-size: 15px;
    font-weight: 700;
    color: #e8e8ff;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 9px;
    min-height: 44px;
}
.card-title a { color: inherit; text-decoration: none; }
.card-title a:hover { color: #a0a0ff; text-decoration: underline; }

.card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 2px;
}
.pill {
    font-size: 13px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 7px;
    white-space: nowrap;
}
.pill-view  { background:#1e2d5a; color:#7eb8f7; }
.pill-like  { background:#2d1e3a; color:#c084fc; }
.pill-cmt   { background:#1e3a2d; color:#6ee7b7; }
.pill-eng   { background:#3a2d1e; color:#fbbf24; }
.pill-short { background:#3a1e2d; color:#f472b6; }
.pill-long  { background:#1e3a3a; color:#67e8f9; }
.pill-date  { background:#2a2a2a; color:#999; }

.summary-card {
    background: #16213e;
    border-radius: 12px;
    padding: 14px 18px;
    border: 1px solid #2a2a5a;
    text-align: center;
}
.summary-label { font-size: 13px; color: #888; margin-bottom: 4px; }
.summary-value { font-size: 22px; font-weight: 900; color: #e8e8ff; }
.summary-sub   { font-size: 12px; color: #666; margin-top: 3px; }
</style>
""", unsafe_allow_html=True)

# ── 비밀번호 인증 ──────────────────────────────────────────────
def check_password():
    pw = st.secrets.get("dashboard_password", "")
    if not pw or st.session_state.get("authenticated"):
        return True
    with st.form("login"):
        st.markdown("### 🔒 비밀번호 입력")
        if st.form_submit_button("접속") and st.text_input("비밀번호", type="password") == pw:
            st.session_state.authenticated = True
            st.rerun()
        elif st.form_submit_button:
            pass
    return False

# 간단한 비밀번호 체크
pw_stored = st.secrets.get("dashboard_password", "")
if pw_stored and not st.session_state.get("authenticated"):
    with st.form("login_form"):
        st.markdown("### 🔒 비밀번호 입력")
        pwd_input = st.text_input("비밀번호", type="password")
        submitted = st.form_submit_button("접속")
        if submitted:
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

ch_map    = {r["channel_id"]: r["title"] for r in channels_raw}
vdf       = pd.DataFrame(videos_raw)
vdf["published_at"]  = pd.to_datetime(vdf["published_at"], utc=True)
vdf["days_ago"]      = (datetime.now(timezone.utc) - vdf["published_at"]).dt.days
vdf["channel_name"]  = vdf["channel_id"].map(ch_map).fillna("알 수 없음")
vdf["engagement"]    = (
    (vdf["like_count"] + vdf["comment_count"])
    / vdf["view_count"].replace(0, 1) * 100
).round(2)

# ── 필터 바 ────────────────────────────────────────────────────
st.markdown("---")
fc1, fc2, fc3, fc4 = st.columns([2, 2, 3, 1])
with fc1:
    type_filter = st.radio("영상 종류", ["전체", "롱폼만", "쇼츠만"], horizontal=True)
with fc2:
    sort_by = st.radio("정렬 기준", ["조회수순", "참여율순"], horizontal=True)
with fc3:
    all_channels = sorted(vdf["channel_name"].unique().tolist())
    sel_channels = st.multiselect("채널 필터 (비우면 전체)", all_channels, placeholder="채널 선택...")
with fc4:
    top_n = st.selectbox("표시 개수", [20, 40, 60], index=1)

def filter_df(df):
    if type_filter == "롱폼만":
        df = df[~df["is_short"]]
    elif type_filter == "쇼츠만":
        df = df[df["is_short"]]
    if sel_channels:
        df = df[df["channel_name"].isin(sel_channels)]
    sort_col = "view_count" if sort_by == "조회수순" else "engagement"
    return df.nlargest(top_n, sort_col).reset_index(drop=True)

# ── 그리드 카드 렌더 ───────────────────────────────────────────
def rank_class(r):
    if r == 1: return "gold"
    if r == 2: return "silver"
    if r == 3: return "bronze"
    return ""

def render_grid(df: pd.DataFrame):
    if df.empty:
        st.info("해당 기간에 영상이 없습니다.")
        return

    # 상단 요약 3개
    top = df.iloc[0]
    best_eng = df.nlargest(1, "engagement").iloc[0]
    s1, s2, s3 = st.columns(3)
    with s1:
        st.markdown(f"""
        <div class='summary-card'>
            <div class='summary-label'>👑 조회수 1위</div>
            <div class='summary-value'>{top['view_count']:,}회</div>
            <div class='summary-sub'>{top['channel_name']}</div>
        </div>""", unsafe_allow_html=True)
    with s2:
        st.markdown(f"""
        <div class='summary-card'>
            <div class='summary-label'>🔥 최고 참여율</div>
            <div class='summary-value'>{best_eng['engagement']}%</div>
            <div class='summary-sub'>{best_eng['channel_name']}</div>
        </div>""", unsafe_allow_html=True)
    with s3:
        avg_views = int(df['view_count'].mean())
        st.markdown(f"""
        <div class='summary-card'>
            <div class='summary-label'>📊 평균 조회수</div>
            <div class='summary-value'>{avg_views:,}회</div>
            <div class='summary-sub'>분석 영상 {len(df)}개</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # 3열 그리드
    cols = st.columns(3)
    for i, row in df.iterrows():
        rank  = i + 1
        rc    = rank_class(rank)
        thumb = row.get("thumbnail", "")
        t_pill = "pill-short" if row["is_short"] else "pill-long"
        t_text = "🩳 쇼츠" if row["is_short"] else "🎬 롱폼"

        with cols[i % 3]:
            # 썸네일 + 순위
            st.markdown(f"<div class='grid-card'>", unsafe_allow_html=True)
            if thumb:
                try:
                    st.image(thumb, use_column_width=True)
                except Exception:
                    st.markdown("<div style='height:100px;background:#222;'></div>", unsafe_allow_html=True)
            st.markdown(f"""
            <div class='card-body'>
                <div class='card-channel'>#{rank} &nbsp;·&nbsp; {row['channel_name']}</div>
                <div class='card-title'>
                    <a href='{row['url']}' target='_blank'>{row['title']}</a>
                </div>
                <div class='card-stats'>
                    <span class='pill pill-view'>👁️ {row['view_count']:,}</span>
                    <span class='pill pill-like'>👍 {row['like_count']:,}</span>
                    <span class='pill pill-cmt'>💬 {row['comment_count']:,}</span>
                    <span class='pill pill-eng'>참여율 {row['engagement']}%</span>
                    <span class='pill {t_pill}'>{t_text}</span>
                    <span class='pill pill-date'>{row['published_at'].strftime('%m/%d')}</span>
                </div>
            </div>
            </div>
            """, unsafe_allow_html=True)

# ── 탭 ────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "🔥 이번 주 TOP",
    "📅 이번 달 TOP",
    "🏆 올해 TOP",
    "📊 채널 현황",
])

with tab1:
    st.caption("최근 7일 이내 업로드 기준")
    render_grid(filter_df(vdf[vdf["days_ago"] <= 7]))

with tab2:
    st.caption("최근 30일 이내 업로드 기준")
    render_grid(filter_df(vdf[vdf["days_ago"] <= 30]))

with tab3:
    st.caption("최근 365일 이내 업로드 기준")
    render_grid(filter_df(vdf[vdf["days_ago"] <= 365]))

with tab4:
    st.subheader("벤치마킹 채널 현황")
    if channels_raw:
        ch_df = pd.DataFrame(channels_raw)[["title","subscriber_count","video_count","view_count"]]
        ch_df.columns = ["채널명","구독자 수","총 영상 수","총 조회수"]
        ch_df = ch_df.sort_values("구독자 수", ascending=False).reset_index(drop=True)
        ch_df.index += 1
        st.dataframe(
            ch_df.style.format({"구독자 수":"{:,}","총 영상 수":"{:,}","총 조회수":"{:,}"}),
            use_container_width=True,
        )

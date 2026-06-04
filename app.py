import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from collections import Counter
from datetime import datetime, timezone, timedelta
import re

from youtube_api import fetch_all_data, load_cache

st.set_page_config(
    page_title="김팀장 벤치마킹 대시보드",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── 비밀번호 인증 ──────────────────────────────────────────────
def check_password():
    password = st.secrets.get("dashboard_password", "")
    if not password:
        return True  # 비밀번호 미설정 시 통과
    if "authenticated" in st.session_state and st.session_state.authenticated:
        return True
    with st.form("login"):
        st.markdown("### 🔒 비밀번호 입력")
        pwd = st.text_input("비밀번호", type="password")
        submitted = st.form_submit_button("접속")
        if submitted:
            if pwd == password:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error("비밀번호가 틀렸습니다.")
    return False

if not check_password():
    st.stop()

# ── 데이터 로드 ────────────────────────────────────────────────
api_key = st.secrets.get("youtube_api_key", "")

st.title("📊 김팀장 유튜브 벤치마킹 대시보드")

col_refresh, col_status = st.columns([1, 4])
with col_refresh:
    do_refresh = st.button("🔄 데이터 새로고침", use_container_width=True)

cache = load_cache()

if do_refresh:
    if not api_key:
        st.error("YouTube API 키가 설정되지 않았습니다. .streamlit/secrets.toml을 확인하세요.")
        st.stop()
    with st.spinner("유튜브에서 데이터 수집 중... (1~2분 소요)"):
        cache = fetch_all_data(api_key)
    st.success("완료!")

if not cache:
    st.info("오른쪽 상단의 '데이터 새로고침' 버튼을 눌러 데이터를 가져오세요.")
    st.stop()

with col_status:
    fetched_at = cache.get("fetched_at", "")
    if fetched_at:
        dt = datetime.fromisoformat(fetched_at).astimezone()
        st.caption(f"마지막 수집: {dt.strftime('%Y-%m-%d %H:%M')}")

channels_df = pd.DataFrame(cache["channels"])
videos_df = pd.DataFrame(cache["videos"])

if videos_df.empty:
    st.warning("영상 데이터가 없습니다.")
    st.stop()

videos_df["published_at"] = pd.to_datetime(videos_df["published_at"], utc=True)
videos_df["days_ago"] = (datetime.now(timezone.utc) - videos_df["published_at"]).dt.days
videos_df["weekday"] = videos_df["published_at"].dt.day_name()
videos_df["hour"] = videos_df["published_at"].dt.hour
videos_df["type"] = videos_df["is_short"].map({True: "쇼츠", False: "롱폼"})

# 채널 이름 매핑
ch_map = {r["channel_id"]: r["title"] for r in cache["channels"]}
videos_df["channel_name"] = videos_df["channel_id"].map(ch_map)

# ── 탭 구성 ────────────────────────────────────────────────────
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "🔥 급상승 영상",
    "📝 제목 패턴",
    "⏰ 업로드 분석",
    "📹 쇼츠 vs 롱폼",
    "📊 채널 현황",
])

# ── 탭1: 급상승 영상 ───────────────────────────────────────────
with tab1:
    st.subheader("최근 영상 중 조회수 TOP")
    col1, col2, col3 = st.columns(3)
    with col1:
        days_filter = st.selectbox("기간", [7, 14, 30, 90, 365], index=0, format_func=lambda x: f"최근 {x}일")
    with col2:
        type_filter = st.selectbox("영상 종류", ["전체", "롱폼", "쇼츠"])
    with col3:
        top_n = st.selectbox("표시 개수", [10, 20, 30, 50], index=0)

    filtered = videos_df[videos_df["days_ago"] <= days_filter].copy()
    if type_filter != "전체":
        filtered = filtered[filtered["type"] == type_filter]

    top_videos = filtered.nlargest(top_n, "view_count")

    for _, row in top_videos.iterrows():
        with st.container():
            c1, c2 = st.columns([1, 4])
            with c1:
                if row["thumbnail"]:
                    st.image(row["thumbnail"], use_container_width=True)
            with c2:
                st.markdown(f"**[{row['title']}]({row['url']})**")
                st.caption(
                    f"📺 {row['channel_name']}  |  "
                    f"👁️ {row['view_count']:,}회  |  "
                    f"👍 {row['like_count']:,}  |  "
                    f"💬 {row['comment_count']:,}  |  "
                    f"📅 {row['published_at'].strftime('%Y-%m-%d')}  |  "
                    f"{'🩳 쇼츠' if row['is_short'] else '🎬 롱폼'}"
                )
            st.divider()

# ── 탭2: 제목 패턴 분석 ────────────────────────────────────────
with tab2:
    st.subheader("잘 터진 영상의 제목 패턴")

    threshold = st.slider("최소 조회수 기준 (이 이상 영상만 분석)", 100, 50000, 1000, step=500)
    high_perf = videos_df[videos_df["view_count"] >= threshold]

    if high_perf.empty:
        st.info("해당 기준을 충족하는 영상이 없습니다.")
    else:
        st.caption(f"분석 대상: {len(high_perf)}개 영상")

        # 키워드 빈도
        stop_words = {"이", "그", "저", "것", "수", "등", "및", "에", "를", "을", "이", "가", "의", "은", "는", "로", "으로", "에서", "와", "과", "도", "만", "하는", "하기", "있는", "없는"}
        all_words = []
        for title in high_perf["title"]:
            words = re.findall(r"[가-힣a-zA-Z0-9]+", title)
            all_words.extend([w for w in words if len(w) >= 2 and w not in stop_words])
        word_counts = Counter(all_words).most_common(30)
        wc_df = pd.DataFrame(word_counts, columns=["키워드", "빈도"])
        fig = px.bar(wc_df, x="빈도", y="키워드", orientation="h", title="자주 등장하는 키워드 TOP 30")
        fig.update_layout(yaxis={"categoryorder": "total ascending"}, height=600)
        st.plotly_chart(fig, use_container_width=True)

        # 제목 특징 분석
        st.subheader("제목 특징 분석")
        c1, c2, c3, c4 = st.columns(4)
        has_number = high_perf["title"].str.contains(r"\d").sum()
        has_question = high_perf["title"].str.contains(r"[?？]").sum()
        has_exclaim = high_perf["title"].str.contains(r"[!！]").sum()
        avg_len = high_perf["title"].str.len().mean()
        total = len(high_perf)
        c1.metric("숫자 포함", f"{has_number}/{total} ({has_number/total*100:.0f}%)")
        c2.metric("물음표 포함", f"{has_question}/{total} ({has_question/total*100:.0f}%)")
        c3.metric("느낌표 포함", f"{has_exclaim}/{total} ({has_exclaim/total*100:.0f}%)")
        c4.metric("평균 제목 길이", f"{avg_len:.0f}자")

# ── 탭3: 업로드 분석 ───────────────────────────────────────────
with tab3:
    st.subheader("업로드 시간 & 주기 분석")

    selected_channels = st.multiselect(
        "채널 선택 (전체 선택 시 비워두세요)",
        options=videos_df["channel_name"].dropna().unique().tolist(),
        default=[]
    )
    data = videos_df if not selected_channels else videos_df[videos_df["channel_name"].isin(selected_channels)]

    c1, c2 = st.columns(2)
    with c1:
        weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        weekday_kr = {"Monday": "월", "Tuesday": "화", "Wednesday": "수", "Thursday": "목", "Friday": "금", "Saturday": "토", "Sunday": "일"}
        wd_counts = data["weekday"].value_counts().reindex(weekday_order, fill_value=0)
        wd_df = pd.DataFrame({"요일": [weekday_kr[d] for d in weekday_order], "업로드 수": wd_counts.values})
        fig = px.bar(wd_df, x="요일", y="업로드 수", title="요일별 업로드 분포")
        st.plotly_chart(fig, use_container_width=True)

    with c2:
        hour_counts = data["hour"].value_counts().sort_index()
        fig = px.bar(x=hour_counts.index, y=hour_counts.values, title="시간대별 업로드 분포", labels={"x": "시(UTC+9)", "y": "업로드 수"})
        st.plotly_chart(fig, use_container_width=True)

    # 채널별 평균 업로드 주기
    st.subheader("채널별 평균 업로드 간격")
    interval_data = []
    for ch_name, group in videos_df.groupby("channel_name"):
        sorted_dates = group["published_at"].sort_values(ascending=False)
        if len(sorted_dates) >= 2:
            diffs = sorted_dates.diff(-1).dropna().abs()
            avg_days = diffs.dt.days.mean()
            interval_data.append({"채널": ch_name, "평균 간격(일)": round(avg_days, 1), "분석 영상 수": len(sorted_dates)})
    if interval_data:
        interval_df = pd.DataFrame(interval_data).sort_values("평균 간격(일)")
        st.dataframe(interval_df, use_container_width=True, hide_index=True)

# ── 탭4: 쇼츠 vs 롱폼 ────────────────────────────────────────
with tab4:
    st.subheader("채널별 쇼츠 vs 롱폼 분석")

    ratio_data = []
    for ch_name, group in videos_df.groupby("channel_name"):
        shorts = group[group["is_short"]]
        longs = group[~group["is_short"]]
        ratio_data.append({
            "채널": ch_name,
            "쇼츠 수": len(shorts),
            "롱폼 수": len(longs),
            "쇼츠 평균 조회수": int(shorts["view_count"].mean()) if not shorts.empty else 0,
            "롱폼 평균 조회수": int(longs["view_count"].mean()) if not longs.empty else 0,
            "쇼츠 최고 조회수": int(shorts["view_count"].max()) if not shorts.empty else 0,
            "롱폼 최고 조회수": int(longs["view_count"].max()) if not longs.empty else 0,
        })
    ratio_df = pd.DataFrame(ratio_data)

    c1, c2 = st.columns(2)
    with c1:
        fig = px.bar(ratio_df, x="채널", y=["쇼츠 수", "롱폼 수"], title="채널별 쇼츠/롱폼 영상 수", barmode="stack")
        fig.update_layout(xaxis_tickangle=-30)
        st.plotly_chart(fig, use_container_width=True)
    with c2:
        fig = px.bar(ratio_df, x="채널", y=["쇼츠 평균 조회수", "롱폼 평균 조회수"], title="채널별 평균 조회수 비교", barmode="group")
        fig.update_layout(xaxis_tickangle=-30)
        st.plotly_chart(fig, use_container_width=True)

    st.dataframe(
        ratio_df.sort_values("롱폼 평균 조회수", ascending=False),
        use_container_width=True,
        hide_index=True
    )

# ── 탭5: 채널 현황 ────────────────────────────────────────────
with tab5:
    st.subheader("벤치마킹 채널 현황")
    if not channels_df.empty:
        disp = channels_df[["title", "subscriber_count", "video_count", "view_count"]].copy()
        disp.columns = ["채널명", "구독자 수", "총 영상 수", "총 조회수"]
        disp = disp.sort_values("구독자 수", ascending=False)
        st.dataframe(disp, use_container_width=True, hide_index=True)

        fig = px.bar(
            disp.head(15),
            x="채널명", y="구독자 수",
            title="채널별 구독자 수",
            text="구독자 수"
        )
        fig.update_traces(texttemplate="%{text:,}", textposition="outside")
        fig.update_layout(xaxis_tickangle=-30)
        st.plotly_chart(fig, use_container_width=True)

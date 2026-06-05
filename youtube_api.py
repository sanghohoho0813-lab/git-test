import json
import os
import re
from datetime import datetime, timezone
from googleapiclient.discovery import build

CHANNELS = [
    # ── 내 채널 ─────────────────────────────────────────────────
    {"url": "https://www.youtube.com/@김팀장의경영노트", "handle": "@김팀장의경영노트"},
    # ── 벤치마킹 채널 ────────────────────────────────────────────
    {"url": "https://www.youtube.com/channel/UCnnqB7SaH8o-NHLonSFfE3A", "id": "UCnnqB7SaH8o-NHLonSFfE3A"},
    {"url": "https://www.youtube.com/@소상공인도우미", "handle": "@소상공인도우미"},
    {"url": "https://www.youtube.com/@onetop-1", "handle": "@onetop-1"},
    {"url": "https://www.youtube.com/@엘아이파트너스여팀장", "handle": "@엘아이파트너스여팀장"},
    {"url": "https://www.youtube.com/@giupinfo", "handle": "@giupinfo"},
    {"url": "https://www.youtube.com/@jeongel", "handle": "@jeongel"},
    {"url": "https://www.youtube.com/@kstartuptv", "handle": "@kstartuptv"},
    {"url": "https://www.youtube.com/@richceo", "handle": "@richceo"},
    {"url": "https://www.youtube.com/@businesshelperJo", "handle": "@businesshelperJo"},
    {"url": "https://www.youtube.com/@bogopatv", "handle": "@bogopatv"},
    {"url": "https://www.youtube.com/@money_recipe", "handle": "@money_recipe"},
    {"url": "https://www.youtube.com/@사장님성장솔루션", "handle": "@사장님성장솔루션"},
    {"url": "https://www.youtube.com/@사장노트", "handle": "@사장노트"},
    {"url": "https://www.youtube.com/@슬기로운정책지원", "handle": "@슬기로운정책지원"},
    {"url": "https://www.youtube.com/@rodemtax", "handle": "@rodemtax"},
    {"url": "https://www.youtube.com/@nicetax", "handle": "@nicetax"},
    {"url": "https://www.youtube.com/@세금전문회계사김희연", "handle": "@세금전문회계사김희연"},
    {"url": "https://www.youtube.com/@dowssem", "handle": "@dowssem"},
    {"url": "https://www.youtube.com/@세무사", "handle": "@세무사"},
]

CACHE_FILE = "data/cache.json"


def get_youtube_client(api_key: str):
    return build("youtube", "v3", developerKey=api_key)


def resolve_channel_id(yt, channel: dict) -> str | None:
    if "id" in channel:
        return channel["id"]
    handle = channel.get("handle", "")
    username = handle.lstrip("@")
    resp = yt.channels().list(part="id", forHandle=handle).execute()
    items = resp.get("items", [])
    if items:
        return items[0]["id"]
    # fallback: search by username
    resp = yt.channels().list(part="id", forUsername=username).execute()
    items = resp.get("items", [])
    if items:
        return items[0]["id"]
    return None


def fetch_channel_info(yt, channel_id: str) -> dict:
    resp = yt.channels().list(
        part="snippet,statistics",
        id=channel_id
    ).execute()
    items = resp.get("items", [])
    if not items:
        return {}
    item = items[0]
    stats = item.get("statistics", {})
    snippet = item.get("snippet", {})
    return {
        "channel_id": channel_id,
        "title": snippet.get("title", ""),
        "description": snippet.get("description", ""),
        "custom_url": snippet.get("customUrl", ""),
        "thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
        "subscriber_count": int(stats.get("subscriberCount", 0)),
        "video_count": int(stats.get("videoCount", 0)),
        "view_count": int(stats.get("viewCount", 0)),
        "uploads_playlist_id": item.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads", ""),
    }


def fetch_recent_videos(yt, channel_id: str, max_results: int = 50) -> list[dict]:
    # Get uploads playlist id
    resp = yt.channels().list(
        part="contentDetails",
        id=channel_id
    ).execute()
    items = resp.get("items", [])
    if not items:
        return []
    uploads_id = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

    # Get video IDs from playlist
    video_ids = []
    next_page = None
    fetched = 0
    while fetched < max_results:
        params = dict(part="snippet", playlistId=uploads_id, maxResults=min(50, max_results - fetched))
        if next_page:
            params["pageToken"] = next_page
        resp = yt.playlistItems().list(**params).execute()
        for item in resp.get("items", []):
            vid = item["snippet"]["resourceId"]["videoId"]
            video_ids.append(vid)
        fetched += len(resp.get("items", []))
        next_page = resp.get("nextPageToken")
        if not next_page:
            break

    if not video_ids:
        return []

    # Fetch video details in batches of 50
    videos = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        resp = yt.videos().list(
            part="snippet,statistics,contentDetails",
            id=",".join(batch)
        ).execute()
        for item in resp.get("items", []):
            vid_id = item["id"]
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})
            content = item.get("contentDetails", {})
            duration_str = content.get("duration", "PT0S")
            duration_sec = _parse_duration(duration_str)
            is_short = duration_sec <= 60
            published = snippet.get("publishedAt", "")
            videos.append({
                "video_id": vid_id,
                "channel_id": channel_id,
                "title": snippet.get("title", ""),
                "published_at": published,
                "duration_sec": duration_sec,
                "is_short": is_short,
                "view_count": int(stats.get("viewCount", 0)),
                "like_count": int(stats.get("likeCount", 0)),
                "comment_count": int(stats.get("commentCount", 0)),
                "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                "url": f"https://www.youtube.com/watch?v={vid_id}",
            })
    return videos


def _parse_duration(duration: str) -> int:
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not match:
        return 0
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    return h * 3600 + m * 60 + s


def fetch_all_data(api_key: str) -> dict:
    yt = get_youtube_client(api_key)
    os.makedirs("data", exist_ok=True)

    channels_data = []
    all_videos = []

    for ch in CHANNELS:
        try:
            channel_id = resolve_channel_id(yt, ch)
            if not channel_id:
                continue
            info = fetch_channel_info(yt, channel_id)
            if not info:
                continue
            channels_data.append(info)
            videos = fetch_recent_videos(yt, channel_id, max_results=50)
            all_videos.extend(videos)
        except Exception as e:
            print(f"Error fetching {ch}: {e}")

    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "channels": channels_data,
        "videos": all_videos,
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result


def load_cache() -> dict | None:
    if not os.path.exists(CACHE_FILE):
        return None
    with open(CACHE_FILE, encoding="utf-8") as f:
        return json.load(f)

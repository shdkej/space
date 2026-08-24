import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,30}$")
REST_ID_RE = re.compile(r'rest_id:"(\d{5,30})"')
TEXT_RE = re.compile(r'full_text:("(?:\\.|[^"\\])*")')
CREATED_RE = re.compile(r"created_at_ms:(\d{10,20})")


def response(status, body):
    return {"statusCode": status, "headers": {"content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*"}, "body": json.dumps(body, ensure_ascii=False)}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LaunchTimeline/1.0)", "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(request, timeout=12) as result:
        return result.read().decode("utf-8", "ignore")


def iso_date(milliseconds):
    return datetime.fromtimestamp(int(milliseconds) / 1000, timezone.utc).isoformat()


def parse_x(handle, source_html):
    posts, seen = [], set()
    for match in REST_ID_RE.finditer(source_html):
        post_id = match.group(1)
        if post_id in seen:
            continue
        block = source_html[match.start() : match.start() + 7000]
        text_match, date_match = TEXT_RE.search(block), CREATED_RE.search(block)
        if not text_match or not date_match:
            continue
        try:
            text = json.loads(text_match.group(1))
        except json.JSONDecodeError:
            continue
        if not text.strip():
            continue
        seen.add(post_id)
        posts.append({"id": post_id, "publishedAt": iso_date(date_match.group(1)), "text": html.unescape(text), "url": f"https://x.com/{handle}/status/{post_id}", "platform": "x"})
    posts.sort(key=lambda item: item["publishedAt"])
    return posts[:40]


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    handle = (params.get("handle") or "").strip().lstrip("@").split("/")[0]
    platform = (params.get("platform") or "x").lower()
    if not HANDLE_RE.match(handle):
        return response(400, {"status": "error", "error": "invalid_handle"})
    if platform not in {"x", "instagram"}:
        return response(400, {"status": "error", "error": "unsupported_platform"})
    profile_url = f"https://{'x.com' if platform == 'x' else 'instagram.com'}/{urllib.parse.quote(handle)}"
    if platform == "instagram":
        return response(200, {"status": "unavailable", "platform": platform, "handle": handle, "profileUrl": profile_url, "posts": [], "message": "Instagram 공개 전체 피드는 서버에서 안정적으로 읽을 수 있는 공식 공개 엔드포인트가 없어 원문 수집을 보류했습니다."})
    try:
        posts = parse_x(handle, fetch(profile_url))
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        return response(200, {"status": "unavailable", "platform": platform, "handle": handle, "profileUrl": profile_url, "posts": [], "message": f"X 공개 프로필을 읽지 못했습니다: {type(error).__name__}"})
    return response(200, {"status": "ok" if posts else "empty", "platform": platform, "handle": handle, "profileUrl": profile_url, "fetchedAt": datetime.now(timezone.utc).isoformat(), "posts": posts, "message": "공개 프로필 HTML에서 게시물 원문을 추출했습니다." if posts else "공개 프로필에서 게시물 원문을 찾지 못했습니다."})

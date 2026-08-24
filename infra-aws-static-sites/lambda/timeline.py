import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
import os

HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,30}$")
REST_ID_RE = re.compile(r'rest_id:"(\d{5,30})"')
TEXT_RE = re.compile(r'full_text:("(?:\\.|[^"\\])*")')
CREATED_RE = re.compile(r"created_at_ms:(\d{10,20})")

STAGE_RULES = [
    ("problem", "문제·아이디어", ("need", "want", "wish", "pain", "problem", "idea", "would love", "불편", "필요", "아이디어")),
    ("building", "만드는 중", ("build", "building", "make", "making", "prototype", "beta", "v1", "app", "개발", "만들", "앱")),
    ("launch", "첫 공개", ("launch", "launched", "live", "available", "release", "released", "ship", "출시", "공개", "배포")),
    ("traction", "사용자 반응", ("user", "users", "download", "revenue", "sale", "paid", "customer", "ranking", "사용자", "다운로드", "매출", "판매", "고객")),
    ("iteration", "업데이트·개선", ("update", "updated", "feedback", "fix", "improve", "version", "feedback", "업데이트", "피드백", "개선", "수정")),
]


def response(status, body):
    return {"statusCode": status, "headers": {"content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*"}, "body": json.dumps(body, ensure_ascii=False)}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LaunchTimeline/1.0)", "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(request, timeout=12) as result:
        return result.read().decode("utf-8", "ignore")


def fetch_json(url, headers):
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=12) as result:
            return result.status, json.loads(result.read().decode("utf-8", "ignore"))
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "ignore")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"title": raw[:200]}
        return error.code, body


def iso_date(milliseconds):
    return datetime.fromtimestamp(int(milliseconds) / 1000, timezone.utc).isoformat()


def stage_for(text):
    lowered = text.lower()
    for key, label, keywords in STAGE_RULES:
        hits = [keyword for keyword in keywords if keyword in lowered]
        if hits:
            return key, label, hits[:3]
    return "other", "기타 대화", []


def analyze_posts(posts):
    for post in posts:
        stage, label, hits = stage_for(post["text"])
        post["stage"] = stage
        post["stageLabel"] = label
        post["signals"] = hits

    if not posts:
        return {"chapters": [], "summary": {"postCount": 0}}

    chapter_order = ["problem", "building", "launch", "traction", "iteration", "other"]
    chapters = []
    for stage in chapter_order:
        members = [post for post in posts if post["stage"] == stage]
        if not members:
            continue
        first, last = members[0], members[-1]
        descriptions = {
            "problem": "문제나 만들고 싶은 대상이 먼저 언급된 구간입니다.",
            "building": "아이디어가 실제 제작·실험 단계로 이동한 흔적입니다.",
            "launch": "제품이나 기능을 외부에 처음 공개한 흔적입니다.",
            "traction": "사용자·다운로드·매출 등 결과를 말한 흔적입니다.",
            "iteration": "반응을 바탕으로 고치거나 다음 버전을 만든 흔적입니다.",
            "other": "위 신호로 분류되지 않은 원문 구간입니다.",
        }
        chapters.append({
            "id": stage,
            "title": first["stageLabel"],
            "from": first["publishedAt"],
            "to": last["publishedAt"],
            "postCount": len(members),
            "interpretation": descriptions[stage],
            "evidence": [first["id"]] if first["id"] == last["id"] else [first["id"], last["id"]],
        })

    chapters.sort(key=lambda chapter: chapter["from"])
    dates = [datetime.fromisoformat(post["publishedAt"]) for post in posts]
    span_days = max(0, (dates[-1] - dates[0]).days)
    return {
        "chapters": chapters,
        "summary": {
            "postCount": len(posts),
            "earliest": posts[0]["publishedAt"],
            "latest": posts[-1]["publishedAt"],
            "spanDays": span_days,
            "stageCounts": {chapter["id"]: chapter["postCount"] for chapter in chapters},
            "method": "게시물 원문·작성 시각의 키워드 신호를 기준으로 구간을 묶은 관찰입니다.",
        },
    }


def parse_x_api(handle, bearer_token):
    """Fetch the user's complete available timeline through X API v2 pagination."""
    auth = {"Authorization": f"Bearer {bearer_token}", "User-Agent": "LaunchTimeline/2.0"}
    user_url = "https://api.x.com/2/users/by/username/" + urllib.parse.quote(handle)
    user_status, user_body = fetch_json(user_url + "?user.fields=created_at,description,public_metrics", auth)
    if user_status != 200 or not user_body.get("data", {}).get("id"):
        detail = user_body.get("detail") or user_body.get("title") or "X API 사용자 조회 실패"
        raise RuntimeError(f"X_API_{user_status}: {detail}")

    user = user_body["data"]
    user_id = user["id"]
    posts, next_token, pages = [], None, 0
    while pages < 30:
        params = {
            "max_results": "100",
            "exclude": "retweets",
            "tweet.fields": "created_at,public_metrics,conversation_id,referenced_tweets,attachments",
            "expansions": "attachments.media_keys",
            "media.fields": "url,preview_image_url,type",
        }
        if next_token:
            params["pagination_token"] = next_token
        url = f"https://api.x.com/2/users/{user_id}/tweets?{urllib.parse.urlencode(params)}"
        status, body = fetch_json(url, auth)
        if status != 200:
            detail = body.get("detail") or body.get("title") or "X API 게시물 조회 실패"
            raise RuntimeError(f"X_API_{status}: {detail}")
        for item in body.get("data", []):
            text = html.unescape(item.get("text", "")).strip()
            if not text or not item.get("created_at"):
                continue
            posts.append({
                "id": item["id"],
                "publishedAt": item["created_at"],
                "text": text,
                "url": f"https://x.com/{handle}/status/{item['id']}",
                "platform": "x",
                "publicMetrics": item.get("public_metrics", {}),
                "source": "x_api_v2",
            })
        pages += 1
        next_token = body.get("meta", {}).get("next_token")
        if not next_token:
            break

    posts.sort(key=lambda item: item["publishedAt"])
    return posts[:3000], {"user": user, "pages": pages, "source": "x_api_v2"}


def parse_x(handle, source_html):
    posts, seen, seen_content = [], set(), set()
    for match in REST_ID_RE.finditer(source_html):
        post_id = match.group(1)
        if post_id in seen:
            continue
        block = source_html[match.start() : match.start() + 16000]
        text_match, date_match = TEXT_RE.search(block), CREATED_RE.search(block)
        if not text_match or not date_match:
            continue
        try:
            text = json.loads(text_match.group(1))
        except json.JSONDecodeError:
            continue
        if not text.strip():
            continue
        content_key = (date_match.group(1)[:10], re.sub(r"\s+", " ", text).strip().lower())
        if content_key in seen_content:
            continue
        seen.add(post_id)
        seen_content.add(content_key)
        posts.append({"id": post_id, "publishedAt": iso_date(date_match.group(1)), "text": html.unescape(text), "url": f"https://x.com/{handle}/status/{post_id}", "platform": "x"})
    posts.sort(key=lambda item: item["publishedAt"])
    return posts[:200]


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    handle = (params.get("handle") or "").strip().lstrip("@")
    platform = (params.get("platform") or "x").lower()
    if not HANDLE_RE.match(handle):
        profile_base = "instagram.com" if platform == "instagram" else "x.com"
        return response(400, {"status": "error", "error": "invalid_handle", "platform": platform, "handle": handle[:30], "profileUrl": f"https://{profile_base}/", "posts": [], "message": "계정 아이디 형식이 올바르지 않습니다."})
    if platform not in {"x", "instagram"}:
        return response(400, {"status": "error", "error": "unsupported_platform"})
    profile_url = f"https://{'x.com' if platform == 'x' else 'instagram.com'}/{urllib.parse.quote(handle)}"
    if platform == "instagram":
        return response(200, {"status": "unavailable", "platform": platform, "handle": handle, "profileUrl": profile_url, "posts": [], "message": "Instagram 공개 전체 피드는 서버에서 안정적으로 읽을 수 있는 공식 공개 엔드포인트가 없어 원문 수집을 보류했습니다."})
    bearer_token = os.environ.get("X_BEARER_TOKEN", "").strip()
    api_error = None
    if bearer_token:
        try:
            posts, api_meta = parse_x_api(handle, bearer_token)
            analysis = analyze_posts(posts)
            return response(200, {"status": "ok" if posts else "empty", "platform": platform, "handle": handle, "profileUrl": profile_url, "fetchedAt": datetime.now(timezone.utc).isoformat(), "posts": posts, "collection": api_meta, **analysis, "message": "X API v2에서 next_token 페이지네이션으로 수집 가능한 게시물을 최초부터 최근까지 정렬했습니다." if posts else "X API v2에서 게시물을 찾지 못했습니다."})
        except (urllib.error.URLError, TimeoutError, ValueError, RuntimeError) as error:
            api_error = str(error)
    try:
        posts = parse_x(handle, fetch(profile_url))
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        detail = f"X API와 공개 프로필을 모두 읽지 못했습니다: {type(error).__name__}"
        if api_error:
            detail += f" (API: {api_error})"
        return response(200, {"status": "unavailable", "platform": platform, "handle": handle, "profileUrl": profile_url, "posts": [], "message": detail})
    analysis = analyze_posts(posts)
    message = "X 공개 프로필 HTML 폴백에서 확인 가능한 원문만 수집했습니다. X API v2는 설정되지 않았습니다."
    if api_error:
        message = f"X API v2를 먼저 시도했지만 실패해 공개 프로필 HTML로 폴백했습니다: {api_error}"
    return response(200, {"status": "ok" if posts else "empty", "platform": platform, "handle": handle, "profileUrl": profile_url, "fetchedAt": datetime.now(timezone.utc).isoformat(), "posts": posts, "collection": {"source": "profile_html_fallback", "apiError": api_error}, **analysis, "message": message if posts else message + " 게시물을 찾지 못했습니다."})

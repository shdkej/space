"""R2 image index and Supabase annotation API for Image Annotator."""

import json
import os
import hmac
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen


IMAGE_LIST_URL = os.environ.get("IMAGE_LIST_URL", "https://upload.shdkej.com/list")
IMAGE_ADMIN_TOKEN = os.environ.get("IMAGE_ADMIN_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ALLOWED_ORIGINS = {item.strip() for item in os.environ.get("ALLOWED_ORIGINS", "").split(",") if item.strip()}
ARCHIVE_PROXY_TOKEN = os.environ.get("ARCHIVE_PROXY_TOKEN", "")
OPENAI_SECRET_ARN = os.environ.get("OPENAI_SECRET_ARN", "")
PUBLIC_IMAGE_BASE_URL = os.environ.get("PUBLIC_IMAGE_BASE_URL", "https://img.shdkej.com").rstrip("/")
_openai_api_key_cache = None

TOPIC_CHOICES = [
    {"value": value, "description": description}
    for value, description in [
        ("장소", "장소나 여행지가 사진의 중심입니다."),
        ("음식", "음식이나 음료가 사진의 중심입니다."),
        ("자연", "풍경, 하늘, 식물, 바다 등 자연이 중심입니다."),
        ("인물", "사람이나 인물의 순간이 중심입니다."),
        ("동물", "동물이나 반려동물이 중심입니다."),
        ("건축·도시", "건물, 거리, 도시 풍경이 중심입니다."),
        ("사물·제품", "물건이나 제품이 중심입니다."),
        ("문서·화면", "문서, 표지판, 앱 또는 화면 정보가 중심입니다."),
        ("예술·콘텐츠", "작품, 디자인, 공연 또는 콘텐츠가 중심입니다."),
        ("일상", "위 범주에 뚜렷하게 속하지 않는 일상 장면입니다."),
    ]
]

SUBJECT_CHECKS = {
    "여행": "여행 중의 장소나 이동 장면이 보입니까?",
    "야경": "어두운 시간대의 도시나 야간 풍경이 보입니까?",
    "건축": "건물이나 건축 구조가 주요 피사체입니까?",
    "바다": "바다, 항구, 해변 또는 물가가 보입니까?",
    "자연": "식물, 산, 하늘, 물 등 자연 요소가 주요 피사체입니까?",
    "음식": "음식이나 음료가 주요 피사체입니까?",
    "인물": "한 명 이상의 사람이 주요 피사체입니까?",
    "동물": "동물이 사진의 주요 피사체입니까?",
    "문서": "읽을 수 있는 문서, 표지판 또는 화면이 주요 정보입니까?",
    "예술": "예술 작품, 디자인 또는 공연이 주요 피사체입니까?",
}

JUDGMENT_CHECKS = {
    "기억 보존": "사진 안에 나중에 다시 보고 싶을 만한 순간이나 경험이 뚜렷하게 보입니까? 촬영자의 실제 의도는 추정하지 마세요.",
    "장소 기록": "사진만으로 장소의 위치나 분위기를 기록하는 데 도움이 됩니까?",
    "참고 자료": "다시 참고할 수 있는 구체적인 정보나 방법이 사진에 보입니까?",
    "영감 수집": "시각적 아이디어나 창작 영감을 얻을 만한 요소가 사진에 보입니까?",
    "공유 후보": "사진 자체만으로 다른 사람과 공유할 만한 주제나 장면이 분명합니까?",
}


def handler(event, _context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod") or "GET").upper()
    path = event.get("rawPath") or event.get("path") or "/"
    origin = (event.get("headers") or {}).get("origin") or (event.get("headers") or {}).get("Origin") or ""

    if method == "OPTIONS":
        return response(204, "", origin)
    try:
        if path.endswith("/images") and method == "GET":
            return response(200, list_images(event), origin)
        if path.endswith("/annotations") and method == "GET":
            return response(200, get_annotations(event), origin)
        if path.endswith("/annotations") and method in {"POST", "PUT"}:
            return response(200, save_annotation(event), origin)
        if path.endswith("/topics") and method == "GET":
            return response(200, get_topics(event), origin)
        if path.endswith("/topics") and method in {"POST", "PUT"}:
            return response(200, save_topic(event), origin)
        if path.endswith("/classify") and method == "POST":
            return response(200, classify_upload(event), origin)
        if path.endswith("/health"):
            return response(200, {"ok": True, "service": "image-annotator"}, origin)
        return response(404, {"error": "not_found"}, origin)
    except ValueError as exc:
        return response(400, {"error": str(exc)}, origin)
    except UnauthorizedError:
        return response(401, {"error": "unauthorized"}, origin)
    except Exception as exc:  # Keep the public error bounded; details stay in CloudWatch.
        print(f"image_annotator_error: {type(exc).__name__}: {exc}")
        return response(500, {"error": "internal_error"}, origin)


def list_images(event):
    query = query_params(event)
    limit = max(1, min(int(query.get("limit", ["60"])[0]), 100))
    params = {"kind": "original", "limit": str(limit)}
    if query.get("cursor", [""])[0]:
        params["cursor"] = query["cursor"][0]
    # The existing media Worker exposes a public read-only list. Keep the
    # admin token out of this path; it is only needed for destructive media
    # operations, which this page does not perform.
    payload = http_json(add_query(IMAGE_LIST_URL, params), headers={"User-Agent": "image-annotator/1.0"})
    return {"images": payload.get("images", []), "cursor": payload.get("cursor"), "count": payload.get("count", 0)}


def get_annotations(event):
    keys = query_params(event).get("key", [])
    keys += query_params(event).get("keys", [""])[0].split(",") if query_params(event).get("keys") else []
    keys = [key.strip() for key in keys if key.strip()]
    if not keys:
        return {"annotations": []}
    params = {"select": "image_key,note,created_at,updated_at", "image_key": "in.(" + ",".join(quote_key(key) for key in keys) + ")", "order": "updated_at.desc"}
    return {"annotations": http_json(supabase_url("/rest/v1/image_annotations", params), headers=supabase_headers())}


def save_annotation(event):
    body = json.loads(event_body(event) or "{}")
    image_key = str(body.get("image_key", "")).strip()
    note = str(body.get("note", ""))
    if not image_key or len(image_key) > 500:
        raise ValueError("image_key_required")
    if len(note) > 10000:
        raise ValueError("note_too_long")
    payload = {"image_key": image_key, "note": note, "updated_at": datetime.now(timezone.utc).isoformat()}
    result = http_json(supabase_url("/rest/v1/image_annotations"), method="POST", body=payload, headers={**supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"})
    return {"annotation": result[0] if isinstance(result, list) and result else payload}


def get_topics(event):
    query = query_params(event)
    keys = query.get("key", [])
    keys += query.get("keys", [""])[0].split(",") if query.get("keys") else []
    keys = [key.strip() for key in keys if key.strip()]
    if not keys:
        return {"topics": []}
    params = {
        "select": "image_key,topic,tags,subject_tags,judgment_tags,summary,confidence,source,created_at,updated_at",
        "image_key": "in.(" + ",".join(quote_key(key) for key in keys) + ")",
        "order": "updated_at.desc",
    }
    return {"topics": http_json(supabase_url("/rest/v1/image_topics", params), headers=supabase_headers())}


def save_topic(event):
    body = json.loads(event_body(event) or "{}")
    image_key = str(body.get("image_key", "")).strip()
    topic = str(body.get("topic", "")).strip()
    tags = body.get("tags", [])
    subject_tags = body.get("subject_tags", tags)
    judgment_tags = body.get("judgment_tags", [])
    summary = str(body.get("summary", "")).strip()
    source = str(body.get("source", "agent-vision")).strip() or "agent-vision"
    confidence = body.get("confidence")
    if not image_key or len(image_key) > 500:
        raise ValueError("image_key_required")
    if not topic or len(topic) > 160:
        raise ValueError("topic_required")
    if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
        raise ValueError("tags_must_be_string_array")
    for field_name, values in (("subject_tags", subject_tags), ("judgment_tags", judgment_tags)):
        if not isinstance(values, list) or any(not isinstance(tag, str) for tag in values):
            raise ValueError(f"{field_name}_must_be_string_array")
        if len(values) > 20 or any(len(tag) > 80 for tag in values):
            raise ValueError(f"{field_name}_invalid")
    if len(tags) > 20 or any(len(tag) > 80 for tag in tags):
        raise ValueError("tags_too_long")
    if len(summary) > 1000:
        raise ValueError("summary_too_long")
    if confidence is not None:
        try:
            confidence = float(confidence)
        except (TypeError, ValueError) as exc:
            raise ValueError("confidence_invalid") from exc
        if not 0 <= confidence <= 1:
            raise ValueError("confidence_out_of_range")
    payload = {
        "image_key": image_key,
        "topic": topic,
        "tags": tags,
        "subject_tags": subject_tags,
        "judgment_tags": judgment_tags,
        "summary": summary,
        "confidence": confidence,
        "source": source[:80],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = http_json(
        supabase_url("/rest/v1/image_topics"),
        method="POST",
        body=payload,
        headers={**supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
    )
    return {"topic": result[0] if isinstance(result, list) and result else payload}


def classify_upload(event):
    if not ARCHIVE_PROXY_TOKEN:
        raise RuntimeError("classification_not_configured")
    headers = {str(k).lower(): str(v) for k, v in (event.get("headers") or {}).items()}
    supplied = headers.get("x-archive-proxy-token", "")
    if not hmac.compare_digest(supplied, ARCHIVE_PROXY_TOKEN):
        raise UnauthorizedError("unauthorized")
    api_key = get_openai_api_key()
    if not api_key:
        raise RuntimeError("classification_not_configured")

    body = json.loads(event_body(event) or "{}")
    image_key = str(body.get("image_key", "")).strip()
    if not image_key.startswith("original/") or ".." in image_key or len(image_key) > 500:
        raise ValueError("image_key_invalid")

    image_url = f"{PUBLIC_IMAGE_BASE_URL}/{image_key}"
    questions = [{
        "type": "choice",
        "name": "topic",
        "instructions": "사진에서 가장 중심이 되는 주제를 하나 고르세요. 불확실하면 일상으로 분류하세요.",
        "choices": TOPIC_CHOICES,
    }]
    questions.extend({
        "type": "predicate",
        "name": f"subject_{index}",
        "instructions": instructions,
    } for index, instructions in enumerate(SUBJECT_CHECKS.values()))
    questions.extend({
        "type": "predicate",
        "name": f"judgment_{index}",
        "instructions": instructions,
    } for index, instructions in enumerate(JUDGMENT_CHECKS.values()))

    request_body = {
        "model": "gpt-6-luna",
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": "이미지 보관함 분류를 위해 사진의 보이는 내용만 판단하세요. 개인 정보나 촬영자의 의도는 추정하지 마세요."},
                {"type": "input_image", "image_url": image_url, "detail": "low"},
            ],
        }],
        "questions": questions,
    }
    decision = http_json(
        "https://api.openai.com/v1/decisions",
        method="POST",
        body=request_body,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=45,
    )
    answers = {answer.get("name"): answer for answer in decision.get("answers", [])}
    topic_answer = answers.get("topic", {})
    if topic_answer.get("type") != "choice":
        raise RuntimeError("decision_topic_unavailable")

    subject_tags = [
        tag for index, tag in enumerate(SUBJECT_CHECKS)
        if answers.get(f"subject_{index}", {}).get("type") == "predicate"
        and float(answers[f"subject_{index}"].get("probability", 0)) >= 0.7
    ]
    judgment_tags = [
        tag for index, tag in enumerate(JUDGMENT_CHECKS)
        if answers.get(f"judgment_{index}", {}).get("type") == "predicate"
        and float(answers[f"judgment_{index}"].get("probability", 0)) >= 0.7
    ]
    topic = str(topic_answer.get("choice", "")).strip()
    allowed_topics = {choice["value"] for choice in TOPIC_CHOICES}
    if topic not in allowed_topics:
        raise RuntimeError("decision_topic_invalid")
    confidence = topic_answer.get("confidence")
    payload = {
        "image_key": image_key,
        "topic": topic,
        "tags": subject_tags,
        "subject_tags": subject_tags,
        "judgment_tags": judgment_tags,
        "summary": "",
        "confidence": confidence,
        "source": "decisions:gpt-6-luna",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = http_json(
        supabase_url("/rest/v1/image_topics"),
        method="POST",
        body=payload,
        headers={**supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
    )
    return {
        "topic": result[0] if isinstance(result, list) and result else payload,
        "usage": decision.get("usage", {}),
        "model": decision.get("model", "gpt-6-luna"),
    }


def get_openai_api_key():
    global _openai_api_key_cache
    if _openai_api_key_cache:
        return _openai_api_key_cache
    if not OPENAI_SECRET_ARN:
        return ""
    import boto3
    secret = boto3.client("secretsmanager").get_secret_value(SecretId=OPENAI_SECRET_ARN)
    _openai_api_key_cache = secret.get("SecretString", "")
    return _openai_api_key_cache


def query_params(event):
    if event.get("rawQueryString") is not None:
        return parse_qs(event.get("rawQueryString") or "", keep_blank_values=True)
    return {key: [value] for key, value in (event.get("queryStringParameters") or {}).items()}


def event_body(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        import base64
        return base64.b64decode(body).decode("utf-8")
    return body


def auth_headers():
    return {"Authorization": f"Bearer {IMAGE_ADMIN_TOKEN}"} if IMAGE_ADMIN_TOKEN else {}


def supabase_headers():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("supabase_not_configured")
    return {"apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}


def supabase_url(path, params=None):
    url = SUPABASE_URL + path
    return add_query(url, params or {})


def add_query(url, params):
    parsed = urlparse(url)
    existing = parse_qs(parsed.query, keep_blank_values=True)
    existing.update({key: [value] for key, value in params.items()})
    return urlunparse(parsed._replace(query=urlencode(existing, doseq=True)))


def quote_key(value):
    return value.replace("\\", "\\\\").replace(",", "\\,").replace("(", "\\(").replace(")", "\\)")


def http_json(url, method="GET", body=None, headers=None, timeout=15):
    request_headers = {"Accept": "application/json", **(headers or {})}
    raw = json.dumps(body).encode("utf-8") if body is not None else None
    if raw is not None:
        request_headers["Content-Type"] = "application/json"
    request = Request(url, data=raw, headers=request_headers, method=method)
    with urlopen(request, timeout=timeout) as result:
        content = result.read().decode("utf-8")
        return json.loads(content) if content else {}


def response(status, body, origin):
    allowed = origin if origin in ALLOWED_ORIGINS else next(iter(ALLOWED_ORIGINS), "")
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": allowed,
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Methods": "GET,OPTIONS,POST,PUT",
            "Vary": "Origin",
        },
        "body": body if isinstance(body, str) else json.dumps(body, ensure_ascii=False),
    }


class UnauthorizedError(Exception):
    """Raised when a private server-to-server endpoint receives no valid token."""

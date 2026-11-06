import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, Request

from app.config import settings

password_hasher = PasswordHasher()
USERNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._@+\-]{2,63}$")
_attempts: dict[str, list[datetime]] = {}


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.session_days)


def validate_username(username: str) -> str:
    value = username.strip()
    if not USERNAME_RE.fullmatch(value):
        raise HTTPException(status_code=422, detail="学号或邮箱需为 3–64 位字母、数字，或包含 . _ @ + -")
    return value.lower()


def validate_password(password: str) -> str:
    if not isinstance(password, str) or len(password) < 8 or len(password) > 128:
        raise HTTPException(status_code=422, detail="密码长度需要在 8 到 128 位之间")
    return password


def validate_invite(invite_code: str) -> None:
    if not isinstance(invite_code, str) or not secrets.compare_digest(invite_code, settings.invite_code):
        raise HTTPException(status_code=403, detail="邀请码不正确")


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request, scope: str, limit: int = 10) -> None:
    now = datetime.now(timezone.utc)
    key = f"{scope}:{client_key(request)}"
    recent = [item for item in _attempts.get(key, []) if now - item < timedelta(minutes=1)]
    if len(recent) >= limit:
        raise HTTPException(status_code=429, detail="尝试过于频繁，请稍后再试")
    recent.append(now)
    _attempts[key] = recent


def origin_allowed(origin: str) -> bool:
    if origin in settings.origin_list:
        return True
    if not settings.allow_lan_origins:
        return False
    if not origin.startswith(("http://", "https://")):
        return False
    host = origin.split("://", 1)[1].split("/")[0]
    hostname = host.split(":")[0]
    if hostname in {"localhost", "127.0.0.1", "::1"}:
        return True
    parts = hostname.split(".")
    if len(parts) != 4 or not all(part.isdigit() for part in parts):
        return False
    numbers = [int(part) for part in parts]
    if any(number > 255 for number in numbers):
        return False
    return numbers[0] == 10 or (numbers[0] == 192 and numbers[1] == 168) or (numbers[0] == 172 and 16 <= numbers[1] <= 31)


def enforce_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and not origin_allowed(origin):
        raise HTTPException(status_code=403, detail="来源不被允许")

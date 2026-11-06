from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import SessionToken, User
from app.security import enforce_origin, hash_token


def get_current_user(request: Request, db: Session = Depends(get_db), token: str | None = Cookie(default=None, alias=settings.cookie_name)) -> User:
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        enforce_origin(request)
    if not token:
        raise HTTPException(status_code=401, detail="请先登录")
    row = db.get(SessionToken, hash_token(token))
    now = datetime.now(timezone.utc)
    expires_at = None if row is None else row.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if row is None or expires_at is None or expires_at <= now:
        if row is not None:
            db.delete(row)
            db.commit()
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    user = db.get(User, row.user_id)
    if user is None or user.disabled:
        raise HTTPException(status_code=401, detail="账号不可用")
    return user


def owned_calibration(db: Session, user_id: str, external_id: str):
    from app.models import CalibrationRow

    row = db.scalar(select(CalibrationRow).where(CalibrationRow.user_id == user_id, CalibrationRow.external_id == external_id))
    if row is None:
        raise HTTPException(status_code=404, detail="标定方案不存在")
    return row


def owned_detection(db: Session, user_id: str, external_id: str):
    from app.models import DetectionRow

    row = db.scalar(select(DetectionRow).where(DetectionRow.user_id == user_id, DetectionRow.external_id == external_id))
    if row is None:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    return row

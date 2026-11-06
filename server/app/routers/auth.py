import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import SessionToken, User
from app.security import enforce_origin, enforce_rate_limit, hash_password, hash_token, new_session_expiry, validate_invite, validate_password, validate_username, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    username: str
    password: str
    inviteCode: str
    displayName: str = Field(default="", max_length=80)


class LoginBody(BaseModel):
    username: str
    password: str


def user_payload(user: User) -> dict:
    return {"id": user.id, "username": user.username, "displayName": user.display_name}


def issue_session(response: Response, db: Session, user: User) -> dict:
    token = secrets.token_urlsafe(32)
    db.add(SessionToken(token_hash=hash_token(token), user_id=user.id, expires_at=new_session_expiry(), created_at=datetime.now(timezone.utc)))
    db.commit()
    response.set_cookie(
        settings.cookie_name,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_days * 24 * 60 * 60,
        path="/",
    )
    return user_payload(user)


@router.post("/register")
def register(body: RegisterBody, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    enforce_origin(request)
    enforce_rate_limit(request, "register")
    validate_invite(body.inviteCode)
    username = validate_username(body.username)
    password = validate_password(body.password)
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(status_code=409, detail="这个学号或邮箱已经注册")
    display_name = body.displayName.strip() or username
    user = User(id=str(uuid4()), username=username, display_name=display_name[:80], password_hash=hash_password(password), created_at=datetime.now(timezone.utc), disabled=False)
    db.add(user)
    db.commit()
    return issue_session(response, db, user)


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    enforce_origin(request)
    enforce_rate_limit(request, "login")
    username = body.username.strip().lower()
    user = db.scalar(select(User).where(User.username == username))
    if user is None or user.disabled or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="学号/邮箱或密码不正确")
    return issue_session(response, db, user)


@router.post("/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)) -> dict:
    enforce_origin(request)
    token = request.cookies.get(settings.cookie_name)
    if token:
        row = db.get(SessionToken, hash_token(token))
        if row is not None:
            db.delete(row)
            db.commit()
    response.delete_cookie(settings.cookie_name, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return user_payload(user)

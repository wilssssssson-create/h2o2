from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, owned_detection
from app.models import DetectionRow, User
from app.validation import detection_payload

router = APIRouter(prefix="/api/detections", tags=["detections"])


class DetectionBatch(BaseModel):
    records: list[dict]


def present(row: DetectionRow) -> dict:
    payload = dict(row.payload)
    payload["id"] = row.external_id
    return payload


def _upsert(db: Session, user_id: str, body: dict) -> DetectionRow:
    external_id, payload, created_at = detection_payload(body)
    row = db.scalar(select(DetectionRow).where(DetectionRow.user_id == user_id, DetectionRow.external_id == external_id))
    if row is None:
        row = DetectionRow(user_id=user_id, external_id=external_id, payload=payload, created_at=created_at)
        db.add(row)
    else:
        row.payload = payload
    return row


@router.get("")
def list_detections(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(DetectionRow).where(DetectionRow.user_id == user.id)).all()
    return [present(row) for row in sorted(rows, key=lambda item: item.payload.get("createdAt", ""), reverse=True)]


@router.post("")
def save_detection(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    row = _upsert(db, user.id, body)
    db.commit()
    db.refresh(row)
    return present(row)


@router.post("/batch")
def save_detections(body: DetectionBatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    if len(body.records) > 50:
        raise HTTPException(status_code=422, detail="一次最多保存 50 条检测记录")
    rows = [_upsert(db, user.id, record) for record in body.records]
    db.commit()
    for row in rows:
        db.refresh(row)
    return [present(row) for row in rows]


@router.delete("/{external_id}", status_code=204)
def delete_detection(external_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    row = owned_detection(db, user.id, external_id)
    db.delete(row)
    db.commit()
    return Response(status_code=204)

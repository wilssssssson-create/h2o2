from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, owned_calibration
from app.models import CalibrationRow, User
from app.validation import calibration_payload

router = APIRouter(prefix="/api/calibrations", tags=["calibrations"])


def present(row: CalibrationRow) -> dict:
    payload = dict(row.payload)
    payload["id"] = row.external_id
    payload["isDefault"] = row.is_default
    return payload


def _clear_default(db: Session, user_id: str) -> None:
    rows = db.scalars(select(CalibrationRow).where(CalibrationRow.user_id == user_id, CalibrationRow.is_default.is_(True))).all()
    for row in rows:
        row.is_default = False
        payload = dict(row.payload)
        payload["isDefault"] = False
        row.payload = payload


@router.get("")
def list_calibrations(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(CalibrationRow).where(CalibrationRow.user_id == user.id)).all()
    return [present(row) for row in sorted(rows, key=lambda item: item.payload.get("createdAt", ""), reverse=True)]


@router.post("")
def save_calibration(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    external_id, payload, is_default, created_at = calibration_payload(body)
    row = db.scalar(select(CalibrationRow).where(CalibrationRow.user_id == user.id, CalibrationRow.external_id == external_id))
    if is_default:
        _clear_default(db, user.id)
    if row is None:
        row = CalibrationRow(user_id=user.id, external_id=external_id, payload=payload, is_default=is_default, created_at=created_at)
        db.add(row)
    else:
        row.payload = payload
        row.is_default = is_default
    db.commit()
    db.refresh(row)
    return present(row)


@router.post("/{external_id}/default")
def set_default(external_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    row = owned_calibration(db, user.id, external_id)
    _clear_default(db, user.id)
    row.is_default = True
    payload = dict(row.payload)
    payload["isDefault"] = True
    row.payload = payload
    db.commit()
    db.refresh(row)
    return present(row)


@router.delete("/{external_id}", status_code=204)
def delete_calibration(external_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    row = owned_calibration(db, user.id, external_id)
    db.delete(row)
    db.commit()
    return Response(status_code=204)

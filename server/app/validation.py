import json
import re
from datetime import datetime

from fastapi import HTTPException

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$")
MODEL_TYPES = {"linear", "weighted_linear", "logistic4", "monotone_spline", "ensemble"}
UNITS = {"μM", "mM"}
DETECTION_STATUSES = {"passed", "below_range", "above_range", "image_quality_issue", "missing_blank", "quality_control_failed"}
MAX_BYTES = 400_000


def _size(payload: dict) -> None:
    if len(json.dumps(payload, ensure_ascii=False)) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="提交的数据过大")


def _text(data: dict, key: str, limit: int, required: bool = True) -> str:
    value = data.get(key, "")
    if value is None:
        value = ""
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise HTTPException(status_code=422, detail=f"字段 {key} 无效")
    return value.strip() if required else value


def _number(data: dict, key: str) -> float:
    value = data.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=422, detail=f"字段 {key} 必须是数字")
    return float(value)


def _timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="时间格式无效") from error


def _external_id(value: object) -> str:
    if not isinstance(value, str) or not ID_RE.fullmatch(value):
        raise HTTPException(status_code=422, detail="记录 ID 无效")
    return value


def calibration_payload(data: dict) -> tuple[str, dict, bool, datetime]:
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="标定方案格式无效")
    _size(data)
    external_id = _external_id(data.get("id"))
    name = _text(data, "name", 120)
    created_at = _timestamp(_text(data, "createdAt", 40))
    feature = _text(data, "feature", 32)
    model_type = _text(data, "modelType", 32)
    if model_type not in MODEL_TYPES:
        raise HTTPException(status_code=422, detail="不支持的拟合类型")
    unit = _text(data, "concentrationUnit", 8)
    if unit not in UNITS:
        raise HTTPException(status_code=422, detail="浓度单位无效")
    coefficients = data.get("coefficients")
    standards = data.get("standards")
    metadata = data.get("metadata")
    if not isinstance(coefficients, list) or len(coefficients) > 12 or any(isinstance(item, bool) or not isinstance(item, (int, float)) for item in coefficients):
        raise HTTPException(status_code=422, detail="拟合系数无效")
    if model_type in {"linear", "weighted_linear"} and len(coefficients) < 2:
        raise HTTPException(status_code=422, detail="线性拟合缺少系数")
    if model_type == "logistic4" and len(coefficients) != 4:
        raise HTTPException(status_code=422, detail="四参数曲线需要 4 个系数")
    if model_type == "ensemble":
        ensemble = data.get("ensembleModel")
        members = ensemble.get("members") if isinstance(ensemble, dict) else None
        if not isinstance(members, list) or len(members) < 2:
            raise HTTPException(status_code=422, detail="集成模型缺少颜色通道")
    if not isinstance(standards, list) or len(standards) > 200:
        raise HTTPException(status_code=422, detail="标准点无效")
    if not isinstance(metadata, dict):
        raise HTTPException(status_code=422, detail="实验信息无效")
    _number(data, "rSquared")
    _number(data, "rmse")
    _number(data, "minConcentration")
    _number(data, "maxConcentration")
    if model_type == "monotone_spline":
        nonparametric = data.get("nonparametricModel")
        if not isinstance(nonparametric, dict) or not isinstance(nonparametric.get("knots"), list) or not nonparametric["knots"]:
            raise HTTPException(status_code=422, detail="非参数方案缺少单调样条节点")
    is_default = bool(data.get("isDefault"))
    payload = dict(data)
    payload["id"] = external_id
    payload["name"] = name
    payload["feature"] = feature
    payload["isDefault"] = is_default
    return external_id, payload, is_default, created_at


def detection_payload(data: dict) -> tuple[str, dict, datetime]:
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="检测记录格式无效")
    _size(data)
    external_id = _external_id(data.get("id"))
    _text(data, "sampleName", 120)
    created_at = _timestamp(_text(data, "createdAt", 40))
    _number(data, "predictedConcentration")
    _number(data, "lowerBound")
    _number(data, "upperBound")
    _text(data, "unit", 8)
    _external_id(data.get("calibrationModelId"))
    _text(data, "calibrationModelName", 120)
    status = _text(data, "status", 40)
    if status not in DETECTION_STATUSES:
        raise HTTPException(status_code=422, detail="检测状态无效")
    if not isinstance(data.get("colorFeatures"), dict) or not isinstance(data.get("qualityChecks"), list):
        raise HTTPException(status_code=422, detail="检测结果缺少颜色或质控信息")
    if len(data["qualityChecks"]) > 20:
        raise HTTPException(status_code=422, detail="质控项过多")
    payload = dict(data)
    payload["id"] = external_id
    return external_id, payload, created_at

import os
import tempfile

_db = tempfile.NamedTemporaryFile(prefix="h2o2-test-", suffix=".db", delete=False)
_db.close()
os.environ["H2O2_DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["H2O2_INVITE_CODE"] = "test-invite"
os.environ["H2O2_ALLOW_LAN_ORIGINS"] = "false"
os.environ["H2O2_COOKIE_SECURE"] = "false"

import pytest
from fastapi.testclient import TestClient

from app.db import engine
from app.main import app
from app.models import Base


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, username: str, password: str = "password1"):
    response = client.post("/api/auth/register", json={"username": username, "password": password, "inviteCode": "test-invite", "displayName": username})
    assert response.status_code == 200, response.text
    return response.json()


def calibration(external_id: str = "cal_test", name: str = "测试方案") -> dict:
    return {
        "id": external_id,
        "name": name,
        "createdAt": "2026-10-16T01:00:00+00:00",
        "feature": "B/G",
        "selectedFeature": "B/G",
        "modelType": "linear",
        "coefficients": [0.2, 0.01],
        "rSquared": 0.99,
        "rmse": 0.02,
        "minConcentration": 0,
        "maxConcentration": 400,
        "concentrationUnit": "μM",
        "standards": [],
        "metadata": {"tmbBatch": "", "hrpBatch": "", "reactionTime": "", "containerType": "", "phoneModel": "", "notes": ""},
        "isDefault": True,
    }


def detection(external_id: str = "det_test") -> dict:
    return {
        "id": external_id,
        "createdAt": "2026-10-16T02:00:00+00:00",
        "sampleName": "样品 A",
        "predictedConcentration": 12.5,
        "lowerBound": 11,
        "upperBound": 14,
        "unit": "μM",
        "calibrationModelId": "cal_test",
        "calibrationModelName": "测试方案",
        "status": "passed",
        "colorFeatures": {"meanR": 1, "meanG": 2, "meanB": 3, "normalizedR": 0.1, "normalizedG": 0.2, "normalizedB": 0.7, "grayscale": 2},
        "qualityChecks": [{"id": "blank", "label": "空白孔", "status": "pass", "detail": "已找到"}],
    }

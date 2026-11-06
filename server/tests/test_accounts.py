def test_register_requires_invite_code(client):
    response = client.post("/api/auth/register", json={"username": "student1", "password": "password1", "inviteCode": "wrong"})
    assert response.status_code == 403


def test_login_and_me(client):
    register = client.post("/api/auth/register", json={"username": "StudentA", "password": "password1", "inviteCode": "test-invite", "displayName": "甲同学"})
    assert register.status_code == 200
    assert register.json()["displayName"] == "甲同学"
    me = client.get("/api/auth/me")
    assert me.json()["username"] == "studenta"
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    login = client.post("/api/auth/login", json={"username": "studenta", "password": "password1"})
    assert login.status_code == 200
    assert client.get("/api/auth/me").json()["displayName"] == "甲同学"


def test_students_cannot_see_each_other(client):
    client.post("/api/auth/register", json={"username": "alice", "password": "password1", "inviteCode": "test-invite"})
    saved = client.post("/api/calibrations", json=calibration())
    assert saved.status_code == 200
    assert saved.json()["isDefault"] is True
    client.post("/api/detections", json=detection())
    client.post("/api/auth/logout")

    client.post("/api/auth/register", json={"username": "bob", "password": "password1", "inviteCode": "test-invite"})
    assert client.get("/api/calibrations").json() == []
    assert client.get("/api/detections").json() == []
    assert client.delete("/api/calibrations/cal_test").status_code == 404
    assert client.delete("/api/detections/det_test").status_code == 404

    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "alice", "password": "password1"})
    assert len(client.get("/api/calibrations").json()) == 1
    assert client.get("/api/detections").json()[0]["sampleName"] == "样品 A"


def test_monotone_calibration_allows_empty_coefficients(client):
    client.post("/api/auth/register", json={"username": "spline", "password": "password1", "inviteCode": "test-invite"})
    body = calibration("cal_spline", "样条方案")
    body["modelType"] = "monotone_spline"
    body["coefficients"] = []
    body["isDefault"] = False
    body["nonparametricModel"] = {"algorithm": "pava_pchip", "direction": "decreasing", "knots": [{"concentration": 0, "measured": 1, "tangent": 0, "sampleCount": 1}], "distinctConcentrations": 1, "sampleCount": 1}
    response = client.post("/api/calibrations", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["modelType"] == "monotone_spline"


def test_logistic_and_ensemble_calibrations_round_trip(client):
    client.post("/api/auth/register", json={"username": "curves", "password": "password1", "inviteCode": "test-invite"})
    logistic = calibration("cal_logistic", "四参数方案")
    logistic["modelType"] = "logistic4"
    logistic["feature"] = "labB"
    logistic["coefficients"] = [0.2, 1.4, 90, 1.8]
    logistic["isDefault"] = False
    logistic["metadata"] = {**logistic["metadata"], "cohortId": "batch-a", "lighting": "日光灯", "captureDate": "2026-10-16"}
    saved = client.post("/api/calibrations", json=logistic)
    assert saved.status_code == 200, saved.text
    assert saved.json()["coefficients"] == [0.2, 1.4, 90, 1.8]
    assert saved.json()["metadata"]["cohortId"] == "batch-a"

    ensemble = calibration("cal_ensemble", "集成方案")
    ensemble["modelType"] = "ensemble"
    ensemble["feature"] = "B"
    ensemble["coefficients"] = [10, -0.02]
    ensemble["isDefault"] = False
    ensemble["ensembleModel"] = {"algorithm": "median_linear", "loocvRmse": 4.2, "members": [{"feature": "B", "coefficients": [10, -0.02], "loocvRmse": 5.1}, {"feature": "labB", "coefficients": [8, -0.4], "loocvRmse": 6.4}]}
    saved = client.post("/api/calibrations", json=ensemble)
    assert saved.status_code == 200, saved.text
    stored = {item["id"]: item for item in client.get("/api/calibrations").json()}
    assert stored["cal_ensemble"]["ensembleModel"]["members"][1]["feature"] == "labB"

    logistic["coefficients"] = [0.2, 1.4]
    assert client.post("/api/calibrations", json=logistic).status_code == 422
    ensemble.pop("ensembleModel")
    assert client.post("/api/calibrations", json=ensemble).status_code == 422


def test_default_calibration_is_per_user(client):
    client.post("/api/auth/register", json={"username": "carol", "password": "password1", "inviteCode": "test-invite"})
    first = calibration("cal_one", "方案一")
    second = calibration("cal_two", "方案二")
    second["isDefault"] = False
    client.post("/api/calibrations", json=first)
    client.post("/api/calibrations", json=second)
    client.post("/api/calibrations/cal_two/default")
    rows = {item["id"]: item["isDefault"] for item in client.get("/api/calibrations").json()}
    assert rows == {"cal_one": False, "cal_two": True}


def calibration(external_id: str = "cal_test", name: str = "测试方案") -> dict:
    from tests.conftest import calibration as build

    return build(external_id, name)


def detection(external_id: str = "det_test") -> dict:
    from tests.conftest import detection as build

    return build(external_id)

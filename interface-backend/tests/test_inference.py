from fastapi.testclient import TestClient
import sqlite3
import uuid
import pytest
from app.main import app
from app.database import get_connection, initialize_database

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_inference.db"
    monkeypatch.setenv("DATABASE_PATH", str(test_db))
    initialize_database()
    yield


def test_inference_success():
    response = client.post(
        "/api/v1/inference",
        json={
            "model_id": "mock-model-v1",
            "prompt": "Explain what an API is",
            "max_tokens": 100,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["model_id"] == "mock-model-v1"
    assert data["model_version"] == "1.0.0"
    assert data["generated_text"]
    assert data["request_id"]
    assert data["latency_ms"] >= 0


def test_unknown_model():
    response = client.post(
        "/api/v1/inference",
        json={
            "model_id": "unknown-model",
            "prompt": "Hello",
            "max_tokens": 100,
        },
    )

    assert response.status_code == 404


def test_invalid_max_tokens():
    response = client.post(
        "/api/v1/inference",
        json={
            "model_id": "mock-model-v1",
            "prompt": "Hello",
            "max_tokens": -5,
        },
    )

    assert response.status_code == 422


def test_empty_prompt():
    response = client.post(
        "/api/v1/inference",
        json={
            "model_id": "mock-model-v1",
            "prompt": "",
            "max_tokens": 100,
        },
    )

    assert response.status_code == 422

def test_inference_request_is_persisted():
    from app.database import get_connection

    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/inference",
            json={
                "model_id": "mock-model-v1",
                "prompt": "Test database persistence",
                "max_tokens": 100,
            },
        )

        assert response.status_code == 200
        request_id = response.json()["request_id"]

        with get_connection() as connection:
            row = connection.execute(
                """
                SELECT request_id, prompt, status
                FROM inference_requests
                WHERE request_id = ?
                """,
                (request_id,),
            ).fetchone()

        assert row is not None
        assert row["prompt"] == "Test database persistence"
        assert row["status"] == "success"


def test_request_logs_pagination():
    with TestClient(app) as test_client:
        # Create requests to paginate over
        test_client.post(
            "/api/v1/inference",
            json={"model_id": "mock-model-v1", "prompt": "Prompt 1", "max_tokens": 50},
        )
        test_client.post(
            "/api/v1/inference",
            json={"model_id": "mock-model-v1", "prompt": "Prompt 2", "max_tokens": 50},
        )

        response = test_client.get(
            "/api/v1/requests",
            params={"limit": 1, "offset": 0},
        )

        assert response.status_code == 200

        data = response.json()

        assert data["total"] >= 2
        assert data["limit"] == 1
        assert data["offset"] == 0
        assert len(data["requests"]) == 1

def test_metrics_endpoint():
    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/metrics")

        assert response.status_code == 200

        data = response.json()

        assert data["total_requests"] >= 0
        assert data["successful_requests"] >= 0
        assert data["failed_requests"] >= 0
        assert 0 <= data["success_rate_percent"] <= 100
        assert data["average_latency_ms"] >= 0
        assert data["total_input_tokens"] >= 0
        assert data["total_output_tokens"] >= 0


def test_metrics_summary_endpoint():
    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/metrics/summary")

        assert response.status_code == 200

        data = response.json()
        assert "totalRequests" in data
        assert "errorRate" in data
        assert "totalTokens" in data
        assert "sparklines" in data
        assert data["totalRequests"] >= 0
        assert 0 <= data["errorRate"] <= 1


def test_metrics_timeseries_endpoint():
    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/metrics/timeseries?range=24h")

        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_metrics_match_database():
    from app.database import get_connection

    with TestClient(app) as test_client:
        with get_connection() as connection:
            expected_total = connection.execute(
                "SELECT COUNT(*) FROM inference_requests"
            ).fetchone()[0]

        response = test_client.get("/api/v1/metrics")

        assert response.status_code == 200
        assert response.json()["total_requests"] == expected_total

from unittest.mock import patch


def test_inference_failure_is_logged():
    from app.database import get_connection

    with TestClient(app) as test_client:
        with patch(
            "app.main.generate_response",
            side_effect=RuntimeError("Simulated model failure"),
        ):
            response = test_client.post(
                "/api/v1/inference",
                json={
                    "model_id": "mock-model-v1",
                    "prompt": "Trigger a failure",
                    "max_tokens": 100,
                },
            )

        assert response.status_code == 500
        assert response.json()["detail"] == "Inference failed"

        with get_connection() as connection:
            row = connection.execute(
                """
                SELECT status, error_message
                FROM inference_requests
                WHERE prompt = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                ("Trigger a failure",),
            ).fetchone()

        assert row is not None
        assert row["status"] == "failed"
        assert row["error_message"] == "Simulated model failure"
def test_model_registry_endpoint():
    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/models")

        assert response.status_code == 200

        data = response.json()
        assert len(data["models"]) >= 1

        model = next(
            item for item in data["models"]
            if item["model_id"] == "mock-model-v1"
        )

        assert model["model_version"] == "1.0.0"
        assert model["status"] == "ready"

def test_get_model_details():
    with TestClient(app) as test_client:
        response = test_client.get(
            "/api/v1/models/mock-model-v1"
        )

        assert response.status_code == 200

        data = response.json()
        assert data["model_id"] == "mock-model-v1"
        assert data["model_version"] == "1.0.0"
        assert data["status"] == "ready"


def test_get_unknown_model_details():
    with TestClient(app) as test_client:
        response = test_client.get(
            "/api/v1/models/unknown-model"
        )

        assert response.status_code == 404


def test_register_model():
    # Use a unique model_id so repeated test runs do not hit a conflict.
    model_id = f"registration-test-{uuid.uuid4().hex[:8]}"
    try:
        response = client.post(
            "/api/v1/models",
            json={
                "model_id": model_id,
                "model_version": "1.0.0",
                "provider": "mock",
                "description": "Model registration test",
            },
        )

        assert response.status_code == 201
        data = response.json()["model"]
        assert data["model_id"] == model_id
        assert data["model_version"] == "1.0.0"
        assert data["provider"] == "mock"
        assert data["status"] == "ready"
    finally:
        # Clean up so repeated runs leave no orphaned records.
        with get_connection() as conn:
            conn.execute("DELETE FROM models WHERE model_id = ?", (model_id,))


def test_register_duplicate_model_id():
    model_id = f"duplicate-test-{uuid.uuid4().hex[:8]}"
    payload = {
        "model_id": model_id,
        "model_version": "1.0.0",
        "provider": "mock",
        "description": "Duplicate registration test",
    }

    try:
        first_response = client.post("/api/v1/models", json=payload)
        second_response = client.post("/api/v1/models", json=payload)

        assert first_response.status_code == 201
        assert second_response.status_code == 409
    finally:
        with get_connection() as conn:
            conn.execute("DELETE FROM models WHERE model_id = ?", (model_id,))

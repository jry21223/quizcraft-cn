import pytest
from fastapi.testclient import TestClient

import db_storage
import server
from scripts.admin_api_security import resolve_admin_api_base_url


def test_feedback_dashboard_stays_public(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "test-token")
    monkeypatch.setattr(server, "db_runtime_enabled", lambda: False)

    client = TestClient(server.app)

    response = client.get("/api/feedback/dashboard")

    assert response.status_code == 200
    assert "pending_items" in response.json()


def test_feedback_status_update_requires_admin_token(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "test-token")

    client = TestClient(server.app)

    response = client.patch(
        "/api/feedback/1/status",
        json={"status": "resolved"},
    )

    assert response.status_code == 403


def test_feedback_status_normalization_accepts_archived():
    assert server._normalize_feedback_status("archived") == "archived"
    assert db_storage._normalize_feedback_status("archived") == "archived"


def test_feedback_dashboard_fallback_reports_archived_items(tmp_path, monkeypatch):
    feedback_file = tmp_path / "feedbacks.json"
    feedback_file.write_text(
        """
        [
          {
            "feedback_id": 1,
            "question_index": 8,
            "question_bank": "xigai",
            "suggestion": "needs source check",
            "status": "archived",
            "created_at": "2026-06-29T08:00:00+08:00"
          },
          {
            "feedback_id": 2,
            "question_index": 9,
            "question_bank": "java",
            "suggestion": "fixed",
            "status": "resolved",
            "created_at": "2026-06-29T09:00:00+08:00",
            "resolved_at": "2026-06-29T10:00:00+08:00"
          }
        ]
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr(server, "FEEDBACK_FILE", str(feedback_file))

    dashboard = server.load_feedback_dashboard_fallback()

    assert dashboard["summary"]["pending_total"] == 0
    assert dashboard["summary"]["resolved_total"] == 1
    assert dashboard["summary"]["archived_total"] == 1
    assert dashboard["archived_items"][0]["feedback_id"] == 1


def test_admin_api_base_url_requires_explicit_value(monkeypatch):
    monkeypatch.delenv("QUIZCRAFT_API_BASE_URL", raising=False)

    with pytest.raises(SystemExit, match="QUIZCRAFT_API_BASE_URL"):
        resolve_admin_api_base_url(None)


def test_admin_api_base_url_rejects_public_http():
    with pytest.raises(SystemExit, match="HTTPS"):
        resolve_admin_api_base_url("http://8.146.200.82/api")


@pytest.mark.parametrize(
    "url",
    [
        "https://superhuazai.me/api",
        "http://127.0.0.1:10086/api",
        "http://localhost:10086/api",
    ],
)
def test_admin_api_base_url_allows_https_and_local_http(url):
    assert resolve_admin_api_base_url(url) == url.rstrip("/")

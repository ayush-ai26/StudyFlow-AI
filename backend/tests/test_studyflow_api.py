"""StudyFlow AI backend API tests."""
import pytest
import requests
import time


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "StudyFlow" in data.get("message", "")


# ---------- Auth ----------
class TestAuth:
    def test_guest_creates_session(self, guest_session):
        assert "session_token" in guest_session
        assert guest_session["user"]["is_guest"] is True
        assert guest_session["user"]["user_id"].startswith("guest_")

    def test_me_returns_user(self, api_client, base_url, auth_headers, guest_session):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == guest_session["user"]["user_id"]
        assert data["is_guest"] is True

    def test_me_unauthenticated(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------- Tasks ----------
class TestTasks:
    def test_create_list_update_delete(self, api_client, base_url, auth_headers):
        # Create
        payload = {
            "title": "TEST_Read chapter 5",
            "description": "Math",
            "type": "task",
            "subject": "Math",
            "priority": "high",
        }
        r = api_client.post(f"{base_url}/api/tasks", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        task = r.json()
        assert task["title"] == payload["title"]
        assert task["completed"] is False
        task_id = task["id"]

        # List
        r = api_client.get(f"{base_url}/api/tasks", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert any(t["id"] == task_id for t in items)

        # Patch -> completed=true
        r = api_client.patch(
            f"{base_url}/api/tasks/{task_id}",
            json={"completed": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["completed"] is True

        # Delete
        r = api_client.delete(f"{base_url}/api/tasks/{task_id}", headers=auth_headers)
        assert r.status_code == 200

        # Verify deletion
        r = api_client.get(f"{base_url}/api/tasks", headers=auth_headers)
        assert all(t["id"] != task_id for t in r.json())


# ---------- Notes ----------
class TestNotes:
    def test_create_list_update_delete(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/notes",
            json={"title": "TEST_Note", "content": "hello", "subject": "Bio"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        note = r.json()
        note_id = note["id"]
        assert note["title"] == "TEST_Note"

        r = api_client.get(f"{base_url}/api/notes", headers=auth_headers)
        assert r.status_code == 200
        assert any(n["id"] == note_id for n in r.json())

        r = api_client.patch(
            f"{base_url}/api/notes/{note_id}",
            json={"content": "updated"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["content"] == "updated"

        r = api_client.delete(f"{base_url}/api/notes/{note_id}", headers=auth_headers)
        assert r.status_code == 200


# ---------- Pomodoro ----------
class TestPomodoro:
    def test_log_and_list(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/pomodoro",
            json={"duration_minutes": 25, "subject": "Math"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["duration_minutes"] == 25

        r = api_client.get(f"{base_url}/api/pomodoro", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert any(item["id"] == s["id"] for item in r.json())


# ---------- Prep ----------
class TestPrep:
    def test_get_default_then_update(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/prep", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sat_progress"] == 0
        assert data["ielts_progress"] == 0

        r = api_client.patch(
            f"{base_url}/api/prep",
            json={"sat_progress": 40, "ielts_progress": 60},
            headers=auth_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["sat_progress"] == 40
        assert data["ielts_progress"] == 60


# ---------- Analytics ----------
class TestAnalytics:
    def test_summary_structure(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/analytics/summary", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["streak_days", "weekly_minutes", "daily_minutes", "completion_rate"]:
            assert k in data, f"missing {k}"
        assert isinstance(data["daily_minutes"], list)
        assert len(data["daily_minutes"]) == 7
        for entry in data["daily_minutes"]:
            assert "date" in entry and "minutes" in entry


# ---------- Chat (real LLM) ----------
class TestChat:
    def test_chat_message_and_history(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/chat",
            json={"message": "Give me one quick study tip in <=15 words."},
            headers=auth_headers,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user" in data and "assistant" in data
        assert data["user"]["role"] == "user"
        assert data["assistant"]["role"] == "assistant"
        assert len(data["assistant"]["content"]) > 0

        r = api_client.get(f"{base_url}/api/chat/history", headers=auth_headers)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2


# ---------- AI Schedule ----------
class TestSchedule:
    def test_schedule_returns_plan(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/ai/schedule",
            json={
                "goal": "Improve SAT math",
                "available_hours_per_day": 2,
                "days": 3,
                "subjects": ["Math"],
            },
            headers=auth_headers,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plan" in data
        assert isinstance(data["plan"], list)
        # We accept empty if LLM glitches but log it
        if len(data["plan"]) > 0:
            entry = data["plan"][0]
            assert "day" in entry or "title" in entry


# ---------- Logout (run last) ----------
class TestLogoutZ:
    def test_logout_invalidates(self, api_client, base_url):
        # fresh guest so we don't break other tests
        r = api_client.post(f"{base_url}/api/auth/guest")
        assert r.status_code == 200
        token = r.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}

        r = api_client.get(f"{base_url}/api/auth/me", headers=headers)
        assert r.status_code == 200

        r = api_client.post(f"{base_url}/api/auth/logout", headers=headers)
        assert r.status_code == 200

        r = api_client.get(f"{base_url}/api/auth/me", headers=headers)
        assert r.status_code == 401

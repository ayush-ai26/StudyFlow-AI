"""Validation bound tests for new Pydantic constraints (refactor verification)."""
import pytest


# ---------- Prep progress 0..100 ----------
class TestPrepBounds:
    def test_sat_progress_above_max_returns_422(self, api_client, base_url, auth_headers):
        r = api_client.patch(
            f"{base_url}/api/prep",
            json={"sat_progress": 150},
            headers=auth_headers,
        )
        assert r.status_code == 422, r.text

    def test_sat_progress_below_min_returns_422(self, api_client, base_url, auth_headers):
        r = api_client.patch(
            f"{base_url}/api/prep",
            json={"sat_progress": -1},
            headers=auth_headers,
        )
        assert r.status_code == 422, r.text

    def test_ielts_progress_above_max_returns_422(self, api_client, base_url, auth_headers):
        r = api_client.patch(
            f"{base_url}/api/prep",
            json={"ielts_progress": 999},
            headers=auth_headers,
        )
        assert r.status_code == 422, r.text

    def test_sat_progress_50_succeeds(self, api_client, base_url, auth_headers):
        r = api_client.patch(
            f"{base_url}/api/prep",
            json={"sat_progress": 50},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["sat_progress"] == 50


# ---------- Pomodoro duration 1..240 ----------
class TestPomodoroBounds:
    def test_duration_zero_returns_422(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/pomodoro",
            json={"duration_minutes": 0, "subject": "Math"},
            headers=auth_headers,
        )
        assert r.status_code == 422, r.text

    def test_duration_above_max_returns_422(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/pomodoro",
            json={"duration_minutes": 500, "subject": "Math"},
            headers=auth_headers,
        )
        assert r.status_code == 422, r.text

    def test_duration_25_succeeds(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/pomodoro",
            json={"duration_minutes": 25, "subject": "Math"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["duration_minutes"] == 25

    def test_duration_240_succeeds_at_boundary(self, api_client, base_url, auth_headers):
        r = api_client.post(
            f"{base_url}/api/pomodoro",
            json={"duration_minutes": 240, "subject": "Math"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["duration_minutes"] == 240

import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://studyflow-ai-45.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def guest_session(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/guest", timeout=20)
    assert r.status_code == 200, f"guest auth failed: {r.status_code} {r.text}"
    data = r.json()
    return data


@pytest.fixture(scope="session")
def auth_headers(guest_session):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {guest_session['session_token']}",
    }

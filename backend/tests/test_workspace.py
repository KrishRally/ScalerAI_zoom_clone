"""Team Chat, Docs and Calendar."""

from datetime import datetime, timedelta, timezone

import pytest


@pytest.fixture
def new_user(client):
    """Sign up a fresh user and return (headers, user)."""
    counter = {"n": 0}

    def _make(name="Person"):
        counter["n"] += 1
        email = f"{name.lower().replace(' ', '.')}.{id(counter)}.{counter['n']}@example.com"
        res = client.post("/api/auth/signup", json={"name": name, "email": email, "password": "secret123"}).json()
        return {"Authorization": f"Bearer {res['token']}"}, res["user"]

    return _make


# ---------- Team Chat ----------


def test_everyone_is_in_general(client, auth, new_user):
    h, _ = new_user("Newbie")
    names = [c["name"] for c in client.get("/api/chat/channels", headers=h).json()]
    assert "General" in names
    demo_channels = client.get("/api/chat/channels", headers=auth).json()
    assert {"General", "Dashboard v2"} <= {c["name"] for c in demo_channels}


def test_channel_messages_and_unread(client, new_user):
    ha, a = new_user("Ann")
    hb, b = new_user("Bob")
    channel = client.post("/api/chat/channels", json={"name": "#project-x", "member_ids": [b["id"]]}, headers=ha).json()
    assert channel["name"] == "project-x"
    cid = channel["id"]

    client.post(f"/api/chat/channels/{cid}/messages", json={"content": "Hello Bob"}, headers=ha)
    bob_view = next(c for c in client.get("/api/chat/channels", headers=hb).json() if c["id"] == cid)
    assert bob_view["unread_count"] == 1
    assert client.get("/api/chat/unread", headers=hb).json()["unread"] >= 1
    # Your own messages are never unread.
    ann_view = next(c for c in client.get("/api/chat/channels", headers=ha).json() if c["id"] == cid)
    assert ann_view["unread_count"] == 0

    msgs = client.get(f"/api/chat/channels/{cid}/messages", headers=hb).json()
    assert [m["content"] for m in msgs] == ["Hello Bob"]
    assert msgs[0]["sender"]["name"] == "Ann"
    client.post(f"/api/chat/channels/{cid}/read", headers=hb)
    bob_view = next(c for c in client.get("/api/chat/channels", headers=hb).json() if c["id"] == cid)
    assert bob_view["unread_count"] == 0

    # Only new messages after an id
    client.post(f"/api/chat/channels/{cid}/messages", json={"content": "Second"}, headers=ha)
    newer = client.get(f"/api/chat/channels/{cid}/messages", params={"after_id": msgs[0]["id"]}, headers=hb).json()
    assert [m["content"] for m in newer] == ["Second"]


def test_outsiders_cannot_read_a_channel(client, new_user):
    ha, _ = new_user("Owner")
    hc, _ = new_user("Outsider")
    cid = client.post("/api/chat/channels", json={"name": "secret"}, headers=ha).json()["id"]
    assert client.get(f"/api/chat/channels/{cid}/messages", headers=hc).status_code == 403
    assert client.post(f"/api/chat/channels/{cid}/messages", json={"content": "hi"}, headers=hc).status_code == 403


def test_direct_messages_are_reused(client, new_user):
    ha, a = new_user("Dee")
    hb, b = new_user("Eli")
    first = client.post("/api/chat/direct", json={"user_id": b["id"]}, headers=ha).json()
    again = client.post("/api/chat/direct", json={"user_id": a["id"]}, headers=hb).json()
    assert first["id"] == again["id"] and first["is_direct"]
    assert first["name"] == "Eli" and again["name"] == "Dee"  # named after the other person


def test_add_members_and_leave(client, new_user):
    ha, _ = new_user("Fay")
    hb, b = new_user("Gus")
    cid = client.post("/api/chat/channels", json={"name": "team"}, headers=ha).json()["id"]
    updated = client.post(f"/api/chat/channels/{cid}/members", json={"user_ids": [b["id"]]}, headers=ha).json()
    assert "Gus" in [m["name"] for m in updated["members"]]
    assert client.delete(f"/api/chat/channels/{cid}/members/me", headers=hb).status_code == 204
    general = next(c for c in client.get("/api/chat/channels", headers=hb).json() if c["is_default"])
    assert client.delete(f"/api/chat/channels/{general['id']}/members/me", headers=hb).status_code == 400


def test_people_search(client, auth):
    res = client.get("/api/users/search", params={"q": "priya"}, headers=auth).json()
    assert [p["name"] for p in res] == ["Priya Sharma"]
    assert client.get("/api/users/search", params={"q": "priya"}).status_code == 401


def test_chat_needs_sign_in(client):
    assert client.get("/api/chat/channels").status_code == 401


# ---------- Docs ----------


def test_documents_crud_and_sharing(client, new_user):
    ha, a = new_user("Hana")
    hb, b = new_user("Ivan")
    doc = client.post("/api/docs", json={"title": "Plan", "content": "Step 1"}, headers=ha).json()
    did = doc["id"]
    assert doc["is_owner"] and doc["can_edit"] and not doc["shared"]

    # Not shared yet: Ivan can't see it (looks like it doesn't exist).
    assert client.get(f"/api/docs/{did}", headers=hb).status_code == 404

    client.post(f"/api/docs/{did}/members", json={"email": b["email"].upper(), "can_edit": False}, headers=ha)
    ivan_doc = client.get(f"/api/docs/{did}", headers=hb).json()
    assert ivan_doc["content"] == "Step 1" and ivan_doc["can_edit"] is False
    assert client.patch(f"/api/docs/{did}", json={"content": "hack"}, headers=hb).status_code == 403
    assert did in [d["id"] for d in client.get("/api/docs", headers=hb).json()]

    # Give edit access; Ivan edits; Hana sees who edited last.
    client.post(f"/api/docs/{did}/members", json={"email": b["email"], "can_edit": True}, headers=ha)
    client.patch(f"/api/docs/{did}", json={"content": "Step 1\nStep 2"}, headers=hb)
    latest = client.get(f"/api/docs/{did}", headers=ha).json()
    assert latest["content"] == "Step 1\nStep 2" and latest["updated_by_name"] == "Ivan"

    # Only the owner deletes.
    assert client.delete(f"/api/docs/{did}", headers=hb).status_code == 403
    assert client.delete(f"/api/docs/{did}", headers=ha).status_code == 204
    assert client.get(f"/api/docs/{did}", headers=ha).status_code == 404


def test_share_with_unknown_email(client, new_user):
    ha, _ = new_user("Jo")
    did = client.post("/api/docs", json={}, headers=ha).json()["id"]
    res = client.post(f"/api/docs/{did}/members", json={"email": "nobody.here@example.com"}, headers=ha)
    assert res.status_code == 404


def test_seeded_docs(client, auth):
    titles = {d["title"]: d for d in client.get("/api/docs", headers=auth).json()}
    assert titles["Q4 Planning"]["is_owner"]
    assert not titles["Design Review notes"]["is_owner"]


# ---------- Calendar ----------


def test_calendar_range(client, auth):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=7)).isoformat()
    end = (now + timedelta(days=7)).isoformat()
    meetings = client.get("/api/meetings/calendar", params={"start": start, "end": end}, headers=auth).json()
    titles = [m["title"] for m in meetings]
    assert "Daily Standup" in titles  # scheduled, upcoming
    assert "Weekly Team Sync" in titles  # scheduled, in the past
    times = [m["scheduled_start"] or m["started_at"] for m in meetings]
    assert times == sorted(times)
    far = client.get(
        "/api/meetings/calendar",
        params={"start": (now + timedelta(days=60)).isoformat(), "end": (now + timedelta(days=67)).isoformat()},
        headers=auth,
    ).json()
    assert far == []

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


def _seeded_teammate(client, auth, name):
    return client.get("/api/users/search", params={"q": name}, headers=auth).json()[0]


def test_demo_account_has_seeded_chats(client, auth):
    names = {c["name"] for c in client.get("/api/chat/channels", headers=auth).json()}
    assert {"General", "Dashboard v2", "Priya Sharma"} <= names


def test_new_accounts_start_with_no_chats(client, auth, new_user):
    h, _ = new_user("Newbie")
    assert client.get("/api/chat/channels", headers=h).json() == []
    assert client.get("/api/chat/unread", headers=h).json() == {"unread": 0}
    # The sample chats belong to the demo account only.
    general = next(c for c in client.get("/api/chat/channels", headers=auth).json() if c["name"] == "General")
    assert client.get(f"/api/chat/channels/{general['id']}/messages", headers=h).status_code == 403
    assert client.post(f"/api/chat/channels/{general['id']}/messages", json={"content": "hi"}, headers=h).status_code == 403


def test_new_accounts_can_chat_with_each_other(client, new_user):
    ha, a = new_user("Ann")
    hb, b = new_user("Bob")
    channel = client.post("/api/chat/channels", json={"name": "project-x", "member_ids": [b["id"]]}, headers=ha).json()
    client.post(f"/api/chat/channels/{channel['id']}/messages", json={"content": "Hello Bob"}, headers=ha)
    bob_view = next(c for c in client.get("/api/chat/channels", headers=hb).json() if c["id"] == channel["id"])
    assert bob_view["unread_count"] == 1
    client.post(f"/api/chat/channels/{channel['id']}/read", headers=hb)
    assert client.get("/api/chat/unread", headers=hb).json()["unread"] == 0

    dm = client.post("/api/chat/direct", json={"user_id": b["id"]}, headers=ha).json()
    again = client.post("/api/chat/direct", json={"user_id": a["id"]}, headers=hb).json()
    assert dm["id"] == again["id"] and dm["name"] == "Bob" and again["name"] == "Ann"
    assert {c["name"] for c in client.get("/api/chat/channels", headers=hb).json()} == {"project-x", "Ann"}


def test_sign_ups_are_taken_out_of_the_sample_general(client, auth, new_user):
    from app.database import SessionLocal
    from app.models import ChannelMember, ChannelMessage, ChatChannel
    from app.seed import keep_sample_chats_private

    h, me = new_user("Old Account")
    with SessionLocal() as db:  # what older versions did on sign up
        general = db.query(ChatChannel).filter(ChatChannel.is_default.is_(True)).one()
        db.add(ChannelMember(channel_id=general.id, user_id=me["id"]))
        db.add(ChannelMessage(channel_id=general.id, user_id=me["id"], content="old post"))
        db.commit()
        keep_sample_chats_private(db)
    assert client.get("/api/chat/channels", headers=h).json() == []
    demo_general = next(c for c in client.get("/api/chat/channels", headers=auth).json() if c["name"] == "General")
    assert "Old Account" not in [m["name"] for m in demo_general["members"]]
    assert demo_general["last_message"]["content"] != "old post"


def test_channel_messages_and_read(client, auth):
    daniel = _seeded_teammate(client, auth, "daniel")
    channel = client.post(
        "/api/chat/channels", json={"name": "#project-x", "member_ids": [daniel["id"]]}, headers=auth
    ).json()
    assert channel["name"] == "project-x"
    assert {m["name"] for m in channel["members"]} == {"Alex Johnson", "Daniel Kim"}
    cid = channel["id"]

    first = client.post(f"/api/chat/channels/{cid}/messages", json={"content": "Hello Daniel"}, headers=auth).json()
    view = next(c for c in client.get("/api/chat/channels", headers=auth).json() if c["id"] == cid)
    assert view["unread_count"] == 0  # your own messages are never unread
    assert view["last_message"]["content"] == "Hello Daniel"

    client.post(f"/api/chat/channels/{cid}/messages", json={"content": "Second"}, headers=auth)
    newer = client.get(f"/api/chat/channels/{cid}/messages", params={"after_id": first["id"]}, headers=auth).json()
    assert [m["content"] for m in newer] == ["Second"]
    assert client.post(f"/api/chat/channels/{cid}/read", headers=auth).status_code == 204
    assert client.get("/api/chat/unread", headers=auth).status_code == 200


def test_direct_messages_are_reused(client, auth):
    sara = _seeded_teammate(client, auth, "sara")
    first = client.post("/api/chat/direct", json={"user_id": sara["id"]}, headers=auth).json()
    again = client.post("/api/chat/direct", json={"user_id": sara["id"]}, headers=auth).json()
    assert first["id"] == again["id"] and first["is_direct"]
    assert first["name"] == "Sara Lopez"  # named after the other person


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


# ---------- Notifications ----------


def test_notifications(client, new_user):
    ha, a = new_user("Nina")
    hb, b = new_user("Omar")
    assert client.get("/api/notifications", headers=hb).json() == {"items": [], "unseen": 0}

    # A chat message, a shared doc and a meeting starting soon.
    dm = client.post("/api/chat/direct", json={"user_id": b["id"]}, headers=ha).json()
    client.post(f"/api/chat/channels/{dm['id']}/messages", json={"content": "Ping"}, headers=ha)
    doc = client.post("/api/docs", json={"title": "Plan"}, headers=ha).json()
    client.post(f"/api/docs/{doc['id']}/members", json={"email": b["email"], "can_edit": False}, headers=ha)
    soon = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()
    client.post("/api/meetings/scheduled", json={"title": "Sync", "scheduled_start": soon}, headers=hb)
    later = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    client.post("/api/meetings/scheduled", json={"title": "Later", "scheduled_start": later}, headers=hb)

    res = client.get("/api/notifications", headers=hb).json()
    by_kind = {n["kind"]: n for n in res["items"]}
    assert set(by_kind) == {"chat", "doc", "meeting"} and res["unseen"] == 3
    assert by_kind["chat"]["title"] == "Nina sent you a message" and by_kind["chat"]["body"] == "Ping"
    assert by_kind["chat"]["link"] == f"/chat?c={dm['id']}"
    assert by_kind["doc"]["title"] == 'Nina shared "Plan" with you'
    assert by_kind["meeting"]["title"].startswith("Sync starts in")  # "Later" is too far away

    # Opening the bell marks everything as seen; reading the chat removes it.
    assert client.post("/api/notifications/seen", headers=hb).status_code == 204
    res = client.get("/api/notifications", headers=hb).json()
    assert res["unseen"] == 0 and len(res["items"]) == 3
    client.post(f"/api/chat/channels/{dm['id']}/read", headers=hb)
    assert {n["kind"] for n in client.get("/api/notifications", headers=hb).json()["items"]} == {"doc", "meeting"}
    assert client.get("/api/notifications").status_code == 401


# ---------- Sample calendar ----------


def test_daily_plan_is_5_to_10_meetings_in_working_hours():
    from datetime import date as _date

    from app.seed import WORKDAY, _daily_plan

    for offset in range(30):
        day = _date(2026, 10, 1) + timedelta(days=offset)
        plan = _daily_plan(day)
        assert 5 <= len(plan) <= 10
        assert plan == _daily_plan(day)  # same day, same plan
        for (_, _, start, minutes), nxt in zip(plan, plan[1:] + [None]):
            assert start.time() >= WORKDAY[0]
            end = start + timedelta(minutes=minutes)
            assert end.time() <= WORKDAY[1]
            if nxt:
                assert end <= nxt[2]  # no overlaps


def test_demo_calendar_is_filled_every_day_until_the_20th(client, auth):
    from app.database import SessionLocal
    from app.seed import DAILY_UNTIL, seed_daily_meetings

    tz = timezone(timedelta(minutes=330))
    today = datetime.now(tz).date()
    last = max(DAILY_UNTIL, today + timedelta(days=11))
    start = datetime.combine(today + timedelta(days=1), datetime.min.time(), tz)
    end = datetime.combine(last + timedelta(days=1), datetime.min.time(), tz)
    meetings = client.get(
        "/api/meetings/calendar", params={"start": start.isoformat(), "end": end.isoformat()}, headers=auth
    ).json()
    per_day = {}
    for m in meetings:
        d = datetime.fromisoformat(m["scheduled_start"].replace("Z", "+00:00")).astimezone(tz).date()
        per_day[d] = per_day.get(d, 0) + 1
    for i in range((last - today).days):
        day = today + timedelta(days=i + 1)
        assert per_day.get(day, 0) >= 5, day

    # Deleting a sample meeting doesn't bring it back.
    victim = meetings[0]
    assert client.delete(f"/api/meetings/{victim['meeting_code']}", headers=auth).status_code == 204
    with SessionLocal() as db:
        assert seed_daily_meetings(db) == 0
    client.get("/api/meetings/upcoming", headers=auth)
    codes = {m["meeting_code"] for m in client.get(
        "/api/meetings/calendar", params={"start": start.isoformat(), "end": end.isoformat()}, headers=auth
    ).json()}
    assert victim["meeting_code"] not in codes

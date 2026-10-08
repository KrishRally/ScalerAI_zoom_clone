from datetime import datetime, timedelta, timezone


def _future(hours=3):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _start_instant(client):
    me = client.get("/api/users/me").json()
    meeting = client.post("/api/meetings/instant").json()
    host = client.post(
        f"/api/meetings/{meeting['meeting_code']}/join",
        json={"display_name": me["name"], "user_id": me["id"]},
    ).json()
    return meeting, host


def test_seeded_dashboard(client):
    assert client.get("/api/users/me").status_code == 200
    upcoming = client.get("/api/meetings/upcoming").json()
    recent = client.get("/api/meetings/recent").json()
    assert len(upcoming) >= 5
    assert len(recent) >= 4
    starts = [m["scheduled_start"] for m in upcoming]
    assert starts == sorted(starts)


def test_instant_meeting_has_code_and_link(client):
    meeting = client.post("/api/meetings/instant").json()
    code = meeting["meeting_code"]
    assert len(code) == 10 and code.isdigit()
    assert meeting["invite_link"] == (
        f"http://testserver-frontend/j/{code}?pwd={meeting['passcode']}"
    )


def test_schedule_meeting_shows_in_upcoming(client):
    res = client.post(
        "/api/meetings/scheduled",
        json={
            "title": "Planning",
            "description": "Q4",
            "scheduled_start": _future(),
            "duration_minutes": 45,
        },
    )
    assert res.status_code == 201
    code = res.json()["meeting_code"]
    assert code in [m["meeting_code"] for m in client.get("/api/meetings/upcoming").json()]


def test_schedule_rejects_past_and_bad_input(client):
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert client.post(
        "/api/meetings/scheduled", json={"title": "x", "scheduled_start": past}
    ).status_code == 400
    assert client.post(
        "/api/meetings/scheduled", json={"title": "  ", "scheduled_start": _future()}
    ).status_code == 422


def test_lookup_accepts_spaces_and_links(client):
    meeting = client.post("/api/meetings/instant").json()
    code = meeting["meeting_code"]
    spaced = f"{code[:3]} {code[3:7]} {code[7:]}"
    assert client.get("/api/meetings/lookup", params={"q": spaced}).status_code == 200
    assert client.get(
        "/api/meetings/lookup", params={"q": meeting["invite_link"]}
    ).status_code == 200
    assert client.get("/api/meetings/lookup", params={"q": "1234567890"}).status_code == 404
    assert client.get("/api/meetings/lookup", params={"q": "hello"}).status_code == 400


def test_guest_join_needs_passcode(client):
    meeting = client.post("/api/meetings/instant").json()
    url = f"/api/meetings/{meeting['meeting_code']}/join"
    assert client.post(url, json={"display_name": "Guest"}).status_code == 403
    ok = client.post(url, json={"display_name": "Guest", "passcode": meeting["passcode"]})
    assert ok.status_code == 201
    assert ok.json()["role"] == "attendee"


def test_host_controls(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    assert host["role"] == "host"
    guest = client.post(
        f"/api/meetings/{code}/join",
        json={"display_name": "Guest", "passcode": meeting["passcode"]},
    ).json()

    # A guest cannot use host controls.
    assert client.post(
        f"/api/meetings/{code}/mute-all", json={"requester_id": guest["id"]}
    ).status_code == 403

    assert client.post(
        f"/api/meetings/{code}/mute-all", json={"requester_id": host["id"]}
    ).json() == {"muted": 1}

    assert client.post(
        f"/api/participants/{guest['id']}/remove", json={"requester_id": host["id"]}
    ).status_code == 204
    state = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": guest["id"]}
    ).json()
    assert state["me"]["status"] == "removed"
    assert [p["id"] for p in state["participants"]] == [host["id"]]


def test_chat_and_end_meeting(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    client.post(
        f"/api/meetings/{code}/messages",
        json={"participant_id": host["id"], "content": "Hello"},
    )
    state = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": host["id"]}
    ).json()
    assert [m["content"] for m in state["messages"]] == ["Hello"]
    assert state["meeting"]["status"] == "live"

    ended = client.post(f"/api/meetings/{code}/end", json={"requester_id": host["id"]})
    assert ended.json()["status"] == "ended"
    assert code in [m["meeting_code"] for m in client.get("/api/meetings/recent").json()]
    # Guests cannot join an ended meeting.
    assert client.post(
        f"/api/meetings/{code}/join",
        json={"display_name": "Late", "passcode": meeting["passcode"]},
    ).status_code == 400


def test_last_person_leaving_ends_meeting(client):
    meeting, host = _start_instant(client)
    client.post(f"/api/participants/{host['id']}/leave")
    lookup = client.get(
        "/api/meetings/lookup", params={"q": meeting["meeting_code"]}
    ).json()
    assert lookup["status"] == "ended"

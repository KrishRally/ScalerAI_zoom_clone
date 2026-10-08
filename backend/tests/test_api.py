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
    host_view = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": host["id"]}
    ).json()
    assert [p["id"] for p in host_view["participants"]] == [host["id"]]


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


def test_stale_participants_are_expired(client, monkeypatch):
    from app.services import participants as participant_service

    meeting, host = _start_instant(client)
    # Pretend the timeout is zero, as if the host closed the tab long ago.
    monkeypatch.setattr(participant_service, "PARTICIPANT_TIMEOUT_SECONDS", -1)
    client.get("/api/meetings/upcoming")
    lookup = client.get(
        "/api/meetings/lookup", params={"q": meeting["meeting_code"]}
    ).json()
    assert lookup["status"] == "ended"



# ---------- Host settings, waiting room, notes, reactions ----------


def _guest(client, meeting, name="Guest"):
    return client.post(
        f"/api/meetings/{meeting['meeting_code']}/join",
        json={"display_name": name, "passcode": meeting["passcode"]},
    )


def _settings(client, code, host_id, **changes):
    return client.patch(
        f"/api/meetings/{code}/settings", json={"requester_id": host_id, **changes}
    )


def test_new_meetings_have_default_settings(client):
    meeting = client.post("/api/meetings/instant").json()
    assert meeting["settings"]["allow_chat"] is True
    assert meeting["settings"]["waiting_room"] is False


def test_schedule_with_options(client):
    meeting = client.post(
        "/api/meetings/scheduled",
        json={
            "title": "Secure call",
            "scheduled_start": _future(),
            "waiting_room": True,
            "mute_on_entry": True,
        },
    ).json()
    assert meeting["settings"]["waiting_room"] is True
    assert meeting["settings"]["mute_on_entry"] is True


def test_only_host_can_change_settings(client):
    meeting, host = _start_instant(client)
    guest = _guest(client, meeting).json()
    code = meeting["meeting_code"]
    assert _settings(client, code, guest["id"], allow_chat=False).status_code == 403
    assert _settings(client, code, host["id"], allow_chat=False).json()["allow_chat"] is False


def test_chat_and_reactions_follow_settings(client):
    meeting, host = _start_instant(client)
    guest = _guest(client, meeting).json()
    code = meeting["meeting_code"]
    _settings(client, code, host["id"], allow_chat=False, allow_reactions=False)

    msg = {"participant_id": guest["id"], "content": "hi"}
    assert client.post(f"/api/meetings/{code}/messages", json=msg).status_code == 403
    # The host is never blocked by their own rules.
    msg["participant_id"] = host["id"]
    assert client.post(f"/api/meetings/{code}/messages", json=msg).status_code == 201

    react = {"participant_id": guest["id"], "emoji": "👍"}
    assert client.post(f"/api/meetings/{code}/reactions", json=react).status_code == 403
    _settings(client, code, host["id"], allow_reactions=True)
    assert client.post(f"/api/meetings/{code}/reactions", json=react).status_code == 201
    state = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": host["id"]}
    ).json()
    assert [r["emoji"] for r in state["reactions"]] == ["👍"]


def test_unmute_video_and_rename_rules(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    _settings(client, code, host["id"], allow_unmute=False, allow_video=False, allow_rename=False)
    guest = _guest(client, meeting).json()
    # Joined muted with video off because of the rules.
    assert guest["is_muted"] is True and guest["is_video_on"] is False

    url = f"/api/participants/{guest['id']}"
    assert client.patch(url, json={"is_muted": False}).status_code == 403
    assert client.patch(url, json={"is_video_on": True}).status_code == 403
    assert client.patch(url, json={"display_name": "New"}).status_code == 403
    # Turning things off, or raising a hand, is always fine.
    assert client.patch(url, json={"is_muted": True, "is_hand_raised": True}).status_code == 200

    _settings(client, code, host["id"], allow_rename=True)
    assert client.patch(url, json={"display_name": "Renamed"}).json()["display_name"] == "Renamed"
    # The host can rename anyone.
    renamed = client.post(
        f"/api/participants/{guest['id']}/rename",
        json={"requester_id": host["id"], "display_name": "By Host"},
    ).json()
    assert renamed["display_name"] == "By Host"


def test_mute_on_entry(client):
    meeting, host = _start_instant(client)
    _settings(client, meeting["meeting_code"], host["id"], mute_on_entry=True)
    assert _guest(client, meeting).json()["is_muted"] is True


def test_lock_meeting(client):
    meeting, host = _start_instant(client)
    _settings(client, meeting["meeting_code"], host["id"], is_locked=True)
    res = _guest(client, meeting)
    assert res.status_code == 403
    assert "locked" in res.json()["detail"]


def test_waiting_room_admit_and_remove(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    _settings(client, code, host["id"], waiting_room=True)
    first = _guest(client, meeting, "First").json()
    second = _guest(client, meeting, "Second").json()
    assert first["status"] == "waiting"

    host_view = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": host["id"]}
    ).json()
    assert {p["display_name"] for p in host_view["waiting"]} == {"First", "Second"}
    assert [p["id"] for p in host_view["participants"]] == [host["id"]]

    # Waiting people see nothing of the meeting yet.
    waiting_view = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": first["id"]}
    ).json()
    assert waiting_view["participants"] == [] and waiting_view["messages"] == []

    client.post(f"/api/participants/{first['id']}/admit", json={"requester_id": host["id"]})
    client.post(f"/api/participants/{second['id']}/remove", json={"requester_id": host["id"]})
    host_view = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": host["id"]}
    ).json()
    assert host_view["waiting"] == []
    assert len(host_view["participants"]) == 2


def test_turning_off_waiting_room_admits_everyone(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    _settings(client, code, host["id"], waiting_room=True)
    guest = _guest(client, meeting).json()
    _settings(client, code, host["id"], waiting_room=False)
    state = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": guest["id"]}
    ).json()
    assert state["me"]["status"] == "in_meeting"


def test_suspend_activities(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()
    settings = client.post(f"/api/meetings/{code}/suspend", json={"requester_id": host["id"]}).json()
    assert settings["is_locked"] is True and settings["allow_chat"] is False
    state = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": guest["id"]}
    ).json()
    assert state["me"]["is_muted"] is True and state["me"]["is_video_on"] is False


def test_make_host_and_auto_host(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()
    other = _guest(client, meeting, "Other").json()

    res = client.post(f"/api/participants/{guest['id']}/make-host", json={"requester_id": host["id"]})
    assert res.json()["role"] == "host"
    # The old host lost their controls.
    assert client.post(f"/api/meetings/{code}/mute-all", json={"requester_id": host["id"]}).status_code == 403

    # When the host leaves without handing over, the earliest joiner takes over.
    client.post(f"/api/participants/{guest['id']}/leave")
    state = client.get(
        f"/api/meetings/{code}/state", params={"participant_id": other["id"]}
    ).json()
    hosts = [p["display_name"] for p in state["participants"] if p["role"] == "host"]
    assert hosts == ["Alex Johnson"]


def test_notes_are_private_and_saved(client):
    meeting, host = _start_instant(client)
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()

    client.put(f"/api/meetings/{code}/notes", json={"participant_id": host["id"], "content": "Host notes"})
    client.put(f"/api/meetings/{code}/notes", json={"participant_id": guest["id"], "content": "Guest notes"})
    client.put(f"/api/meetings/{code}/notes", json={"participant_id": host["id"], "content": "Host notes v2"})

    host_note = client.get(f"/api/meetings/{code}/notes", params={"participant_id": host["id"]}).json()
    guest_note = client.get(f"/api/meetings/{code}/notes", params={"participant_id": guest["id"]}).json()
    assert host_note["content"] == "Host notes v2"
    assert guest_note["content"] == "Guest notes"
    # The signed in user can read their notes later from the Meetings page.
    assert client.get(f"/api/meetings/{code}/notes/mine").json()["content"] == "Host notes v2"

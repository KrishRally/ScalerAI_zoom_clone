from datetime import datetime, timedelta, timezone

import pytest


def _future(hours=3):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def pt(participant):
    """Headers proving we are this participant."""
    return {"X-Participant-Token": participant["participant_token"]}


@pytest.fixture
def start_instant(client, auth):
    """Create an instant meeting and join it as the signed in host."""

    def _start():
        meeting = client.post("/api/meetings/instant", headers=auth).json()
        host = client.post(
            f"/api/meetings/{meeting['meeting_code']}/join",
            json={"display_name": "Alex Johnson"},
            headers=auth,
        ).json()
        return meeting, host

    return _start


def _guest(client, meeting, name="Guest", **extra):
    return client.post(
        f"/api/meetings/{meeting['meeting_code']}/join",
        json={"display_name": name, "passcode": meeting["passcode"], **extra},
    )


def _state(client, code, participant):
    return client.get(
        f"/api/meetings/{code}/state",
        params={"participant_id": participant["id"]},
        headers=pt(participant),
    ).json()


def _settings(client, code, host, **changes):
    return client.patch(
        f"/api/meetings/{code}/settings",
        json={"requester_id": host["id"], **changes},
        headers=pt(host),
    )


def _host_action(client, path, host, **body):
    return client.post(path, json={"requester_id": host["id"], **body}, headers=pt(host))


# ---------- Accounts ----------


def test_sign_up_sign_in_and_sign_out(client):
    res = client.post(
        "/api/auth/signup",
        json={"name": "  Krish   Rally ", "email": "Krish.Rally@Gmail.com", "password": "secret123"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["name"] == "Krish Rally"
    assert body["user"]["email"] == "krish.rally@gmail.com"  # stored in lower case
    headers = {"Authorization": f"Bearer {body['token']}"}
    assert client.get("/api/users/me", headers=headers).json()["email"] == "krish.rally@gmail.com"

    # Same email again, any capitalisation, is refused.
    again = client.post(
        "/api/auth/signup",
        json={"name": "X", "email": "KRISH.RALLY@gmail.com", "password": "secret123"},
    )
    assert again.status_code == 409

    # Signing in works with any capitalisation.
    login = client.post("/api/auth/login", json={"email": "krish.rally@GMAIL.com", "password": "secret123"})
    assert login.status_code == 200

    # Signing out kills that token.
    client.post("/api/auth/logout", headers=headers)
    assert client.get("/api/users/me", headers=headers).status_code == 401


def test_sign_up_validation(client):
    bad_email = client.post("/api/auth/signup", json={"name": "A", "email": "not-an-email", "password": "secret123"})
    short_pw = client.post("/api/auth/signup", json={"name": "A", "email": "a@example.com", "password": "short"})
    assert bad_email.status_code == 422
    assert short_pw.status_code == 422


def test_wrong_password_and_unknown_email_look_the_same(client):
    wrong = client.post("/api/auth/login", json={"email": "alex.johnson@example.com", "password": "nope"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_dashboard_needs_sign_in(client):
    assert client.get("/api/users/me").status_code == 401
    assert client.get("/api/meetings/upcoming").status_code == 401
    assert client.post("/api/meetings/instant").status_code == 401


def test_passwords_are_hashed(client):
    from app.database import SessionLocal
    from app.models import User

    client.post("/api/auth/signup", json={"name": "H", "email": "hash@example.com", "password": "secret123"})
    with SessionLocal() as db:
        stored = db.query(User).filter_by(email="hash@example.com").one().password_hash
    assert "secret123" not in stored and stored.startswith("pbkdf2_sha256$")


def test_profile_password_and_settings(client):
    token = client.post(
        "/api/auth/signup", json={"name": "Old", "email": "p@example.com", "password": "secret123"}
    ).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.patch("/api/users/me", json={"name": "New Name"}, headers=h).json()["name"] == "New Name"

    assert client.post(
        "/api/users/me/password", json={"current_password": "wrong", "new_password": "newsecret1"}, headers=h
    ).status_code == 400
    assert client.post(
        "/api/users/me/password", json={"current_password": "secret123", "new_password": "newsecret1"}, headers=h
    ).status_code == 204
    assert client.post("/api/auth/login", json={"email": "p@example.com", "password": "newsecret1"}).status_code == 200

    settings = client.patch(
        "/api/users/me/settings", json={"default_waiting_room": True, "start_with_video": False}, headers=h
    ).json()
    assert settings["default_waiting_room"] is True and settings["start_with_video"] is False
    # New meetings pick up the defaults.
    meeting = client.post("/api/meetings/instant", headers=h).json()
    assert meeting["settings"]["waiting_room"] is True


def test_each_user_sees_only_their_meetings(client, auth):
    token = client.post(
        "/api/auth/signup", json={"name": "Solo", "email": "solo@example.com", "password": "secret123"}
    ).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/meetings/upcoming", headers=h).json() == []
    assert len(client.get("/api/meetings/upcoming", headers=auth).json()) >= 5


# ---------- Meetings ----------


def test_seeded_dashboard(client, auth):
    upcoming = client.get("/api/meetings/upcoming", headers=auth).json()
    recent = client.get("/api/meetings/recent", headers=auth).json()
    assert len(upcoming) >= 5
    assert len(recent) >= 4
    starts = [m["scheduled_start"] for m in upcoming]
    assert starts == sorted(starts)


def test_instant_meeting_has_code_and_link(client, auth):
    meeting = client.post("/api/meetings/instant", headers=auth).json()
    code = meeting["meeting_code"]
    assert len(code) == 10 and code.isdigit()
    assert meeting["invite_link"] == f"http://testserver-frontend/j/{code}?pwd={meeting['passcode']}"


def test_schedule_meeting_shows_in_upcoming(client, auth):
    res = client.post(
        "/api/meetings/scheduled",
        json={"title": "Planning", "description": "Q4", "scheduled_start": _future(), "duration_minutes": 45},
        headers=auth,
    )
    assert res.status_code == 201
    code = res.json()["meeting_code"]
    upcoming = client.get("/api/meetings/upcoming", headers=auth).json()
    assert code in [m["meeting_code"] for m in upcoming]


def test_schedule_rejects_past_and_bad_input(client, auth):
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert client.post(
        "/api/meetings/scheduled", json={"title": "x", "scheduled_start": past}, headers=auth
    ).status_code == 400
    assert client.post(
        "/api/meetings/scheduled", json={"title": "  ", "scheduled_start": _future()}, headers=auth
    ).status_code == 422


def test_lookup_accepts_spaces_and_links(client, auth):
    meeting = client.post("/api/meetings/instant", headers=auth).json()
    code = meeting["meeting_code"]
    spaced = f"{code[:3]} {code[3:7]} {code[7:]}"
    assert client.get("/api/meetings/lookup", params={"q": spaced}).status_code == 200
    assert client.get("/api/meetings/lookup", params={"q": meeting["invite_link"]}).status_code == 200
    assert client.get("/api/meetings/lookup", params={"q": "1234567890"}).status_code == 404
    assert client.get("/api/meetings/lookup", params={"q": "hello"}).status_code == 400


def test_schedule_with_options(client, auth):
    meeting = client.post(
        "/api/meetings/scheduled",
        json={"title": "Secure", "scheduled_start": _future(), "waiting_room": True, "mute_on_entry": True},
        headers=auth,
    ).json()
    assert meeting["settings"]["waiting_room"] is True
    assert meeting["settings"]["mute_on_entry"] is True


# ---------- Joining and identity ----------


def test_guest_join_needs_passcode(client, auth):
    meeting = client.post("/api/meetings/instant", headers=auth).json()
    url = f"/api/meetings/{meeting['meeting_code']}/join"
    assert client.post(url, json={"display_name": "Guest"}).status_code == 403
    ok = client.post(url, json={"display_name": "Guest", "passcode": meeting["passcode"]})
    assert ok.status_code == 201
    assert ok.json()["role"] == "attendee"
    assert ok.json()["participant_token"]


def test_only_the_signed_in_owner_becomes_host(client, auth):
    meeting = client.post("/api/meetings/instant", headers=auth).json()
    url = f"/api/meetings/{meeting['meeting_code']}/join"
    # Claiming to be the host in the body does nothing any more.
    fake = client.post(url, json={"display_name": "Faker", "passcode": meeting["passcode"], "user_id": 1})
    assert fake.json()["role"] == "attendee"
    # Another signed in user is just an attendee too.
    other = client.post(
        "/api/auth/signup", json={"name": "Other", "email": "other@example.com", "password": "secret123"}
    ).json()["token"]
    res = client.post(
        url, json={"display_name": "Other", "passcode": meeting["passcode"]}, headers={"Authorization": f"Bearer {other}"}
    )
    assert res.json()["role"] == "attendee"
    real = client.post(url, json={"display_name": "Alex"}, headers=auth)
    assert real.json()["role"] == "host"


def test_room_actions_need_the_participant_key(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()
    # Knowing the host's id is not enough without their key.
    res = client.post(f"/api/meetings/{code}/mute-all", json={"requester_id": host["id"]}, headers=pt(guest))
    assert res.status_code == 403
    no_key = client.get(f"/api/meetings/{code}/state", params={"participant_id": host["id"]})
    assert no_key.status_code == 403
    assert client.post(f"/api/participants/{host['id']}/leave").status_code == 403


# ---------- Host controls ----------


def test_host_controls(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    assert host["role"] == "host"
    guest = _guest(client, meeting).json()

    # A guest cannot use host controls, even with their own valid key.
    assert _host_action(client, f"/api/meetings/{code}/mute-all", guest).status_code == 403
    assert _host_action(client, f"/api/meetings/{code}/mute-all", host).json() == {"muted": 1}

    assert _host_action(client, f"/api/participants/{guest['id']}/remove", host).status_code == 204
    assert _state(client, code, guest)["me"]["status"] == "removed"
    assert [p["id"] for p in _state(client, code, host)["participants"]] == [host["id"]]


def test_chat_and_end_meeting(client, auth, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    client.post(f"/api/meetings/{code}/messages", json={"participant_id": host["id"], "content": "Hello"}, headers=pt(host))
    state = _state(client, code, host)
    assert [m["content"] for m in state["messages"]] == ["Hello"]
    assert state["meeting"]["status"] == "live"

    ended = _host_action(client, f"/api/meetings/{code}/end", host)
    assert ended.json()["status"] == "ended"
    recent = client.get("/api/meetings/recent", headers=auth).json()
    assert code in [m["meeting_code"] for m in recent]
    assert _guest(client, meeting, "Late").status_code == 400


def test_last_person_leaving_ends_meeting(client, start_instant):
    meeting, host = start_instant()
    client.post(f"/api/participants/{host['id']}/leave", headers=pt(host))
    lookup = client.get("/api/meetings/lookup", params={"q": meeting["meeting_code"]}).json()
    assert lookup["status"] == "ended"


def test_stale_participants_are_expired(client, auth, start_instant, monkeypatch):
    from app.services import participants as participant_service

    meeting, _host = start_instant()
    monkeypatch.setattr(participant_service, "PARTICIPANT_TIMEOUT_SECONDS", -1)
    client.get("/api/meetings/upcoming", headers=auth)
    lookup = client.get("/api/meetings/lookup", params={"q": meeting["meeting_code"]}).json()
    assert lookup["status"] == "ended"


def test_new_meetings_have_default_settings(client, auth):
    meeting = client.post("/api/meetings/instant", headers=auth).json()
    assert meeting["settings"]["allow_chat"] is True
    assert meeting["settings"]["waiting_room"] is False


def test_only_host_can_change_settings(client, start_instant):
    meeting, host = start_instant()
    guest = _guest(client, meeting).json()
    code = meeting["meeting_code"]
    assert _settings(client, code, guest, allow_chat=False).status_code == 403
    assert _settings(client, code, host, allow_chat=False).json()["allow_chat"] is False


def test_chat_and_reactions_follow_settings(client, start_instant):
    meeting, host = start_instant()
    guest = _guest(client, meeting).json()
    code = meeting["meeting_code"]
    _settings(client, code, host, allow_chat=False, allow_reactions=False)

    url = f"/api/meetings/{code}/messages"
    assert client.post(url, json={"participant_id": guest["id"], "content": "hi"}, headers=pt(guest)).status_code == 403
    assert client.post(url, json={"participant_id": host["id"], "content": "hi"}, headers=pt(host)).status_code == 201

    react = f"/api/meetings/{code}/reactions"
    body = {"participant_id": guest["id"], "emoji": "👍"}
    assert client.post(react, json=body, headers=pt(guest)).status_code == 403
    _settings(client, code, host, allow_reactions=True)
    assert client.post(react, json=body, headers=pt(guest)).status_code == 201
    assert [r["emoji"] for r in _state(client, code, host)["reactions"]] == ["👍"]


def test_unmute_video_and_rename_rules(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    _settings(client, code, host, allow_unmute=False, allow_video=False, allow_rename=False)
    guest = _guest(client, meeting).json()
    assert guest["is_muted"] is True and guest["is_video_on"] is False

    url = f"/api/participants/{guest['id']}"
    assert client.patch(url, json={"is_muted": False}, headers=pt(guest)).status_code == 403
    assert client.patch(url, json={"is_video_on": True}, headers=pt(guest)).status_code == 403
    assert client.patch(url, json={"display_name": "New"}, headers=pt(guest)).status_code == 403
    assert client.patch(url, json={"is_muted": True, "is_hand_raised": True}, headers=pt(guest)).status_code == 200

    _settings(client, code, host, allow_rename=True)
    assert client.patch(url, json={"display_name": "Renamed"}, headers=pt(guest)).json()["display_name"] == "Renamed"
    renamed = _host_action(client, f"/api/participants/{guest['id']}/rename", host, display_name="By Host").json()
    assert renamed["display_name"] == "By Host"


def test_mute_on_entry(client, start_instant):
    meeting, host = start_instant()
    _settings(client, meeting["meeting_code"], host, mute_on_entry=True)
    assert _guest(client, meeting).json()["is_muted"] is True


def test_lock_meeting(client, start_instant):
    meeting, host = start_instant()
    _settings(client, meeting["meeting_code"], host, is_locked=True)
    res = _guest(client, meeting)
    assert res.status_code == 403 and "locked" in res.json()["detail"]


def test_waiting_room_admit_and_remove(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    _settings(client, code, host, waiting_room=True)
    first = _guest(client, meeting, "First").json()
    second = _guest(client, meeting, "Second").json()
    assert first["status"] == "waiting"

    host_view = _state(client, code, host)
    assert {p["display_name"] for p in host_view["waiting"]} == {"First", "Second"}
    assert [p["id"] for p in host_view["participants"]] == [host["id"]]

    waiting_view = _state(client, code, first)
    assert waiting_view["participants"] == [] and waiting_view["messages"] == []

    _host_action(client, f"/api/participants/{first['id']}/admit", host)
    _host_action(client, f"/api/participants/{second['id']}/remove", host)
    host_view = _state(client, code, host)
    assert host_view["waiting"] == []
    assert len(host_view["participants"]) == 2


def test_turning_off_waiting_room_admits_everyone(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    _settings(client, code, host, waiting_room=True)
    guest = _guest(client, meeting).json()
    _settings(client, code, host, waiting_room=False)
    assert _state(client, code, guest)["me"]["status"] == "in_meeting"


def test_suspend_activities(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()
    settings = _host_action(client, f"/api/meetings/{code}/suspend", host).json()
    assert settings["is_locked"] is True and settings["allow_chat"] is False
    me = _state(client, code, guest)["me"]
    assert me["is_muted"] is True and me["is_video_on"] is False


def test_make_host_and_auto_host(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()
    other = _guest(client, meeting, "Other").json()

    assert _host_action(client, f"/api/participants/{guest['id']}/make-host", host).json()["role"] == "host"
    assert _host_action(client, f"/api/meetings/{code}/mute-all", host).status_code == 403

    client.post(f"/api/participants/{guest['id']}/leave", headers=pt(guest))
    hosts = [p["display_name"] for p in _state(client, code, other)["participants"] if p["role"] == "host"]
    assert hosts == ["Alex Johnson"]


def test_notes_are_private_and_saved(client, auth, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    guest = _guest(client, meeting).json()
    url = f"/api/meetings/{code}/notes"

    client.put(url, json={"participant_id": host["id"], "content": "Host notes"}, headers=pt(host))
    client.put(url, json={"participant_id": guest["id"], "content": "Guest notes"}, headers=pt(guest))
    client.put(url, json={"participant_id": host["id"], "content": "Host notes v2"}, headers=pt(host))

    assert client.get(url, params={"participant_id": host["id"]}, headers=pt(host)).json()["content"] == "Host notes v2"
    assert client.get(url, params={"participant_id": guest["id"]}, headers=pt(guest)).json()["content"] == "Guest notes"
    # Reading someone else's notes needs their key.
    assert client.get(url, params={"participant_id": host["id"]}, headers=pt(guest)).status_code == 403
    assert client.get(f"{url}/mine", headers=auth).json()["content"] == "Host notes v2"


def test_rejoining_from_same_tab_replaces_old_entry(client, auth):
    meeting = client.post("/api/meetings/instant", headers=auth).json()
    code = meeting["meeting_code"]
    host = client.post(
        f"/api/meetings/{code}/join", json={"display_name": "Alex Johnson", "client_id": "tab-a"}, headers=auth
    ).json()
    guest = _guest(client, meeting, client_id="tab-b").json()
    _host_action(client, f"/api/participants/{guest['id']}/make-host", host)

    again = _guest(client, meeting, client_id="tab-b").json()
    assert again["role"] == "host"
    names = sorted(p["display_name"] for p in _state(client, code, again)["participants"])
    assert names == ["Alex Johnson", "Guest"]


def test_admitted_person_skips_waiting_room_on_rejoin(client, start_instant):
    meeting, host = start_instant()
    code = meeting["meeting_code"]
    _settings(client, code, host, waiting_room=True)
    first = _guest(client, meeting, "G", client_id="tab-c").json()
    _host_action(client, f"/api/participants/{first['id']}/admit", host)
    again = _guest(client, meeting, "G", client_id="tab-c").json()
    assert again["status"] == "in_meeting"


def test_sample_meetings_refill_when_none_are_left(client, auth):
    from app.database import SessionLocal
    from app.models import Meeting, MeetingStatus, User
    from app.seed import DEFAULT_USER_EMAIL

    # Pretend the sample dates have passed: end every upcoming meeting of the demo user.
    with SessionLocal() as db:
        demo = db.query(User).filter(User.email == DEFAULT_USER_EMAIL).one()
        for m in db.query(Meeting).filter(Meeting.host_id == demo.id, Meeting.status != MeetingStatus.ended):
            m.status = MeetingStatus.ended
        db.commit()

    upcoming = client.get("/api/meetings/upcoming", headers=auth).json()
    assert "Daily Standup" in [m["title"] for m in upcoming]

    # Not empty any more, so deleting one does not bring it straight back.
    standup = next(m for m in upcoming if m["title"] == "Daily Standup")
    assert client.delete(f"/api/meetings/{standup['meeting_code']}", headers=auth).status_code == 204
    titles = [m["title"] for m in client.get("/api/meetings/upcoming", headers=auth).json()]
    assert "Daily Standup" not in titles and titles


def test_search_meetings(client, auth):
    found = client.get("/api/meetings/search", params={"q": "sprint"}, headers=auth).json()
    assert found and {m["title"] for m in found} == {"Sprint Planning"}
    code = found[0]["meeting_code"]
    spaced = f"{code[:3]} {code[3:6]} {code[6:]}"  # people paste IDs with spaces
    assert [m["meeting_code"] for m in client.get("/api/meetings/search", params={"q": spaced}, headers=auth).json()] == [code]
    assert client.get("/api/meetings/search", params={"q": "zzz-nothing"}, headers=auth).json() == []
    assert client.get("/api/meetings/search", params={"q": " "}, headers=auth).json() == []
    assert client.get("/api/meetings/search", params={"q": "sprint"}).status_code == 401


# ---------- WebRTC signalling and screen sharing ----------


def test_signals_are_delivered_once(client, start_instant):
    meeting, host = start_instant()
    guest = _guest(client, meeting, "Gina").json()
    offer = {"type": "offer", "session": "abc", "sdp": "v=0..."}
    res = client.post(f"/api/participants/{host['id']}/signals", json={"to": guest["id"], "data": offer}, headers=pt(host))
    assert res.status_code == 204

    got = client.get(f"/api/participants/{guest['id']}/signals", headers=pt(guest)).json()
    assert got == [{"id": got[0]["id"], "from_id": host["id"], "data": offer}]
    # Handed over once, then gone.
    assert client.get(f"/api/participants/{guest['id']}/signals", headers=pt(guest)).json() == []


def test_signals_need_the_right_key_and_meeting(client, start_instant):
    meeting, host = start_instant()
    guest = _guest(client, meeting, "Gus").json()
    other_meeting, other_host = start_instant()
    data = {"type": "offer"}
    # Someone else's key can't read your notes or send as you.
    assert client.get(f"/api/participants/{guest['id']}/signals", headers=pt(host)).status_code == 403
    assert client.post(f"/api/participants/{guest['id']}/signals", json={"to": host["id"], "data": data}, headers=pt(host)).status_code == 403
    # Only to people in the same meeting, and not to yourself.
    assert client.post(f"/api/participants/{host['id']}/signals", json={"to": other_host["id"], "data": data}, headers=pt(host)).status_code == 400
    assert client.post(f"/api/participants/{host['id']}/signals", json={"to": host["id"], "data": data}, headers=pt(host)).status_code == 400
    # Size cap.
    big = {"sdp": "x" * 70_000}
    assert client.post(f"/api/participants/{host['id']}/signals", json={"to": guest["id"], "data": big}, headers=pt(host)).status_code == 422


def test_screen_share_flag_follows_host_rules(client, start_instant):
    meeting, host = start_instant()
    guest = _guest(client, meeting, "Sam").json()
    code = meeting["meeting_code"]
    on = {"is_sharing_screen": True}
    assert client.patch(f"/api/participants/{guest['id']}", json=on, headers=pt(guest)).json()["is_sharing_screen"] is True

    # The host turns screen sharing off: the guest stops sharing and can't start again.
    client.patch(f"/api/meetings/{code}/settings", json={"requester_id": host["id"], "allow_screen_share": False}, headers=pt(host))
    people = {p["id"]: p for p in _state(client, code, guest)["participants"]}
    assert people[guest["id"]]["is_sharing_screen"] is False
    assert client.patch(f"/api/participants/{guest['id']}", json=on, headers=pt(guest)).status_code == 403
    # The host can still share.
    assert client.patch(f"/api/participants/{host['id']}", json=on, headers=pt(host)).json()["is_sharing_screen"] is True

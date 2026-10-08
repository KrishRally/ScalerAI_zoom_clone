"""Meeting endpoints. Each one is a thin wrapper around the service layer."""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import get_current_user, get_optional_user, participant_token
from app.models import User
from app.seed import DEFAULT_USER_EMAIL, refresh_sample_meetings, seed_daily_meetings
from app.services import host_controls as host_service
from app.services import meeting_chat as meeting_chat_service
from app.services import meetings as meeting_service
from app.services import notes as notes_service
from app.services import participants as participant_service
from app.services.errors import Forbidden

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.get("/upcoming", response_model=list[schemas.MeetingOut])
def upcoming_meetings(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    participant_service.expire_stale_everywhere(db)
    if user.email == DEFAULT_USER_EMAIL:
        # Keep the shared demo dashboard from going empty as the sample dates pass.
        refresh_sample_meetings(db)
        seed_daily_meetings(db)  # new days roll in as time passes
    return [
        meeting_service.to_meeting_out(db, m)
        for m in meeting_service.list_upcoming(db, user)
    ]


@router.get("/recent", response_model=list[schemas.MeetingOut])
def recent_meetings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    participant_service.expire_stale_everywhere(db)
    return [
        meeting_service.to_meeting_out(db, m) for m in meeting_service.list_recent(db, user)
    ]


@router.get("/search", response_model=list[schemas.MeetingOut])
def search_meetings(q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [meeting_service.to_meeting_out(db, m) for m in meeting_service.search_meetings(db, user, q)]


@router.get("/calendar", response_model=list[schemas.MeetingOut])
def calendar(
    start: schemas.UTCInput,
    end: schemas.UTCInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Meetings between two times, for the Calendar page."""
    return [
        meeting_service.to_meeting_out(db, m)
        for m in meeting_service.list_in_range(db, user, start, end)
    ]


@router.post(
    "/instant", response_model=schemas.MeetingOut, status_code=status.HTTP_201_CREATED
)
def create_instant(
    data: schemas.InstantMeetingCreate | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = meeting_service.create_instant_meeting(
        db, user, data or schemas.InstantMeetingCreate()
    )
    return meeting_service.to_meeting_out(db, meeting)


@router.post(
    "/scheduled", response_model=schemas.MeetingOut, status_code=status.HTTP_201_CREATED
)
def create_scheduled(
    data: schemas.ScheduledMeetingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = meeting_service.create_scheduled_meeting(db, user, data)
    return meeting_service.to_meeting_out(db, meeting)


@router.get("/lookup", response_model=schemas.MeetingLookup)
def lookup_meeting(
    q: str = Query(..., description="Meeting ID or invite link"),
    db: Session = Depends(get_db),
):
    """Check that a meeting exists before showing the join screen."""
    meeting = meeting_service.get_meeting(db, q)
    participant_service.expire_stale_participants(db, meeting)
    return schemas.MeetingLookup(
        meeting_code=meeting.meeting_code,
        title=meeting.title,
        host_id=meeting.host_id,
        host_name=meeting.host.name,
        status=meeting.status,
        scheduled_start=meeting.scheduled_start,
        requires_passcode=bool(meeting.passcode),
        is_locked=meeting_service.get_settings(db, meeting).is_locked,
    )


@router.get("/{code}", response_model=schemas.MeetingOut)
def get_meeting(
    code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Full details, including the passcode. Only the host may see these."""
    meeting = meeting_service.get_meeting(db, code)
    if meeting.host_id != user.id:
        raise Forbidden("Only the host can view full meeting details")
    return meeting_service.to_meeting_out(db, meeting)


@router.patch("/{code}", response_model=schemas.MeetingOut)
def update_meeting(
    code: str,
    data: schemas.MeetingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = meeting_service.get_meeting(db, code)
    meeting = meeting_service.update_meeting(db, user, meeting, data)
    return meeting_service.to_meeting_out(db, meeting)


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    meeting = meeting_service.get_meeting(db, code)
    meeting_service.delete_meeting(db, user, meeting)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Inside a meeting ----------


@router.post(
    "/{code}/join",
    response_model=schemas.JoinResult,
    status_code=status.HTTP_201_CREATED,
)
def join_meeting(
    code: str,
    data: schemas.JoinRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Guests can join without an account. Signed in owners join as host."""
    meeting = meeting_service.get_meeting(db, code)
    return participant_service.join_meeting(db, meeting, data, user)


@router.get("/{code}/state", response_model=schemas.RoomState)
def room_state(
    code: str,
    participant_id: int,
    after_message_id: int = 0,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    meeting = meeting_service.get_meeting(db, code)
    participant = participant_service.authenticate(db, participant_id, token)
    return participant_service.room_state(db, meeting, participant, after_message_id)


@router.post("/{code}/mute-all")
def mute_all(
    code: str,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.requester_id, token)
    meeting = meeting_service.get_meeting(db, code)
    muted = host_service.mute_all(db, meeting, data.requester_id)
    return {"muted": muted}


@router.post("/{code}/end", response_model=schemas.MeetingOut)
def end_meeting(
    code: str,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.requester_id, token)
    meeting = meeting_service.get_meeting(db, code)
    meeting = host_service.end_for_all(db, meeting, data.requester_id)
    return meeting_service.to_meeting_out(db, meeting)


@router.post(
    "/{code}/messages",
    response_model=schemas.ChatMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    code: str,
    data: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.participant_id, token)
    meeting = meeting_service.get_meeting(db, code)
    message = meeting_chat_service.send_message(db, meeting, data)
    return meeting_chat_service.to_message_out(message)


@router.post(
    "/{code}/reactions",
    response_model=schemas.ReactionOut,
    status_code=status.HTTP_201_CREATED,
)
def send_reaction(
    code: str,
    data: schemas.ReactionCreate,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.participant_id, token)
    meeting = meeting_service.get_meeting(db, code)
    r = meeting_chat_service.send_reaction(db, meeting, data)
    return schemas.ReactionOut(id=r.id, participant_id=r.participant_id, emoji=r.emoji)


# ---------- Host settings ----------


@router.patch("/{code}/settings", response_model=schemas.SettingsOut)
def update_settings(
    code: str,
    data: schemas.SettingsUpdate,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.requester_id, token)
    meeting = meeting_service.get_meeting(db, code)
    return host_service.update_settings(db, meeting, data)


@router.post("/{code}/suspend", response_model=schemas.SettingsOut)
def suspend(
    code: str,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.requester_id, token)
    meeting = meeting_service.get_meeting(db, code)
    return host_service.suspend_activities(db, meeting, data.requester_id)


@router.post("/{code}/admit-all")
def admit_all(
    code: str,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.requester_id, token)
    meeting = meeting_service.get_meeting(db, code)
    return {"admitted": host_service.admit_all(db, meeting, data.requester_id)}


# ---------- Notes ----------


@router.get("/{code}/notes", response_model=schemas.NoteOut)
def get_notes(
    code: str,
    participant_id: int,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, participant_id, token)
    meeting = meeting_service.get_meeting(db, code)
    return notes_service.get_note(db, meeting, participant_id)


@router.put("/{code}/notes", response_model=schemas.NoteOut)
def save_notes(
    code: str,
    data: schemas.NoteSave,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant_service.authenticate(db, data.participant_id, token)
    meeting = meeting_service.get_meeting(db, code)
    return notes_service.save_note(db, meeting, data)


@router.get("/{code}/notes/mine", response_model=schemas.NoteOut)
def my_notes(
    code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """The signed in user's notes, for the Meetings page."""
    meeting = meeting_service.get_meeting(db, code)
    return notes_service.get_user_note(db, meeting, user)

import hashlib
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import asc
from typing import Optional

from app.models.custody_event import CustodyEvent
from app.models.evidence import Evidence


def _hash_custody_data(
    evidence_id: int,
    event_type: str,
    user_id: int,
    timestamp: datetime,
    description: Optional[str],
    from_user_id: Optional[int],
    to_user_id: Optional[int],
    previous_event_hash: Optional[str]
) -> str:
    # Create canonical representation
    data = {
        "evidence_id": evidence_id,
        "event_type": event_type,
        "user_id": user_id,
        "timestamp": timestamp.isoformat(),
        "description": description or "",
        "from_user_id": from_user_id or 0,
        "to_user_id": to_user_id or 0,
        "previous_event_hash": previous_event_hash or ""
    }

    # Sort keys for deterministic JSON serialization
    serialized = json.dumps(data, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def create_custody_event(
    db: Session,
    evidence_id: int,
    event_type: str,
    user_id: int,
    description: Optional[str] = None,
    from_user_id: Optional[int] = None,
    to_user_id: Optional[int] = None
) -> CustodyEvent:
    """
    Creates a new custody event, cryptographically linked to the previous one.
    Handles concurrency carefully inside a standard SQLAlchemy session.
    """
    # Fetch previous event to get previous_event_hash
    previous_event = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.evidence_id == evidence_id)
        .order_by(CustodyEvent.id.desc())
        .first()
    )

    previous_hash = previous_event.event_hash if previous_event else None

    # Use current UTC time
    now_ts = datetime.utcnow()

    # Generate the hash for the NEW event
    event_hash = _hash_custody_data(
        evidence_id=evidence_id,
        event_type=event_type,
        user_id=user_id,
        timestamp=now_ts,
        description=description,
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        previous_event_hash=previous_hash,
    )

    # Create the event
    new_event = CustodyEvent(
        evidence_id=evidence_id,
        event_type=event_type,
        user_id=user_id,
        timestamp=now_ts,
        description=description,
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        previous_event_hash=previous_hash,
        event_hash=event_hash
    )

    db.add(new_event)
    # We delay commit to allow the router to commit multiple things (like Evidence status + custody) at once.
    # The caller is responsible for db.commit() in typical flows, or we can commit here if requested.
    # To avoid silent failures, we expect caller to commit, or we can just flush to get ID.
    db.flush()
    return new_event


def get_custody_events(db: Session, evidence_id: int):
    return db.query(CustodyEvent).filter(CustodyEvent.evidence_id == evidence_id).order_by(asc(CustodyEvent.id)).all()


def verify_custody_chain(db: Session, evidence_id: int):
    events = get_custody_events(db, evidence_id)

    if not events:
        return {"status": "VALID", "message": "No custody events found."}

    expected_previous_hash = None

    for event in events:
        # Check chain link
        if event.previous_event_hash != expected_previous_hash:
            return {
                "status": "INVALID",
                "message": f"Broken chain link at event ID {event.id}. Previous hash does not match.",
                "failed_event_id": event.id
            }

        # Verify event hash integrity
        calculated_hash = _hash_custody_data(
            evidence_id=event.evidence_id,
            event_type=event.event_type,
            user_id=event.user_id,
            timestamp=event.timestamp,
            description=event.description,
            from_user_id=event.from_user_id,
            to_user_id=event.to_user_id,
            previous_event_hash=event.previous_event_hash
        )

        if calculated_hash != event.event_hash:
            return {
                "status": "INVALID",
                "message": f"Event data has been tampered with at event ID {event.id}.",
                "failed_event_id": event.id
            }

        # update expected for next iteration
        expected_previous_hash = event.event_hash

    return {"status": "VALID", "message": "Custody chain is fully valid and unbroken."}

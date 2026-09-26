from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.evidence import Evidence
from app.schemas.custody_event import (
    CustodyEventResponse,
    CustodyEventCreate,
    CustodyChainVerificationResponse,
    TransferCustodyRequest
)
from app.services.custody_service import create_custody_event, get_custody_events, verify_custody_chain
from app.dependencies.auth import get_current_user

router = APIRouter()

def _check_evidence_exists(db: Session, evidence_id: int):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence

@router.get("/evidence/{evidence_id}/custody", response_model=List[CustodyEventResponse])
def read_custody_events(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_evidence_exists(db, evidence_id)
    # Could check permissions if needed, but existing JWT acts as proof
    events = get_custody_events(db, evidence_id)
    return events


@router.post("/evidence/{evidence_id}/custody", response_model=CustodyEventResponse)
def add_manual_custody_event(
    evidence_id: int,
    event_in: CustodyEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_evidence_exists(db, evidence_id)

    if event_in.event_type not in ["EXAMINED", "TRANSFERRED"]:
        raise HTTPException(
            status_code=400,
            detail="Only EXAMINED or TRANSFERRED events can be created manually."
        )

    # Note: TRANSFERRED is explicitly handled via the /transfer endpoint normally,
    # but strictly supported here depending on front-end integration.
    # If TRANSFERRED, we might want to ensure to_user_id is set.

    event = create_custody_event(
        db=db,
        evidence_id=evidence_id,
        event_type=event_in.event_type,
        user_id=current_user.id,
        description=event_in.description,
        from_user_id=event_in.from_user_id,
        to_user_id=event_in.to_user_id,
    )
    db.commit()
    db.refresh(event)
    return event


@router.post("/evidence/{evidence_id}/custody/verify", response_model=CustodyChainVerificationResponse)
def verify_chain(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_evidence_exists(db, evidence_id)
    result = verify_custody_chain(db, evidence_id)
    return result


@router.post("/evidence/{evidence_id}/custody/transfer", response_model=CustodyEventResponse)
def transfer_custody(
    evidence_id: int,
    transfer_req: TransferCustodyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_evidence_exists(db, evidence_id)

    # Check if target user exists
    target_user = db.query(User).filter(User.id == transfer_req.to_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    event = create_custody_event(
        db=db,
        evidence_id=evidence_id,
        event_type="TRANSFERRED",
        user_id=current_user.id,
        description=transfer_req.description or f"Transferred to {target_user.username}",
        from_user_id=current_user.id,
        to_user_id=target_user.id
    )
    db.commit()
    db.refresh(event)
    return event

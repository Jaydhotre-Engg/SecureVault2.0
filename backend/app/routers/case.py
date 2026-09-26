from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.case import Case
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceResponse
from app.models.user import User
from app.schemas.case import (
    CaseCreate,
    CaseUpdate,
    CaseResponse
)
from app.dependencies.auth import get_current_user
from app.services.audit_service import log_audit


router = APIRouter()


def generate_case_number(db: Session) -> str:
    """
    Generate the next human-readable case number.

    Example:
    CASE-2026-001
    CASE-2026-002
    """

    from datetime import datetime

    year = datetime.utcnow().year

    prefix = f"CASE-{year}-"

    last_case = (
        db.query(Case)
        .filter(Case.case_number.like(f"{prefix}%"))
        .order_by(Case.id.desc())
        .first()
    )

    if not last_case:
        sequence = 1
    else:
        try:
            sequence = int(
                last_case.case_number.split("-")[-1]
            ) + 1
        except (ValueError, IndexError):
            sequence = last_case.id + 1

    return f"{prefix}{sequence:03d}"


@router.post(
    "",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED
)
def create_case(
    case_data: CaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new forensic case.

    Both ADMIN and INVESTIGATOR users can create cases.
    """

    case_number = generate_case_number(db)

    new_case = Case(
        case_number=case_number,
        case_name=case_data.case_name.strip(),
        description=case_data.description,
        status="OPEN",
        created_by=current_user.id
    )

    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    client_ip = request.client.host if request.client else None

    log_audit(
        db=db,
        action="CASE_CREATED",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="case",
        resource_id=new_case.id,
        detail=(
            f"Created case '{new_case.case_name}' "
            f"({new_case.case_number})"
        ),
        ip_address=client_ip
    )

    return new_case


@router.get(
    "",
    response_model=List[CaseResponse]
)
def list_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List cases.

    ADMIN:
        Can see all cases.

    INVESTIGATOR:
        Can see all cases available for collaborative forensic work.
    """

    if current_user.role in ("ADMIN", "INVESTIGATOR"):
        return (
            db.query(Case)
            .order_by(Case.id.desc())
            .all()
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions for this resource"
    )


@router.get(
    "/{case_id}",
    response_model=CaseResponse
)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    if (
        current_user.role != "ADMIN"
        and case.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return case


@router.patch(
    "/{case_id}",
    response_model=CaseResponse
)
def update_case(
    case_id: int,
    case_data: CaseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    if (
        current_user.role != "ADMIN"
        and case.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    if case_data.case_name is not None:
        case.case_name = case_data.case_name.strip()

    if case_data.description is not None:
        case.description = case_data.description

    if case_data.status is not None:
        case.status = case_data.status

    db.commit()
    db.refresh(case)

    client_ip = request.client.host if request.client else None

    log_audit(
        db=db,
        action="CASE_UPDATED",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="case",
        resource_id=case.id,
        detail=(
            f"Updated case '{case.case_name}' "
            f"({case.case_number})"
        ),
        ip_address=client_ip
    )

    return case
@router.get(
    "/{case_id}/evidence",
    response_model=List[EvidenceResponse]
)
def get_case_evidence(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    if (
        current_user.role != "ADMIN"
        and case.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    evidence_items = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id)
        .order_by(Evidence.id.desc())
        .all()
    )

    return evidence_items

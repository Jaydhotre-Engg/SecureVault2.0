from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.case_access import CaseAccess
from app.models.user import User

def can_access_case(db: Session, user: User, case_id: int) -> bool:
    """
    Centralized case access control:
    - ADMIN: Unrestricted
    - Case Creator: Always authorized
    - Explicit Access Grant: ACTIVE record exists
    """
    if user.role == "ADMIN":
        return True

    # Check if case exists and matches owner
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return False

    if case.created_by == user.id:
        return True

    # Check CaseAccess grant
    access = db.query(CaseAccess).filter(
        CaseAccess.case_id == case_id,
        CaseAccess.user_id == user.id,
        CaseAccess.status == "ACTIVE"
    ).first()

    return access is not None

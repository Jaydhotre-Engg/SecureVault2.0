from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.user import UserResponse
from app.schemas.audit_log import AuditLogResponse
from app.dependencies.auth import require_role, get_current_user
from app.services.audit_service import log_audit

router = APIRouter()


@router.get(
    "",
    response_model=List[UserResponse],
    summary="List all users"
)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all users in the system."""
    return db.query(User).order_by(User.id).all()


@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    summary="Retrieve system audit logs (Admin only)"
)
def get_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN"))
):
    """Retrieve audit log records for security and compliance reviews."""
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user details by ID (Admin only)"
)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN"))
):
    """Retrieve specific user details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.patch(
    "/{user_id}/deactivate",
    response_model=UserResponse,
    summary="Deactivate a user account (Admin only)"
)
def deactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN"))
):
    """
    Deactivate a user account.

    Security Rule:
    - Protects against deactivating the only active ADMIN account.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if target is ADMIN and if it's the last active ADMIN
    if user.role == "ADMIN":
        active_admins_count = db.query(User).filter(
            User.role == "ADMIN",
            User.is_active == True
        ).count()
        if active_admins_count <= 1 and user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the only active ADMIN account."
            )

    user.is_active = False
    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        action="USER_DEACTIVATED",
        user_id=admin_user.id,
        username=admin_user.username,
        resource_type="user",
        resource_id=user.id,
        detail=f"User '{user.username}' (ID={user.id}) was deactivated by ADMIN '{admin_user.username}'",
        ip_address=client_ip
    )

    return user


@router.patch(
    "/{user_id}/reactivate",
    response_model=UserResponse,
    summary="Reactivate a user account (Admin only)"
)
def reactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN"))
):
    """Reactivate a previously deactivated user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_active = True
    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        action="USER_REACTIVATED",
        user_id=admin_user.id,
        username=admin_user.username,
        resource_type="user",
        resource_id=user.id,
        detail=f"User '{user.username}' (ID={user.id}) was reactivated by ADMIN '{admin_user.username}'",
        ip_address=client_ip
    )

    return user

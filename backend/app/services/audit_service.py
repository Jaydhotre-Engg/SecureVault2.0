import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger("securevault.audit")


def log_audit(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    detail: Optional[str] = None,
    ip_address: Optional[str] = None
) -> Optional[AuditLog]:
    """
    Record a security audit log event safely.

    Exceptions are caught and logged to system logger to prevent audit failures
    from breaking or corrupting core cryptographic/database operations.
    """
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record audit log: {action} - {e}")
        return None

from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class CaseAccess(Base):
    __tablename__ = "case_access"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default="ACTIVE", nullable=False) # ACTIVE, REVOKED

    __table_args__ = (
        UniqueConstraint("case_id", "user_id", name="uq_case_user_access"),
    )

    # Relationships
    case = relationship("Case")
    user = relationship("User", foreign_keys=[user_id])
    granter = relationship("User", foreign_keys=[granted_by])

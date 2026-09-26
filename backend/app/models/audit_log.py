from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime

from app.database import Base


class AuditLog(Base):

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, nullable=True)

    username = Column(String(50), nullable=True)

    action = Column(String(50), nullable=False)

    resource_type = Column(String(50), nullable=True)

    resource_id = Column(Integer, nullable=True)

    detail = Column(Text, nullable=True)

    ip_address = Column(String(45), nullable=True)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

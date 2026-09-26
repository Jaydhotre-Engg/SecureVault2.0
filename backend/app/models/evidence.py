from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Evidence(Base):

    __tablename__ = "evidence"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Case association
    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=True,
        index=True
    )

    filename = Column(
        String,
        nullable=False
    )

    file_hash = Column(
        String,
        nullable=False,
        index=True
    )

    file_size = Column(
        Integer,
        nullable=False
    )

    storage_path = Column(
        String,
        nullable=False
    )

    blockchain_tx = Column(
        String,
        nullable=True
    )

    ipfs_cid = Column(
        String,
        nullable=True
    )

    verification_status = Column(
        String,
        default="PENDING"
    )

    uploaded_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationship with Case
    case = relationship(
        "Case",
        back_populates="evidence"
    )

    # Relationship with Custody Events
    custody_events = relationship(
        "CustodyEvent",
        back_populates="evidence",
        order_by="CustodyEvent.id"
    )
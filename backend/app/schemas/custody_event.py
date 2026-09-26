from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class CustodyEventBase(BaseModel):
    event_type: str
    description: Optional[str] = None
    from_user_id: Optional[int] = None
    to_user_id: Optional[int] = None

class CustodyEventCreate(CustodyEventBase):
    pass

class CustodyEventResponse(CustodyEventBase):
    id: int
    evidence_id: int
    user_id: int
    timestamp: datetime
    previous_event_hash: Optional[str] = None
    event_hash: str

    class Config:
        from_attributes = True

class CustodyChainVerificationResponse(BaseModel):
    status: str
    message: str
    failed_event_id: Optional[int] = None

class TransferCustodyRequest(BaseModel):
    to_user_id: int
    description: Optional[str] = None

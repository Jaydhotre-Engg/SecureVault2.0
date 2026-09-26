from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None = None
    username: str | None = None
    action: str
    resource_type: str | None = None
    resource_id: int | None = None
    detail: str | None = None
    ip_address: str | None = None
    timestamp: datetime

    class Config:
        from_attributes = True

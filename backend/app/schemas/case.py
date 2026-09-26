from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CaseCreate(BaseModel):
    case_name: str
    description: str | None = None


class CaseUpdate(BaseModel):
    case_name: str | None = None
    description: str | None = None
    status: str | None = None


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_number: str
    case_name: str
    description: str | None
    status: str
    created_by: int
    created_at: datetime
    updated_at: datetime

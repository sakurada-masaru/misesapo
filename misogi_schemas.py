from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, root_validator, validator

from misogi_flags import FlagOrigin, FlagState


class Decision(BaseModel):
    decided_by: str = Field(..., min_length=1)
    decided_at: str

    @validator("decided_at")
    def validate_decided_at(cls, value):
        try:
            if value.endswith("Z"):
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            else:
                datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("decided_at must be ISO8601") from exc
        return value


class SuggestFlagRequest(BaseModel):
    type: str = Field(..., min_length=1)
    origin: FlagOrigin
    severity: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class PatchFlagRequest(BaseModel):
    state: FlagState
    decision: Optional[Decision] = None

    @root_validator(skip_on_failure=True)
    def validate_decision_required(cls, values):
        state = values.get("state")
        decision = values.get("decision")
        if state and state != FlagState.OPEN and decision is None:
            raise ValueError("decision is required when state is not open")
        return values


class MisogiFlag(BaseModel):
    report_id: str
    flag_id: str
    type: str
    origin: FlagOrigin
    severity: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    state: FlagState
    decision: Optional[Decision] = None
    created_at: str
    updated_at: str

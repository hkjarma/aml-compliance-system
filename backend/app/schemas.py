from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class Transaction(BaseModel):
    id: str
    account_id: str
    amount: float = Field(..., gt=0)
    currency: str = "USD"
    direction: Literal["inbound", "outbound"]
    counterparty: str
    country: str
    timestamp: str
    channel: Literal["wire", "cash", "card", "crypto", "atm"]
    risk_tags: List[str] = []


class Alert(BaseModel):
    alert_id: str
    account_id: str
    transaction_id: str
    score: float
    severity: Literal["low", "medium", "high", "critical"]
    reasons: List[str]
    status: Literal["open", "investigating", "closed"] = "open"


class CaseRecord(BaseModel):
    case_id: str
    account_id: str
    status: Literal["open", "pending", "closed"] = "open"
    alert_ids: List[str]
    analyst: Optional[str] = None
    summary: str


class RiskSummary(BaseModel):
    total_transactions: int
    alerts_count: int
    high_risk_count: int
    average_score: float
    top_risk_accounts: List[str]

from __future__ import annotations

import os
from typing import Dict, List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.aml_engine import AMLRiskEngine
from app.auth import API_KEYS, get_current_user, require_roles
from app.database import get_db, init_db
from app.models import (
    AlertModel,
    CaseModel,
    CaseNoteModel,
    CustomerKycModel,
    SanctionEntityModel,
    TransactionModel,
)

app = FastAPI(title="AML Compliance API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = AMLRiskEngine()


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    seed_default_data()


class Transaction(BaseModel):
    id: str
    account_id: str
    amount: float = Field(..., gt=0)
    currency: str = "USD"
    direction: str
    counterparty: str
    country: str
    timestamp: str
    channel: str
    risk_tags: List[str] = []


class Alert(BaseModel):
    alert_id: str
    account_id: str
    transaction_id: str
    score: float
    severity: str
    reasons: List[str]
    status: str = "open"


class CaseRecord(BaseModel):
    case_id: str
    account_id: str
    status: str = "open"
    alert_ids: List[str] = []
    analyst: str | None = None
    summary: str
    priority: str = "medium"
    age: str = "0m"


class CaseNote(BaseModel):
    id: int
    case_id: str
    note: str
    author: str
    created_at: str


class CaseNoteCreate(BaseModel):
    note: str
    author: str = "analyst"


class CaseStatusUpdate(BaseModel):
    status: str | None = None
    analyst: str | None = None
    summary: str | None = None
    priority: str | None = None
    age: str | None = None


class SanctionEntity(BaseModel):
    id: int
    name: str
    aliases: List[str]
    country: str | None
    category: str


class SanctionCheckRequest(BaseModel):
    counterparty: str
    country: str | None = None


class SanctionCheckResult(BaseModel):
    screening_status: str
    risk_level: str
    matches: List[SanctionEntity]


class CustomerKyc(BaseModel):
    account_id: str
    customer_name: str
    status: str
    risk_rating: str
    country: str | None
    pep: bool
    beneficial_owners: List[str]
    last_reviewed: str | None


class AuthLoginRequest(BaseModel):
    api_key: str


class AuthUserResponse(BaseModel):
    user: str
    role: str
    permissions: List[str]


class RiskSummary(BaseModel):
    total_transactions: int
    alerts_count: int
    high_risk_count: int
    average_score: float
    top_risk_accounts: List[str]


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "aml-compliance-api"}


@app.get("/api/v1/auth/me", response_model=AuthUserResponse)
def get_me(user: Dict[str, str] = Depends(get_current_user)) -> AuthUserResponse:
    return AuthUserResponse(
        user=user["user"],
        role=user["role"],
        permissions=user["permissions"],
    )


@app.post("/api/v1/auth/login", response_model=AuthUserResponse)
def login(payload: AuthLoginRequest) -> AuthUserResponse:
    if payload.api_key not in API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")

    role = API_KEYS[payload.api_key]
    permissions = {
        "analyst": ["read:alerts", "read:cases", "read:customer_kyc", "read:sanctions"],
        "manager": ["read:alerts", "read:cases", "write:cases", "read:customer_kyc", "read:sanctions"],
        "admin": ["read:alerts", "read:cases", "write:cases", "read:customer_kyc", "read:sanctions", "write:controls"],
    }.get(role, [])

    return AuthUserResponse(user=role, role=role, permissions=permissions)


@app.get("/api/v1/risk/summary", response_model=RiskSummary)
def risk_summary(
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> RiskSummary:
    alerts = list_alerts(db)
    summary = engine.summarize_alerts([alert.model_dump() for alert in alerts])
    transactions = db.query(TransactionModel).all()
    return RiskSummary(
        total_transactions=len(transactions),
        alerts_count=summary["alerts_count"],
        high_risk_count=summary["high_risk_count"],
        average_score=summary["average_score"],
        top_risk_accounts=summary["top_risk_accounts"],
    )


@app.get("/api/v1/alerts", response_model=List[Alert])
def list_alerts(
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> List[Alert]:
    results = db.query(AlertModel).all()
    return [
        Alert(
            alert_id=item.alert_id,
            account_id=item.account_id,
            transaction_id=item.transaction_id,
            score=item.score,
            severity=item.severity,
            reasons=item.reasons,
            status=item.status,
        )
        for item in results
    ]


@app.get("/api/v1/cases", response_model=List[CaseRecord])
def list_cases(
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> List[CaseRecord]:
    results = db.query(CaseModel).all()
    return [
        CaseRecord(
            case_id=item.case_id,
            account_id=item.account_id,
            status=item.status,
            alert_ids=[],
            analyst=item.analyst,
            summary=item.summary,
            priority=item.priority,
            age=item.age,
        )
        for item in results
    ]


@app.get("/api/v1/cases/{case_id}/notes", response_model=List[CaseNote])
def get_case_notes(
    case_id: str,
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> List[CaseNote]:
    notes = (
        db.query(CaseNoteModel)
        .filter(CaseNoteModel.case_id == case_id)
        .order_by(CaseNoteModel.created_at.asc())
        .all()
    )
    return [
        CaseNote(
            id=item.id,
            case_id=item.case_id,
            note=item.note,
            author=item.author,
            created_at=item.created_at.isoformat() if item.created_at else "",
        )
        for item in notes
    ]


@app.post("/api/v1/cases/{case_id}/notes", response_model=CaseNote)
def add_case_note(
    case_id: str,
    payload: CaseNoteCreate,
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> CaseNote:
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    note = CaseNoteModel(case_id=case_id, note=payload.note, author=payload.author)
    db.add(note)
    db.commit()
    db.refresh(note)

    return CaseNote(
        id=note.id,
        case_id=note.case_id,
        note=note.note,
        author=note.author,
        created_at=note.created_at.isoformat() if note.created_at else "",
    )


@app.patch("/api/v1/cases/{case_id}", response_model=CaseRecord)
def update_case(
    case_id: str,
    payload: CaseStatusUpdate,
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("manager", "admin")),
) -> CaseRecord:
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if payload.status is not None:
        case.status = payload.status
    if payload.analyst is not None:
        case.analyst = payload.analyst
    if payload.summary is not None:
        case.summary = payload.summary
    if payload.priority is not None:
        case.priority = payload.priority
    if payload.age is not None:
        case.age = payload.age

    db.commit()
    db.refresh(case)

    return CaseRecord(
        case_id=case.case_id,
        account_id=case.account_id,
        status=case.status,
        alert_ids=[],
        analyst=case.analyst,
        summary=case.summary,
        priority=case.priority,
        age=case.age,
    )


@app.get("/api/v1/sanctions/watchlist", response_model=List[SanctionEntity])
def list_sanctions(
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> List[SanctionEntity]:
    entities = db.query(SanctionEntityModel).all()
    return [
        SanctionEntity(
            id=item.id,
            name=item.name,
            aliases=item.aliases or [],
            country=item.country,
            category=item.category,
        )
        for item in entities
    ]


@app.post("/api/v1/sanctions/check", response_model=SanctionCheckResult)
def check_sanctions(
    payload: SanctionCheckRequest,
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> SanctionCheckResult:
    query_name = (payload.counterparty or "").strip().lower()
    query_country = (payload.country or "").strip().upper()
    matches: List[SanctionEntity] = []

    for entity in db.query(SanctionEntityModel).all():
        candidate_names = {entity.name.lower(), *(name.lower() for name in (entity.aliases or []))}
        same_country = bool(query_country) and entity.country and entity.country.upper() == query_country
        if query_name and (query_name in candidate_names or any(query_name in name for name in candidate_names)):
            matches.append(
                SanctionEntity(
                    id=entity.id,
                    name=entity.name,
                    aliases=entity.aliases or [],
                    country=entity.country,
                    category=entity.category,
                )
            )
        elif same_country:
            matches.append(
                SanctionEntity(
                    id=entity.id,
                    name=entity.name,
                    aliases=entity.aliases or [],
                    country=entity.country,
                    category=entity.category,
                )
            )

    if matches:
        return SanctionCheckResult(screening_status="blocked", risk_level="high", matches=matches)
    return SanctionCheckResult(screening_status="clear", risk_level="low", matches=[])


@app.get("/api/v1/customers/{account_id}/kyc", response_model=CustomerKyc)
def get_customer_kyc(
    account_id: str,
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> CustomerKyc:
    profile = db.query(CustomerKycModel).filter(CustomerKycModel.account_id == account_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="KYC profile not found")

    return CustomerKyc(
        account_id=profile.account_id,
        customer_name=profile.customer_name,
        status=profile.status,
        risk_rating=profile.risk_rating,
        country=profile.country,
        pep=profile.pep,
        beneficial_owners=profile.beneficial_owners or [],
        last_reviewed=profile.last_reviewed,
    )


@app.post("/api/v1/transactions/analyze", response_model=Alert)
def analyze_transaction(
    payload: Transaction,
    db: Session = Depends(get_db),
    _user: Dict[str, str] = Depends(require_roles("analyst", "manager", "admin")),
) -> Alert:
    result = engine.evaluate_transaction(payload.model_dump())
    alert_id = f"alert-{payload.id}"

    existing = db.query(AlertModel).filter_by(alert_id=alert_id).first()
    if existing is None:
        db.add(
            AlertModel(
                alert_id=alert_id,
                account_id=payload.account_id,
                transaction_id=payload.id,
                score=result["score"],
                severity=result["severity"],
                reasons=result["reasons"],
                status="open",
            )
        )
        db.commit()

    return Alert(
        alert_id=alert_id,
        account_id=payload.account_id,
        transaction_id=payload.id,
        score=result["score"],
        severity=result["severity"],
        reasons=result["reasons"],
        status="open",
    )


def seed_default_data() -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        if db.query(TransactionModel).count() == 0:
            for tx in [
                {
                    "id": "txn-1001",
                    "account_id": "acct-01",
                    "amount": 22000,
                    "currency": "USD",
                    "direction": "outbound",
                    "counterparty": "Apex Logistics",
                    "country": "US",
                    "timestamp": "2026-10-04T09:15:00Z",
                    "channel": "wire",
                    "risk_tags": ["rapid_sequence"],
                },
                {
                    "id": "txn-1002",
                    "account_id": "acct-02",
                    "amount": 14000,
                    "currency": "USD",
                    "direction": "inbound",
                    "counterparty": "Blue Harbor",
                    "country": "RU",
                    "timestamp": "2026-10-04T10:30:00Z",
                    "channel": "cash",
                    "risk_tags": ["structuring"],
                },
                {
                    "id": "txn-1003",
                    "account_id": "acct-01",
                    "amount": 9000,
                    "currency": "USD",
                    "direction": "outbound",
                    "counterparty": "Northline Export",
                    "country": "US",
                    "timestamp": "2026-10-04T12:00:00Z",
                    "channel": "wire",
                    "risk_tags": [],
                },
                {
                    "id": "txn-1004",
                    "account_id": "acct-03",
                    "amount": 32000,
                    "currency": "USD",
                    "direction": "outbound",
                    "counterparty": "Flux Trading",
                    "country": "CN",
                    "timestamp": "2026-10-04T13:40:00Z",
                    "channel": "crypto",
                    "risk_tags": ["round_trip"],
                },
            ]:
                db.add(
                    TransactionModel(
                        id=tx["id"],
                        account_id=tx["account_id"],
                        amount=tx["amount"],
                        currency=tx["currency"],
                        direction=tx["direction"],
                        counterparty=tx["counterparty"],
                        country=tx["country"],
                        timestamp=tx["timestamp"],
                        channel=tx["channel"],
                        risk_tags=tx.get("risk_tags", []),
                    )
                )

        if db.query(CaseModel).count() == 0:
            db.add_all(
                [
                    CaseModel(
                        case_id="case-001",
                        account_id="acct-01",
                        status="open",
                        analyst="N. Patel",
                        summary="Large outbound series with rapid movement and potential structuring.",
                        priority="high",
                        age="1h 20m",
                    ),
                    CaseModel(
                        case_id="case-002",
                        account_id="acct-02",
                        status="pending",
                        analyst="M. Gomez",
                        summary="Cash-intensive inbound payment with a high-risk jurisdiction.",
                        priority="critical",
                        age="3h 05m",
                    ),
                ]
            )

        if db.query(AlertModel).count() == 0:
            default_alerts = [
                {
                    "alert_id": "alert-txn-1001",
                    "account_id": "acct-01",
                    "transaction_id": "txn-1001",
                    "score": 92.0,
                    "severity": "critical",
                    "reasons": ["Large outbound transfer", "High-risk settlement patterns"],
                    "status": "open",
                },
                {
                    "alert_id": "alert-txn-1002",
                    "account_id": "acct-02",
                    "transaction_id": "txn-1002",
                    "score": 76.0,
                    "severity": "high",
                    "reasons": ["Cash channel", "High-risk jurisdiction: RU"],
                    "status": "open",
                },
                {
                    "alert_id": "alert-txn-1004",
                    "account_id": "acct-03",
                    "transaction_id": "txn-1004",
                    "score": 81.0,
                    "severity": "high",
                    "reasons": ["Crypto channel", "Round-trip funds movement suspected"],
                    "status": "open",
                },
            ]
            db.add_all(
                [
                    AlertModel(
                        alert_id=item["alert_id"],
                        account_id=item["account_id"],
                        transaction_id=item["transaction_id"],
                        score=item["score"],
                        severity=item["severity"],
                        reasons=item["reasons"],
                        status=item["status"],
                    )
                    for item in default_alerts
                ]
            )

        if db.query(CaseNoteModel).count() == 0:
            db.add_all(
                [
                    CaseNoteModel(
                        case_id="case-001",
                        note="Analyst reviewed the account activity and flagged unusual outbound movement.",
                        author="N. Patel",
                    ),
                    CaseNoteModel(
                        case_id="case-002",
                        note="Cross-border transaction review requested due to high-risk jurisdiction exposure.",
                        author="M. Gomez",
                    ),
                ]
            )

        if db.query(SanctionEntityModel).count() == 0:
            db.add_all(
                [
                    SanctionEntityModel(
                        name="Blue Harbor",
                        aliases=["Blue Harbor Imports", "Blue Harbor Logistics"],
                        country="RU",
                        category="entity",
                    ),
                    SanctionEntityModel(
                        name="Flux Trading",
                        aliases=["Flux Holdings", "Flux Capital"],
                        country="CN",
                        category="entity",
                    ),
                    SanctionEntityModel(
                        name="Gulf Bell Ventures",
                        aliases=["Gulf Bell", "Bell Ventures"],
                        country="IR",
                        category="entity",
                    ),
                ]
            )

        if db.query(CustomerKycModel).count() == 0:
            db.add_all(
                [
                    CustomerKycModel(
                        account_id="acct-01",
                        customer_name="Apex Logistics",
                        status="review_pending",
                        risk_rating="high",
                        country="US",
                        pep=False,
                        beneficial_owners=["N. Patel"],
                        last_reviewed="2026-09-12",
                    ),
                    CustomerKycModel(
                        account_id="acct-02",
                        customer_name="Blue Harbor",
                        status="sanctions_review",
                        risk_rating="critical",
                        country="RU",
                        pep=False,
                        beneficial_owners=["M. Gomez"],
                        last_reviewed="2026-10-01",
                    ),
                    CustomerKycModel(
                        account_id="acct-03",
                        customer_name="Flux Trading",
                        status="enhanced_due_diligence",
                        risk_rating="high",
                        country="CN",
                        pep=False,
                        beneficial_owners=["H. Zhang"],
                        last_reviewed="2026-09-20",
                    ),
                ]
            )

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)


"""
Legacy static data access kept for a minimal compatibility path.
"""


# no-op: the app now persists data through SQLAlchemy-backed models.


"""
"""


"""""""


"""
"""


""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""""""


"""
"""


"""""""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""

"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""


"""""""


"""
"""

"""
"""
                
"""

"""
"""

"""
"""

"""
"""

"""
"""

"""
"""

"""
"""

"""
"""

"""
"""

"""
"""

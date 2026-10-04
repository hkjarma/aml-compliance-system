from __future__ import annotations

from typing import Any, Dict, List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.aml_engine import AMLRiskEngine
from app.database import get_db, init_db
from app.models import AlertModel, CaseModel, CaseNoteModel, TransactionModel

app = FastAPI(title="AML Compliance API", version="0.2.0")
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


class RiskSummary(BaseModel):
    total_transactions: int
    alerts_count: int
    high_risk_count: int
    average_score: float
    top_risk_accounts: List[str]


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "aml-compliance-api"}


@app.get("/api/v1/risk/summary", response_model=RiskSummary)
def risk_summary(db: Session = Depends(get_db)) -> RiskSummary:
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
def list_alerts(db: Session = Depends(get_db)) -> List[Alert]:
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
def list_cases(db: Session = Depends(get_db)) -> List[CaseRecord]:
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
def get_case_notes(case_id: str, db: Session = Depends(get_db)) -> List[CaseNote]:
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
def add_case_note(case_id: str, payload: CaseNoteCreate, db: Session = Depends(get_db)) -> CaseNote:
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
def update_case(case_id: str, payload: CaseStatusUpdate, db: Session = Depends(get_db)) -> CaseRecord:
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


@app.post("/api/v1/transactions/analyze", response_model=Alert)
def analyze_transaction(payload: Transaction, db: Session = Depends(get_db)) -> Alert:
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

        db.commit()
    finally:
        db.close()

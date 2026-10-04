from __future__ import annotations

from typing import Any, Dict, List

from fastapi import FastAPI

from app.aml_engine import AMLRiskEngine
from app.data_store import get_cases, get_transactions, set_alerts
from app.schemas import Alert, CaseRecord, RiskSummary, Transaction

app = FastAPI(title="AML Compliance API", version="0.1.0")
engine = AMLRiskEngine()


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "aml-compliance-api"}


@app.get("/api/v1/risk/summary", response_model=RiskSummary)
def risk_summary() -> RiskSummary:
    alerts = build_alerts(get_transactions())
    summary = engine.summarize_alerts(alerts)
    return RiskSummary(
        total_transactions=len(get_transactions()),
        alerts_count=summary["alerts_count"],
        high_risk_count=summary["high_risk_count"],
        average_score=summary["average_score"],
        top_risk_accounts=summary["top_risk_accounts"],
    )


@app.get("/api/v1/alerts", response_model=List[Alert])
def list_alerts() -> List[Alert]:
    return build_alerts(get_transactions())


@app.get("/api/v1/cases", response_model=List[CaseRecord])
def list_cases() -> List[CaseRecord]:
    return [
        CaseRecord(
            case_id=item["case_id"],
            account_id=item["account_id"],
            status=item["status"],
            alert_ids=item["alert_ids"],
            analyst=item["analyst"],
            summary=item["summary"],
        )
        for item in get_cases()
    ]


@app.post("/api/v1/transactions/analyze", response_model=Alert)
def analyze_transaction(tx: Transaction) -> Alert:
    result = engine.evaluate_transaction(tx.model_dump())
    return Alert(
        alert_id=f"alert-{tx.id}",
        account_id=tx.account_id,
        transaction_id=tx.id,
        score=result["score"],
        severity=result["severity"],
        reasons=result["reasons"],
    )


def build_alerts(transactions: List[Dict[str, Any]]) -> List[Alert]:
    alerts: List[Alert] = []
    for tx in transactions:
        result = engine.evaluate_transaction(tx)
        if result["alert"]:
            alerts.append(
                Alert(
                    alert_id=f"alert-{tx['id']}",
                    account_id=tx["account_id"],
                    transaction_id=tx["id"],
                    score=result["score"],
                    severity=result["severity"],
                    reasons=result["reasons"],
                )
            )
    set_alerts([item.model_dump() for item in alerts])
    return alerts

from __future__ import annotations

from typing import Any, Dict, List


TRANSACTIONS: List[Dict[str, Any]] = [
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
]

CASES: List[Dict[str, Any]] = [
    {
        "case_id": "case-001",
        "account_id": "acct-01",
        "status": "open",
        "alert_ids": ["alert-1001"],
        "analyst": "N. Patel",
        "summary": "Large outbound series with rapid movement and potential structuring.",
    },
    {
        "case_id": "case-002",
        "account_id": "acct-02",
        "status": "pending",
        "alert_ids": ["alert-1002"],
        "analyst": "M. Gomez",
        "summary": "Cash-intensive inbound payment with a high-risk jurisdiction.",
    },
]

ALERTS: List[Dict[str, Any]] = []


def get_transactions() -> List[Dict[str, Any]]:
    return TRANSACTIONS


def get_cases() -> List[Dict[str, Any]]:
    return CASES


def set_alerts(alert_list: List[Dict[str, Any]]) -> None:
    global ALERTS
    ALERTS = alert_list

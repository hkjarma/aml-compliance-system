from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List


class AMLRiskEngine:
    def __init__(self) -> None:
        self.amount_thresholds = {
            "USD": 15000,
            "EUR": 12000,
            "GBP": 10000,
        }

    def evaluate_transaction(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        score = 0
        reasons: List[str] = []

        amount = float(transaction["amount"])
        currency = transaction.get("currency", "USD")
        threshold = self.amount_thresholds.get(currency, 10000)

        if amount >= threshold:
            score += 25
            reasons.append(f"Large transaction above {currency} {threshold:,.0f} threshold")

        if transaction.get("channel") == "cash":
            score += 15
            reasons.append("Cash channel increases anonymity risk")

        if transaction.get("country") in {"CN", "RU", "IR", "KP", "BY"}:
            score += 20
            reasons.append(f"High-risk jurisdiction: {transaction['country']}")

        if transaction.get("direction") == "outbound" and amount >= threshold * 2:
            score += 20
            reasons.append("Large outbound transfer consistent with rapid value extraction")

        risk_tags = transaction.get("risk_tags", [])
        if risk_tags:
            score += min(25, len(risk_tags) * 10)
            reasons.append("Behavioral flags present")

        if "rapid_sequence" in risk_tags:
            score += 15
            reasons.append("Multiple rapid transfers in short time window")

        if "round_trip" in risk_tags:
            score += 20
            reasons.append("Round-trip funds movement suspected")

        if "structuring" in risk_tags:
            score += 25
            reasons.append("Structuring pattern around reporting thresholds")

        if score >= 80:
            severity = "critical"
        elif score >= 60:
            severity = "high"
        elif score >= 35:
            severity = "medium"
        else:
            severity = "low"

        return {
            "score": round(min(score, 100), 2),
            "severity": severity,
            "reasons": reasons,
            "alert": score >= 60,
        }

    def summarize_alerts(self, alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_transactions = max(len(alerts), 1)
        avg = sum(item["score"] for item in alerts) / total_transactions if alerts else 0.0
        high_risk = sum(1 for item in alerts if item["severity"] in {"high", "critical"})

        account_counts: Dict[str, int] = defaultdict(int)
        for item in alerts:
            account_counts[item["account_id"]] += 1

        top_risk_accounts = [
            account for account, _ in sorted(account_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]
        ]

        return {
            "total_transactions": total_transactions,
            "alerts_count": len(alerts),
            "high_risk_count": high_risk,
            "average_score": round(avg, 2),
            "top_risk_accounts": top_risk_accounts,
        }

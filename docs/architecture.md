# System Architecture

## Overview
The AML platform is designed as a modular system with a risk engine, transaction monitoring pipeline, and investigation workflow.

## Components
- Ingestion: payment and account events from core banking systems
- Rules engine: deterministic AML checks and suspicious-pattern detection
- Risk scoring: weighted risk component model
- Alerting: severity-based alert creation with evidence
- Case management: analyst review and disposition workflows
- Reporting: internal dashboards and regulator-ready summaries

## Core flow
1. Incoming transaction event is validated and normalized
2. Risk checks are applied to amounts, geographies, account behavior, and counterparties
3. Rule hits are aggregated into a total risk score
4. Alerts are created if score exceeds the configured threshold
5. Analyst reviews suspicious activity and resolves or escalates the case

## Technology direction
- API: FastAPI
- Data: Postgres for transactional data and case records
- Messaging: Redis or Kafka for asynchronous event processing
- Analytics: Python + rule engine + optional ML model layer
- UI: analyst dashboard (React or internal portal)

## Security
- least privilege access
- encryption in transit and at rest
- audit logs for all case actions
- data minimization and retention policies

# Anti-Money Laundering Compliance System

A production-minded AML MVP for monitoring transactions, generating suspicious activity alerts, and managing investigations.

## Overview
This repository provides a working starter for an AML product that includes:
- transaction risk scoring
- suspicious activity detection
- case management workflows
- dashboard summary for compliance teams
- API-ready backend for integration with KYC, sanctions, and payment systems

## Product goals
- Detect unusual transaction patterns early
- Reduce false positives through explainable rules
- Support analyst investigation workflows
- Provide auditable case records for regulatory reporting

## Repository structure
- `backend/` — FastAPI service with AML scoring engine
- `docs/` — product and architecture docs
- `docker-compose.yml` — local stack for the API

## Quick start

### 1) Create a virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3) Run the service
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4) View the API docs
Open: http://localhost:8000/docs

## Example endpoints
- `GET /health`
- `GET /api/v1/risk/summary`
- `GET /api/v1/alerts`
- `POST /api/v1/transactions/analyze`
- `GET /api/v1/cases`

## Sample alert triggers
- rapid multiple transfers within a short period
- structuring around reporting thresholds
- high-risk country or channel combinations
- round-trip transaction patterns
- large outbound transfers to high-risk counterparties

## Roadmap
- integrate customer risk scores and sanctions screening
- add database-backed persistence (Postgres + Redis)
- queue-based alert processing with Celery
- role-based analyst portal and case workflow
- exportable SAR case packages
- SIEM and audit log integration

## License
MIT

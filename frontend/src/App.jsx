from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    account_id = Column(String, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="USD")
    direction = Column(String, nullable=False)
    counterparty = Column(String, nullable=False)
    country = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    risk_tags = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    alert_id = Column(String, unique=True, nullable=False, index=True)
    account_id = Column(String, index=True, nullable=False)
    transaction_id = Column(String, index=True, nullable=False)
    score = Column(Float, nullable=False)
    severity = Column(String, nullable=False)
    reasons = Column(JSON, nullable=False, default=list)
    status = Column(String, nullable=False, default="open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CaseModel(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String, unique=True, nullable=False, index=True)
    account_id = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default="open")
    analyst = Column(String, nullable=True)
    summary = Column(Text, nullable=False)
    priority = Column(String, nullable=False, default="medium")
    age = Column(String, nullable=False, default="0m")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CaseNoteModel(Base):
    __tablename__ = "case_notes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String, index=True, nullable=False)
    note = Column(Text, nullable=False)
    author = Column(String, nullable=False, default="system")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SanctionEntityModel(Base):
    __tablename__ = "sanction_entities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    aliases = Column(JSON, nullable=True, default=list)
    country = Column(String, nullable=True)
    category = Column(String, nullable=False, default="entity")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomerKycModel(Base):
    __tablename__ = "customer_kyc"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(String, unique=True, index=True, nullable=False)
    customer_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="review_pending")
    risk_rating = Column(String, nullable=False, default="medium")
    country = Column(String, nullable=True)
    pep = Column(Boolean, nullable=False, default=False)
    beneficial_owners = Column(JSON, nullable=True, default=list)
    last_reviewed = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

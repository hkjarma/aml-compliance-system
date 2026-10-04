from __future__ import annotations

import os
from typing import Dict, List

from fastapi import Depends, Header, HTTPException, status

API_KEYS: Dict[str, str] = {
    os.getenv("AML_ANALYST_KEY", "analyst-demo-key"): "analyst",
    os.getenv("AML_MANAGER_KEY", "manager-demo-key"): "manager",
    os.getenv("AML_ADMIN_KEY", "admin-demo-key"): "admin",
}


def get_permissions(role: str) -> List[str]:
    permissions = {
        "analyst": ["read:alerts", "read:cases", "read:customer_kyc", "read:sanctions"],
        "manager": ["read:alerts", "read:cases", "write:cases", "read:customer_kyc", "read:sanctions"],
        "admin": ["read:alerts", "read:cases", "write:cases", "read:customer_kyc", "read:sanctions", "write:controls"],
    }
    return permissions.get(role, [])


def get_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> str:
    candidate = x_api_key
    if not candidate and authorization and authorization.lower().startswith("bearer "):
        candidate = authorization.split(" ", 1)[1].strip()

    if not candidate:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")

    if candidate not in API_KEYS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    return candidate


def get_current_user(api_key: str = Depends(get_api_key)) -> Dict[str, str | List[str]]:
    role = API_KEYS[api_key]
    return {"user": role, "role": role, "permissions": get_permissions(role)}


def require_roles(*roles: str):
    def dependency(user: Dict[str, str | List[str]] = Depends(get_current_user)) -> Dict[str, str | List[str]]:
        user_role = str(user.get("role", ""))
        if roles and user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role required: {', '.join(roles)}",
            )
        return user

    return dependency


__all__ = ["API_KEYS", "get_api_key", "get_current_user", "require_roles"]

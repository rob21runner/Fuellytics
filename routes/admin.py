from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import os
import secrets

from db import get_db
from models import Interaction
import logger

router = APIRouter(prefix="/api/admin", tags=["admin"])

security = HTTPBasic()
admin_users = os.getenv("ADMIN_USERS", "").split(",")
admin_passwords = os.getenv("ADMIN_PASSWORDS", "").split(",")
attempts_by_ip = defaultdict(list)
MAX_ATTEMPTS = 5
BLOCK_DURATION = timedelta(minutes=5)
recent_success_by_ip = {}

def get_client_ip(request: Request) -> str:
    return request.client.host

def check_admin(credentials: HTTPBasicCredentials = Depends(security), request: Request = None):
    referer = request.headers.get("referer", "")
    ip = get_client_ip(request)
    now = datetime.now(timezone.utc)
    expire_time = timedelta(minutes=30)

    for old_ip in list(recent_success_by_ip.keys()):
        if now - recent_success_by_ip[old_ip] > expire_time:
            del recent_success_by_ip[old_ip]

    attempts_by_ip[ip] = [t for t in attempts_by_ip[ip] if now - t < BLOCK_DURATION]

    if len(attempts_by_ip[ip]) >= MAX_ATTEMPTS:
        if "/admin" not in referer:
            logger.log_admin_attempt(ip, len(attempts_by_ip[ip]), False)
        raise HTTPException(
            status_code=403,
            detail="Trop de tentatives. Réessayez plus tard.",
        )
    try:
        index = admin_users.index(credentials.username)
        expected_password = admin_passwords[index]
    except ValueError:
        if "/admin" not in referer:
            attempts_by_ip[ip].append(now)
            logger.log_admin_attempt(ip, len(attempts_by_ip[ip]), False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Basic"})

    if not secrets.compare_digest(credentials.password, expected_password):
        if "/admin" not in referer:
            attempts_by_ip[ip].append(now)
            logger.log_admin_attempt(ip, len(attempts_by_ip[ip]), False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Basic"})

    if ip in recent_success_by_ip:
        return credentials.username

    if "/admin" not in referer:
        logger.log_admin_attempt(ip, len(attempts_by_ip[ip]), True)
    recent_success_by_ip[ip] = now
    return credentials.username

@router.get("/data")
def get_raw_data(
    from_: str = Query(..., alias="from"),
    to_: str = Query(..., alias="to"),
    db: Session = Depends(get_db),
    _: str = Depends(check_admin)
):
    from_dt = datetime.strptime(from_, "%Y-%m-%d")
    to_dt = datetime.strptime(to_, "%Y-%m-%d")
    td = timedelta(day=1)

    interactions = db.query(Interaction).filter(
        Interaction.timestamp >= from_dt,
        Interaction.timestamp <= to_dt + td
    ).all()

    return [
        {
            "user_id": i.user_id,
            "type": i.type,
            "page": i.page,
            "timestamp": i.timestamp.isoformat(),
            "data": i.data
        } for i in interactions
    ]

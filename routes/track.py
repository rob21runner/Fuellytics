from fastapi import Request, APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import Interaction

router = APIRouter(prefix="/track", tags=["track"])

@router.post("/")
async def track_event(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    interaction = Interaction(
        user_id=payload.get("userId"),
        type=payload.get("type"),
        page=payload.get("page"),
        data=payload.get("data"),
    )
    db.add(interaction)
    db.commit()
    return {"ok": True}
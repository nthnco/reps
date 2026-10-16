from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.activity import run_length, window_start
from app.clock import local_today
from app.db import get_db
from app.models import Attempt
from app.schemas import ActivityRead, DayCountRead

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=ActivityRead)
def activity(db: Annotated[Session, Depends(get_db)]) -> ActivityRead:
    today = local_today()
    start = window_start(today)
    # All time, not just the window: a run can be longer than 26 weeks. One row
    # per practiced day, so this stays small.
    counts = dict(
        db.execute(
            select(Attempt.attempted_on, func.count())
            .group_by(Attempt.attempted_on)
            .order_by(Attempt.attempted_on)
        ).tuples().all()
    )
    return ActivityRead(
        today=today,
        start=start,
        days=[DayCountRead(day=d, count=n) for d, n in counts.items() if d >= start],
        run=run_length(counts, today),
    )

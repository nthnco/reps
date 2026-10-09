from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import plan_config as cfg
from app.clock import local_today
from app.db import get_db
from app.models import Attempt
from app.plan import Entry, fit
from app.routes.mastery import build_suggestion
from app.routes.queue import build_queue
from app.schemas import PlanItemRead, PlanRead, ProblemRead
from app.snapshot import ProblemSnapshot, load_problems

router = APIRouter(prefix="/api/plan", tags=["plan"])


@router.get("/today", response_model=PlanRead)
def todays_plan(db: Annotated[Session, Depends(get_db)]) -> PlanRead:
    # Read once: a request spanning midnight must not plan one day and check another.
    return build_plan(db, local_today())


def build_plan(db: Session, today: date) -> PlanRead:
    """Planned from attempts before `today`, so it holds all day; `done` uses today's."""
    # Queue and suggestion return API shapes without attempts; estimates need
    # them, so look each problem back up. Three loads of every problem, fine at
    # a few hundred.
    snapshots = {p.id: p for p in load_problems(db, today)}
    reviews = [(snapshots[item.problem.id], item.due_on) for item in build_queue(db, today)]
    suggestion = build_suggestion(db, today)
    new = snapshots[suggestion.problem.id] if suggestion and suggestion.problem else None

    # Same Mapped[...] false positive as in queue.py.
    plan = fit(reviews, new, cfg.BUDGET_SECONDS)  # pyright: ignore[reportArgumentType]
    done = set(db.scalars(select(Attempt.problem_id).where(Attempt.attempted_on == today)))

    def read(entry: Entry[ProblemSnapshot]) -> PlanItemRead:
        return PlanItemRead(
            problem=ProblemRead.model_validate(entry.problem),
            due_on=entry.due_on,
            estimate_seconds=entry.estimate_seconds,
            done=entry.problem.id in done,
        )

    return PlanRead(
        today=today,
        budget_seconds=cfg.BUDGET_SECONDS,
        items=[read(e) for e in plan.items],
        backlog=[read(e) for e in plan.backlog],
        suggestion=suggestion,
    )

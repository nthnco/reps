from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.clock import local_today
from app.db import get_db
from app.models import Problem
from app.scheduler import schedule
from app.schemas import ProblemRead, QueueItem

router = APIRouter(prefix="/api/queue", tags=["queue"])


@router.get("", response_model=list[QueueItem])
def todays_queue(db: Annotated[Session, Depends(get_db)]) -> list[QueueItem]:
    """Problems due today or earlier, most overdue first, then never-attempted ones."""
    today = local_today()
    # Due dates aren't stored, so every problem's history is replayed here.
    # selectinload fetches all attempts in one extra query instead of one per problem.
    problems = db.scalars(select(Problem).options(selectinload(Problem.attempts)))

    due: list[QueueItem] = []
    new: list[QueueItem] = []
    for problem in problems:
        state = schedule(problem.attempts)
        item = QueueItem(
            problem=ProblemRead.model_validate(problem),
            due_on=state.due_on if state else None,
        )
        if state is None:
            new.append(item)
        elif state.due_on <= today:
            due.append(item)

    due.sort(key=lambda item: (item.due_on, item.problem.title))
    new.sort(key=lambda item: item.problem.title)
    return due + new

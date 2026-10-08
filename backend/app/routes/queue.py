from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.clock import local_today
from app.db import get_db
from app.schemas import ProblemRead, QueueItem
from app.sm2 import schedule
from app.snapshot import load_problems

router = APIRouter(prefix="/api/queue", tags=["queue"])


@router.get("", response_model=list[QueueItem])
def todays_queue(db: Annotated[Session, Depends(get_db)]) -> list[QueueItem]:
    """Problems due today or earlier, most overdue first, then never-attempted ones."""
    return build_queue(db)


def build_queue(db: Session, as_of: date | None = None) -> list[QueueItem]:
    """The queue as it stood at the start of `as_of` (default: live, as of now)."""
    today = as_of or local_today()
    # Due dates aren't stored, so every problem's history is replayed here.
    problems = load_problems(db, as_of)

    due: list[QueueItem] = []
    new: list[QueueItem] = []
    for problem in problems:
        # Pyright compares the model's Mapped[date] columns to AttemptLike's plain
        # types and says no, though instance access does give a date.
        state = schedule(problem.attempts)  # pyright: ignore[reportArgumentType]
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

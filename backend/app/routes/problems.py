from dataclasses import replace
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clock import local_today
from app.db import get_db
from app.mastery import pattern_mastery
from app.models import Attempt, Pattern, Problem
from app.schemas import (
    AttemptCreate,
    AttemptCreated,
    AttemptRead,
    ProblemCreate,
    ProblemListItem,
    ProblemRead,
)
from app.sm2 import schedule
from app.snapshot import ProblemSnapshot, load_problems
from app.status import problem_status

router = APIRouter(prefix="/api/problems", tags=["problems"])


@router.get("", response_model=list[ProblemListItem])
def list_problems(db: Annotated[Session, Depends(get_db)]) -> list[ProblemListItem]:
    today = local_today()
    problems = sorted(load_problems(db), key=lambda p: p.title)
    return [
        ProblemListItem(
            **ProblemRead.model_validate(p).model_dump(),
            status=problem_status(p.attempts, today),  # pyright: ignore[reportArgumentType]
        )
        for p in problems
    ]


@router.post("", response_model=ProblemRead, status_code=status.HTTP_201_CREATED)
def create_problem(
    body: ProblemCreate, db: Annotated[Session, Depends(get_db)]
) -> Problem:
    problem = Problem(**body.model_dump())
    db.add(problem)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Rely on the unique constraint rather than checking first: a check
        # followed by an insert can race (e.g. a double-clicked submit).
        if "uq_problems_link" in str(exc.orig):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "That problem is already in your list.",
            ) from exc
        raise
    db.refresh(problem)
    return problem


@router.get("/{problem_id}/attempts", response_model=list[AttemptRead])
def list_attempts(problem_id: int, db: Annotated[Session, Depends(get_db)]) -> list[Attempt]:
    # Without this check a missing problem would look like one with no attempts.
    if db.get(Problem, problem_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found.")
    return list(
        db.scalars(
            select(Attempt)
            .where(Attempt.problem_id == problem_id)
            .order_by(Attempt.attempted_on.desc(), Attempt.id.desc())  # same day: last logged first
        )
    )


def _skill(problems: list[ProblemSnapshot], pattern: Pattern) -> float:
    rows = pattern_mastery(problems)  # pyright: ignore[reportArgumentType]
    return next(row.mastery for row in rows if row.pattern == pattern)


@router.post(
    "/{problem_id}/attempts",
    response_model=AttemptCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_attempt(
    problem_id: int, body: AttemptCreate, db: Annotated[Session, Depends(get_db)]
) -> AttemptCreated:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found.")
    before = load_problems(db, pattern=problem.pattern)

    attempt = Attempt(problem_id=problem_id, **body.model_dump())
    db.add(attempt)
    # Flush, not commit, for now: it assigns the id (same-day replay order needs
    # it) without expiring the loaded attempts, which would reload one by one.
    db.flush()

    # "After" is built in memory, not re-read, so it can't miss the new attempt
    # to a stale session cache. Replay (not a stored due date) puts a backdated
    # attempt in its place in the history.
    after = [
        replace(p, attempts=(*p.attempts, attempt)) if p.id == problem_id else p
        for p in before
    ]
    attempts = next(p.attempts for p in after if p.id == problem_id)
    state = schedule(attempts)  # pyright: ignore[reportArgumentType]
    assert state is not None  # the problem has at least the attempt just added
    response = AttemptCreated(
        **AttemptRead.model_validate(attempt).model_dump(),
        next_review_on=state.due_on,
        skill_before=_skill(before, problem.pattern),
        skill_after=_skill(after, problem.pattern),
    )
    db.commit()
    return response

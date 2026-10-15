from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.mastery import pattern_mastery
from app.models import Attempt, Pattern, Problem
from app.schemas import AttemptCreate, AttemptCreated, AttemptRead, ProblemCreate, ProblemRead
from app.sm2 import schedule
from app.snapshot import ProblemSnapshot, load_problems

router = APIRouter(prefix="/api/problems", tags=["problems"])


@router.get("", response_model=list[ProblemRead])
def list_problems(db: Annotated[Session, Depends(get_db)]) -> list[Problem]:
    return list(db.scalars(select(Problem).order_by(Problem.title)))


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


def _skill(problems: list[ProblemSnapshot], pattern: Pattern) -> float:
    rows = pattern_mastery(p for p in problems if p.pattern == pattern)  # pyright: ignore[reportArgumentType]
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
    skill_before = _skill(load_problems(db), problem.pattern)

    attempt = Attempt(problem_id=problem_id, **body.model_dump())
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Replayed, not read back from a stored column: a backdated attempt lands
    # mid-history and can change everything after it.
    after = load_problems(db)
    snapshot = next(p for p in after if p.id == problem_id)
    state = schedule(snapshot.attempts)  # pyright: ignore[reportArgumentType]
    assert state is not None  # the problem has at least the attempt just added
    return AttemptCreated(
        **AttemptRead.model_validate(attempt).model_dump(),
        next_review_on=state.due_on,
        skill_before=skill_before,
        skill_after=_skill(after, problem.pattern),
    )

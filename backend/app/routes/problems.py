from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Attempt, Problem
from app.schemas import AttemptCreate, AttemptRead, ProblemCreate, ProblemRead

router = APIRouter(prefix="/api/problems", tags=["problems"])


@router.get("", response_model=list[ProblemRead])
def list_problems(db: Annotated[Session, Depends(get_db)]) -> list[Problem]:
    return list(db.scalars(select(Problem).order_by(Problem.number)))


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
        if "uq_problems_number" in str(exc.orig):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Problem #{body.number} is already in your list.",
            ) from exc
        raise
    db.refresh(problem)
    return problem


@router.post(
    "/{problem_id}/attempts",
    response_model=AttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def create_attempt(
    problem_id: int, body: AttemptCreate, db: Annotated[Session, Depends(get_db)]
) -> Attempt:
    if db.get(Problem, problem_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found.")
    attempt = Attempt(problem_id=problem_id, **body.model_dump())
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt

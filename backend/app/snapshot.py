"""Problems with their attempts, optionally as they stood at the start of a day.

Routes read problems through `load_problems` so the same replay code can answer
"as of today" and "as of the start of some day". Snapshots are read-only copies:
filtering `Problem.attempts` itself would let a flush delete the dropped
attempts (the relationship has a delete-orphan cascade).
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Attempt, Difficulty, Pattern, Problem


@dataclass(frozen=True)
class ProblemSnapshot:
    id: int
    title: str
    link: str
    pattern: Pattern
    difficulty: Difficulty
    notes: str
    is_premium: bool
    attempts: tuple[Attempt, ...]


def load_problems(db: Session, as_of: date | None = None) -> list[ProblemSnapshot]:
    """Every problem; given `as_of`, only attempts dated before that day."""
    # selectinload fetches all attempts in one extra query instead of one per problem.
    problems = db.scalars(select(Problem).options(selectinload(Problem.attempts)))
    return [
        ProblemSnapshot(
            id=p.id,
            title=p.title,
            link=p.link,
            pattern=p.pattern,
            difficulty=p.difficulty,
            notes=p.notes,
            is_premium=p.is_premium,
            attempts=tuple(
                a for a in p.attempts if as_of is None or a.attempted_on < as_of
            ),
        )
        for p in problems
    ]

"""Sample practice history for the demo: a learner who follows today's plan.

Each simulated day calls the real `build_plan` and attempts everything on it,
so the history has the shape real use produces (new problems in roadmap
order, reviews on their due dates) and follows any change to the plan,
suggestion or scheduler logic. Outcomes are random but seeded, so every
template build tells the same story, shifted to end yesterday.

Not for scheduler evaluation: the outcomes here are made up (see TREE.md).
"""

import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import Attempt, Difficulty
from app.routes.plan import build_plan

SEED = 150
DAYS = 56
SKIP_DAY_RATE = 0.2  # days off, so the streak looks human
FIRST_SOLVE_RATE = {Difficulty.EASY: 0.85, Difficulty.MEDIUM: 0.6, Difficulty.HARD: 0.35}
REVIEW_SOLVE_RATE = 0.85
HINT_RATE = 0.25
MINUTES = {Difficulty.EASY: 15, Difficulty.MEDIUM: 25, Difficulty.HARD: 35}


def _attempt(rng: random.Random, problem_id: int, difficulty: Difficulty, is_review: bool, day: date) -> Attempt:
    solved = rng.random() < (REVIEW_SOLVE_RATE if is_review else FIRST_SOLVE_RATE[difficulty])
    used_hint = solved and rng.random() < HINT_RATE
    if not solved:
        confidence = rng.choice((1, 2))
    elif used_hint:
        confidence = rng.choice((2, 3))
    else:
        confidence = rng.choice((3, 4, 4, 5))
    # Reviews go faster than first tries; giving up takes about the full time.
    minutes = MINUTES[difficulty] * (rng.uniform(0.5, 1.0) if is_review else rng.uniform(0.7, 1.4))
    return Attempt(
        problem_id=problem_id,
        attempted_on=day,
        solved=solved,
        duration_seconds=round(minutes * 60),
        confidence=confidence,
        used_hint=used_hint,
    )


def generate(db: Session, today: date) -> None:
    """Add DAYS of attempts ending yesterday, to problems already in `db`."""
    rng = random.Random(SEED)
    for offset in range(DAYS, 0, -1):
        day = today - timedelta(days=offset)
        if rng.random() < SKIP_DAY_RATE:
            continue
        for item in build_plan(db, day).items:
            db.add(_attempt(rng, item.problem.id, item.problem.difficulty, item.due_on is not None, day))
        db.flush()

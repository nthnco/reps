"""Score how well a scheduler predicts recall on the user's own history.

Each problem's attempts are replayed in date order. Before every repeat attempt
the scheduler is asked for its retention on that day, which is a prediction of
the chance the problem gets solved; the attempt's result is the outcome. Every
scheduler is scored on the same outcomes, so the numbers are directly comparable.

Usage (from backend/): uv run python -m app.evaluate
It reads the database in DATABASE_URL, in a read-only transaction.
"""

import math
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app import fsrs, sm2
from app.db import SessionLocal, engine
from app.models import Problem
from app.scheduling import RetentionFn, UpdateFn

# Below this many scored reviews the winner is too likely to be noise. From
# app.simulate's sweep: at 200, the better scheduler won 97%+ of samples.
MIN_REVIEWS = 200
# Keeps one confident miss (a predicted 1.0 that failed) from making log loss infinite.
CLIP = 1e-3


class AttemptLike(Protocol):
    attempted_on: date
    solved: bool
    confidence: int
    used_hint: bool


@dataclass(frozen=True)
class Scheduler[S]:
    name: str
    update: UpdateFn[S]
    retention: RetentionFn[S]
    # Maps an attempt's (solved, confidence, used_hint) to this scheduler's rating.
    rate: Callable[[bool, int, bool], int]


SCHEDULERS: list[Scheduler[Any]] = [
    Scheduler("SM-2", sm2.update, sm2.retention, sm2.quality),
    Scheduler("FSRS", fsrs.update, fsrs.retention, fsrs.rating),
]


@dataclass(frozen=True)
class Prediction:
    predicted: float  # the scheduler's retention on the attempt's day
    recalled: bool  # solved, with or without a hint


@dataclass(frozen=True)
class Score:
    reviews: int
    enough_data: bool
    log_loss: float | None  # lower is better; 0.693 is a coin flip
    rmse: float | None  # lower is better
    mean_predicted: float | None  # compare with mean_actual for over/under-confidence
    mean_actual: float | None


def predictions[S](
    histories: Iterable[Sequence[AttemptLike]], scheduler: Scheduler[S]
) -> list[Prediction]:
    """One prediction per repeat attempt. `histories` holds each problem's attempts.

    First attempts have no prior state to predict from. Same-day repeats are
    skipped too: every scheduler predicts full recall the day of a review, so
    they'd only measure that edge case.
    """
    out: list[Prediction] = []
    for attempts in histories:
        state: S | None = None
        last_day: date | None = None
        for a in sorted(attempts, key=lambda a: a.attempted_on):
            if state is not None and a.attempted_on != last_day:
                out.append(Prediction(scheduler.retention(state, a.attempted_on), a.solved))
            state = scheduler.update(state, scheduler.rate(a.solved, a.confidence, a.used_hint), a.attempted_on)
            last_day = a.attempted_on
    return out


def score(preds: Sequence[Prediction]) -> Score:
    n = len(preds)
    if n == 0:
        return Score(0, False, None, None, None, None)
    clipped = [min(max(p.predicted, CLIP), 1 - CLIP) for p in preds]
    outcomes = [1.0 if p.recalled else 0.0 for p in preds]
    log_loss = -sum(y * math.log(p) + (1 - y) * math.log(1 - p) for p, y in zip(clipped, outcomes)) / n
    rmse = math.sqrt(sum((p.predicted - y) ** 2 for p, y in zip(preds, outcomes)) / n)
    return Score(
        reviews=n,
        enough_data=n >= MIN_REVIEWS,
        log_loss=log_loss,
        rmse=rmse,
        mean_predicted=sum(p.predicted for p in preds) / n,
        mean_actual=sum(outcomes) / n,
    )


def histories(db: Session) -> list[Sequence[AttemptLike]]:
    """Every problem's attempts. Problems never attempted contribute nothing."""
    problems = db.scalars(select(Problem).options(selectinload(Problem.attempts)))
    return [p.attempts for p in problems if p.attempts]  # pyright: ignore[reportReturnType]


def report(scores: dict[str, Score]) -> str:
    reviews = next(iter(scores.values())).reviews
    lines = [f"Scored {reviews} repeat reviews (first attempts and same-day repeats are skipped)."]
    if reviews < MIN_REVIEWS:
        lines.append(f"Not enough data to pick a winner: need {MIN_REVIEWS}.")
    if reviews:
        lines += ["", f"{'scheduler':<10}{'log loss':>10}{'RMSE':>8}{'predicted':>11}{'actual':>8}"]
        for name, s in scores.items():
            lines.append(
                f"{name:<10}{s.log_loss:>10.3f}{s.rmse:>8.3f}{s.mean_predicted:>11.2f}{s.mean_actual:>8.2f}"
            )
    return "\n".join(lines)


def main() -> None:
    # Printed first so it's obvious which data the numbers came from (Neon, local, or the demo).
    print(f"Reading database {engine.url.database!r} on {engine.url.host} (read-only)\n")
    with SessionLocal() as db:
        db.execute(text("SET TRANSACTION READ ONLY"))
        hist = histories(db)
        scores = {s.name: score(predictions(hist, s)) for s in SCHEDULERS}
    print(report(scores))


if __name__ == "__main__":
    main()

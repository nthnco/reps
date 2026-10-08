"""A simulated learner: attempt histories drawn from a known forgetting curve.

Used to check the evaluator (it should reward the scheduler whose predictions
match the truth) and to estimate how many scored reviews it takes before the
winner stops flipping from sample to sample.

The true memory model is FSRS-6 with default parameters, with every stability
optionally scaled to make a learner who forgets faster (< 1) or slower (> 1)
than FSRS assumes. Reviews land on a scheduler's due dates (SM-2 by default,
since it produced the real history) plus some random lateness.

Usage (from backend/): uv run python -m app.simulate
"""

import random
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import Any

from app import fsrs
from app.evaluate import SCHEDULERS, Scheduler, predictions, score

START = date(2026, 1, 1)
# Each problem is practised for this long, so problems end with a mix of short and long intervals.
DAYS = 180
FIRST_SOLVE_RATE = 0.6  # chance of solving a problem the first time it's seen
HINT_RATE = 0.15  # chance a solve needed a hint
MEAN_LATENESS_DAYS = 2.0  # reviews happen on or after the due date, never before


# Not frozen: AttemptLike's plain attributes count as writable, which a frozen dataclass isn't.
@dataclass
class SimAttempt:
    attempted_on: date
    solved: bool
    confidence: int
    used_hint: bool
    true_recall: float  # the chance this attempt was solved, under the true curve


def _problem(
    rng: random.Random, stability_scale: float, follow: Scheduler[Any], mean_lateness: float
) -> list[SimAttempt]:
    truth: fsrs.ReviewState | None = None
    followed: Any = None
    day, end = START, START + timedelta(days=DAYS)
    attempts: list[SimAttempt] = []
    while day < end:
        if truth is None:
            p = FIRST_SOLVE_RATE
        else:
            p = fsrs.retention(replace(truth, stability=truth.stability * stability_scale), day)
        solved = rng.random() < p
        used_hint = solved and rng.random() < HINT_RATE
        confidence = rng.randint(2, 5) if solved else 1
        attempts.append(SimAttempt(day, solved, confidence, used_hint, p))

        truth = fsrs.update(truth, fsrs.rating(solved, confidence, used_hint), day)
        followed = follow.update(followed, follow.rate(solved, confidence, used_hint), day)
        # Both schedulers' states carry due_on; every interval is at least a day,
        # so there are no same-day repeats.
        day = followed.due_on + timedelta(days=round(rng.expovariate(1 / mean_lateness)))
    return attempts


def simulate(
    seed: int,
    reviews: int,
    *,
    stability_scale: float = 1.0,
    follow: Scheduler[Any] = SCHEDULERS[0],
    mean_lateness: float = MEAN_LATENESS_DAYS,
) -> list[list[SimAttempt]]:
    """Problem histories, added one at a time until there are at least `reviews` repeat attempts.

    Same seed and arguments, same histories.
    """
    rng = random.Random(seed)
    histories: list[list[SimAttempt]] = []
    repeats = 0
    while repeats < reviews:
        h = _problem(rng, stability_scale, follow, mean_lateness)
        histories.append(h)
        repeats += len(h) - 1
    return histories


def win_rates(reviews: int, trials: int, stability_scale: float = 1.0) -> dict[str, float]:
    """Share of `trials` independent samples of exactly `reviews` scored reviews each scheduler wins on log loss."""
    wins = dict.fromkeys((s.name for s in SCHEDULERS), 0)
    for seed in range(trials):
        hist = simulate(seed, reviews, stability_scale=stability_scale)
        losses = {s.name: score(predictions(hist, s)[:reviews]).log_loss for s in SCHEDULERS}
        wins[min(losses, key=lambda name: losses[name] or 0.0)] += 1
    return {name: w / trials for name, w in wins.items()}


def sweep(sizes: Sequence[int], scales: Sequence[float], trials: int) -> str:
    names = [s.name for s in SCHEDULERS]
    lines = [f"Share of {trials} samples won on log loss ({' / '.join(names)})", ""]
    lines.append(f"{'reviews':>8}" + "".join(f"{f'scale {k}':>16}" for k in scales))
    for n in sizes:
        cells = []
        for k in scales:
            rates = win_rates(n, trials, k)
            cells.append(f"{' / '.join(f'{rates[name]:.2f}' for name in names):>16}")
        lines.append(f"{n:>8}" + "".join(cells))
    return "\n".join(lines)


if __name__ == "__main__":
    print(sweep(sizes=(25, 50, 100, 200, 400, 800), scales=(1.0, 0.5, 0.25, 2.0), trials=200))

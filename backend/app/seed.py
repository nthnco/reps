"""Load a NeetCode-style problem list into the database.

Usage (from backend/): uv run python -m app.seed data/neetcode150.json

Expected shape: {category: {title: {"url": ..., "difficulty": "Easy"}}}.
Only title, link, pattern and difficulty are kept (see CLAUDE.md product rules).
Problems whose link is already saved are skipped, so it's safe to re-run.
"""

import json
import sys

from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Pattern, Problem
from app.schemas import ProblemCreate

CATEGORY_TO_PATTERN = {
    "Arrays & Hashing": Pattern.ARRAYS_HASHING,
    "Two Pointers": Pattern.TWO_POINTERS,
    "Sliding Window": Pattern.SLIDING_WINDOW,
    "Stack": Pattern.STACK,
    "Binary Search": Pattern.BINARY_SEARCH,
    "Linked List": Pattern.LINKED_LIST,
    "Trees": Pattern.TREES,
    "Tries": Pattern.TRIES,
    "Heap / Priority Queue": Pattern.HEAP,
    "Backtracking": Pattern.BACKTRACKING,
    "Graphs": Pattern.GRAPHS,
    "Advanced Graphs": Pattern.ADVANCED_GRAPHS,
    "1-D Dynamic Programming": Pattern.DP_1D,
    "2-D Dynamic Programming": Pattern.DP_2D,
    "Greedy": Pattern.GREEDY,
    "Intervals": Pattern.INTERVALS,
    "Math & Geometry": Pattern.MATH_GEOMETRY,
    "Bit Manipulation": Pattern.BIT_MANIPULATION,
}


def parse(data: dict) -> list[ProblemCreate]:
    """Turn the JSON into validated problems. Raises on anything unexpected."""
    problems = []
    for category, entries in data.items():
        if category not in CATEGORY_TO_PATTERN:
            raise ValueError(f"Unknown category {category!r}; add it to CATEGORY_TO_PATTERN")
        for title, entry in entries.items():
            # ProblemCreate applies the same checks as the API, including link
            # normalization.
            try:
                problems.append(
                    ProblemCreate(
                        title=title,
                        link=entry["url"],
                        pattern=CATEGORY_TO_PATTERN[category],
                        difficulty=entry["difficulty"].lower(),
                    )
                )
            except (KeyError, ValidationError) as exc:
                raise ValueError(f"Bad entry {title!r} in {category!r}: {exc}") from exc
    return problems


def seed(db: Session, problems: list[ProblemCreate]) -> int:
    """Insert problems not already saved. Returns how many were added."""
    if not problems:
        return 0
    statement = (
        pg_insert(Problem)
        .values([p.model_dump() for p in problems])
        .on_conflict_do_nothing(index_elements=["link"])
        .returning(Problem.id)
    )
    return len(db.execute(statement).all())


def main(path: str) -> None:
    with open(path) as f:
        problems = parse(json.load(f))
    with SessionLocal() as db:
        added = seed(db, problems)
        db.commit()
    print(f"Added {added}, skipped {len(problems) - added} already saved.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python -m app.seed <path-to-json>")
    main(sys.argv[1])

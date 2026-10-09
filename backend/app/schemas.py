"""Request/response shapes for the JSON API (Pydantic), separate from the DB models.

These check one request in isolation. Rules that need the database (like
duplicate problem links) are enforced in the routes.
"""

import re
from datetime import date
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.clock import local_today
from app.models import Difficulty, Pattern
from app.suggest import Reason


_SLUG = re.compile(r"[a-z0-9-]+")


def normalize_leetcode_link(link: str) -> str:
    """Reduce any LeetCode problem URL to https://leetcode.com/problems/<slug>/.

    Drops www., trailing pages like /description/, query strings and fragments.
    """
    parts = urlsplit(link)
    segments = parts.path.split("/")  # "/problems/two-sum/x" -> ["", "problems", "two-sum", "x"]
    slug = segments[2].lower() if len(segments) > 2 else ""
    if (
        parts.scheme != "https"
        or parts.hostname not in ("leetcode.com", "www.leetcode.com")
        or segments[1] != "problems"
        or not _SLUG.fullmatch(slug)
    ):
        raise ValueError("must be a https://leetcode.com/problems/... link")
    return f"https://leetcode.com/problems/{slug}/"


# Length limits match the column sizes in models.py.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Link = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=500),
    AfterValidator(normalize_leetcode_link),
]


class ProblemCreate(BaseModel):
    title: Title
    link: Link
    pattern: Pattern
    difficulty: Difficulty
    # The column is unbounded Text; this keeps one request from filling the database.
    notes: Annotated[str, StringConstraints(max_length=5000)] = ""


class ProblemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    link: str
    pattern: Pattern
    difficulty: Difficulty
    notes: str
    is_premium: bool


def _not_in_future(day: date) -> date:
    if day > local_today():
        raise ValueError("can't be in the future")
    return day


class AttemptCreate(BaseModel):
    attempted_on: Annotated[date, AfterValidator(_not_in_future)] = Field(
        default_factory=local_today
    )
    solved: bool
    duration_seconds: int = Field(ge=0, le=24 * 60 * 60)
    confidence: int = Field(ge=1, le=5)
    used_hint: bool = False


class AttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    problem_id: int
    attempted_on: date
    solved: bool
    duration_seconds: int
    confidence: int
    used_hint: bool


class QueueItem(BaseModel):
    problem: ProblemRead
    due_on: date


class TierCountsRead(BaseModel):
    easy: int
    medium: int
    hard: int


class PatternMasteryRead(BaseModel):
    pattern: Pattern
    displayed_mastery: float  # mastery after decay; what the bar shows
    mastery: float  # raw EWMA, before decay
    peak: float
    certainty: float
    low_data: bool  # certainty below the configured minimum
    attempt_count: int
    problem_count: int
    problems_attempted: int
    # Progress nudges, so the UI can say "2 more ..." without knowing the rules.
    problems_until_counted: int  # until it counts toward the overall rating
    attempts_until_trusted: int  # until low_data clears
    due_count: int  # attempted problems due for review today or earlier
    last_practiced_on: date | None
    median_solve_seconds: int | None
    covered: bool  # breadth pass done; see app/suggest.py
    solved_by_tier: TierCountsRead  # distinct problems solved, hints allowed
    total_by_tier: TierCountsRead


class SuggestionRead(BaseModel):
    pattern: Pattern
    problem: ProblemRead | None  # None: nothing new left in the pattern
    reason: Reason  # the frontend words it, since pattern labels live there


class PlanItemRead(BaseModel):
    problem: ProblemRead
    due_on: date | None  # None: the new problem
    estimate_seconds: int
    done: bool  # attempted today


class PlanRead(BaseModel):
    today: date
    budget_seconds: int
    items: list[PlanItemRead]
    backlog: list[PlanItemRead]  # due, but didn't fit
    suggestion: SuggestionRead | None  # why the new item was picked, or keep_reviewing


class RatingPartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pattern: Pattern
    weight: float
    displayed_mastery: float
    counted: bool  # enough problems attempted to count toward `overall`


class MasteryRulesRead(BaseModel):
    """The thresholds from mastery_config, so the UI can state them exactly."""

    overall_min_problems: int
    mastered_at: float
    strength_min_attempts: int


class ProfileSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rules: MasteryRulesRead
    overall: float
    breakdown: list[RatingPartRead]
    strengths: list[Pattern]
    weaknesses: list[Pattern]  # below mastered even before decay: a skill gap
    needs_review: list[Pattern]  # was mastered, faded below it since
    not_started: list[Pattern]
    total_completed: int


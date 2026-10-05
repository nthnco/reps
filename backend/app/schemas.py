"""Request/response shapes for the JSON API (Pydantic), separate from the DB models.

These check one request in isolation. Rules that need the database (like
duplicate problem numbers) are enforced in the routes.
"""

from datetime import date
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.clock import local_today
from app.models import Difficulty, Pattern


def _leetcode_problem_url(link: str) -> str:
    parts = urlsplit(link)
    if (
        parts.scheme != "https"
        or parts.hostname not in ("leetcode.com", "www.leetcode.com")
        or not parts.path.startswith("/problems/")
    ):
        raise ValueError("must be a https://leetcode.com/problems/... link")
    return link


# Length limits match the column sizes in models.py.
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Link = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=500),
    AfterValidator(_leetcode_problem_url),
]


class ProblemCreate(BaseModel):
    number: int = Field(gt=0)
    title: Title
    link: Link
    pattern: Pattern
    difficulty: Difficulty
    notes: str = ""


class ProblemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: int
    title: str
    link: str
    pattern: Pattern
    difficulty: Difficulty
    notes: str


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

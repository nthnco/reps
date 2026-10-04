"""Request/response shapes for the JSON API (Pydantic), separate from the DB models.

These check one request in isolation. Rules that need the database (like
duplicate problem numbers) are enforced in the routes.
"""

from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

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

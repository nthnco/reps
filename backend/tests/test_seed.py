import pytest
from sqlalchemy import select

from app.models import Difficulty, Pattern, Problem
from app.seed import parse, seed

SAMPLE = {
    "Arrays & Hashing": {
        "Contains Duplicate": {
            "nurl": "https://neetcode.io/problems/duplicate-integer?list=neetcode150",
            "url": "https://leetcode.com/problems/contains-duplicate/",
            "difficulty": "Easy",
        },
    },
    "1-D Dynamic Programming": {
        "Climbing Stairs": {
            "url": "https://leetcode.com/problems/climbing-stairs/description/",
            "difficulty": "Easy",
        },
    },
}


def test_parse_maps_category_difficulty_and_normalizes_link():
    problems = parse(SAMPLE)

    assert [p.model_dump() for p in problems] == [
        {
            "title": "Contains Duplicate",
            "link": "https://leetcode.com/problems/contains-duplicate/",
            "pattern": Pattern.ARRAYS_HASHING,
            "difficulty": Difficulty.EASY,
            "notes": "",
        },
        {
            "title": "Climbing Stairs",
            "link": "https://leetcode.com/problems/climbing-stairs/",
            "pattern": Pattern.DP_1D,
            "difficulty": Difficulty.EASY,
            "notes": "",
        },
    ]


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"Union Find": {}}, "Unknown category 'Union Find'"),
        ({"Stack": {"Valid Parentheses": {"difficulty": "Easy"}}}, "Bad entry 'Valid Parentheses'"),
        (
            {"Stack": {"X": {"url": "https://example.com/", "difficulty": "Easy"}}},
            "Bad entry 'X'",
        ),
        (
            {"Stack": {"X": {"url": "https://leetcode.com/problems/x/", "difficulty": "Brutal"}}},
            "Bad entry 'X'",
        ),
    ],
)
def test_parse_rejects_bad_input(data, message):
    with pytest.raises(ValueError, match=message):
        parse(data)


def test_seed_skips_problems_already_saved(db):
    db.add(
        Problem(
            title="My own title",
            link="https://leetcode.com/problems/contains-duplicate/",
            pattern=Pattern.HEAP,
            difficulty=Difficulty.MEDIUM,
        )
    )
    db.flush()

    assert seed(db, parse(SAMPLE)) == 1
    assert seed(db, parse(SAMPLE)) == 0  # re-running adds nothing

    titles = db.scalars(select(Problem.title).order_by(Problem.title)).all()
    assert titles == ["Climbing Stairs", "My own title"]  # existing row untouched

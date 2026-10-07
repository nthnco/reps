import pytest

from app.db import normalize_database_url


@pytest.mark.parametrize(
    "given, expected",
    [
        (
            "postgresql://u:p@ep-x.neon.tech/reps?sslmode=require",
            "postgresql+psycopg://u:p@ep-x.neon.tech/reps?sslmode=require",
        ),
        ("postgres://u:p@host/reps", "postgresql+psycopg://u:p@host/reps"),
        ("postgresql+psycopg://u:p@host/reps", "postgresql+psycopg://u:p@host/reps"),
    ],
)
def test_normalize_database_url(given, expected):
    assert normalize_database_url(given) == expected

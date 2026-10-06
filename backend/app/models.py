"""Database models. Never store LeetCode problem statements (see CLAUDE.md)."""

import enum
from datetime import date

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    MetaData,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    # Deterministic constraint names, so later migrations can drop/alter them by name.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class Pattern(enum.StrEnum):
    ARRAYS_HASHING = "arrays_hashing"
    TWO_POINTERS = "two_pointers"
    SLIDING_WINDOW = "sliding_window"
    STACK = "stack"
    BINARY_SEARCH = "binary_search"
    LINKED_LIST = "linked_list"
    TREES = "trees"
    TRIES = "tries"
    HEAP = "heap"
    BACKTRACKING = "backtracking"
    GRAPHS = "graphs"
    ADVANCED_GRAPHS = "advanced_graphs"
    DP_1D = "dp_1d"
    DP_2D = "dp_2d"
    GREEDY = "greedy"
    INTERVALS = "intervals"
    MATH_GEOMETRY = "math_geometry"
    BIT_MANIPULATION = "bit_manipulation"


class Difficulty(enum.StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


def _string_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    # VARCHAR + CHECK instead of a native Postgres enum, which is awkward to
    # alter in migrations. Store the lowercase values, not the member names.
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda e: [m.value for m in e],
    )


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    # Normalized to https://leetcode.com/problems/<slug>/ (see schemas.py), so
    # the same problem pasted with a different URL shape is still a duplicate.
    link: Mapped[str] = mapped_column(String(500), unique=True)
    pattern: Mapped[Pattern] = mapped_column(_string_enum(Pattern, "pattern"))
    difficulty: Mapped[Difficulty] = mapped_column(
        _string_enum(Difficulty, "difficulty")
    )
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")

    attempts: Mapped[list["Attempt"]] = relationship(
        back_populates="problem", cascade="all, delete-orphan"
    )


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    problem_id: Mapped[int] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), index=True
    )
    attempted_on: Mapped[date]
    solved: Mapped[bool]
    duration_seconds: Mapped[int]
    confidence: Mapped[int] = mapped_column(SmallInteger)
    used_hint: Mapped[bool] = mapped_column(default=False, server_default="false")

    problem: Mapped[Problem] = relationship(back_populates="attempts")

    __table_args__ = (
        CheckConstraint("duration_seconds >= 0", name="duration_nonnegative"),
        CheckConstraint("confidence BETWEEN 1 AND 5", name="confidence_range"),
    )

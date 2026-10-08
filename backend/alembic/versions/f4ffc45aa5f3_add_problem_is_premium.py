"""add problem is_premium

Revision ID: f4ffc45aa5f3
Revises: e4d957687cae
Create Date: 2026-10-08 16:08:05.357255

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4ffc45aa5f3'
down_revision: Union[str, Sequence[str], None] = 'e4d957687cae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# The NeetCode 150's LeetCode Premium problems, in normalize_leetcode_link's
# output form. Listed by hand: whether a problem is Premium isn't fetched.
PREMIUM_LINKS = [
    f"https://leetcode.com/problems/{slug}/"
    for slug in [
        "encode-and-decode-strings",
        "walls-and-gates",
        "graph-valid-tree",
        "number-of-connected-components-in-an-undirected-graph",
        "alien-dictionary",
        "meeting-rooms",
        "meeting-rooms-ii",
    ]
]


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "problems",
        sa.Column("is_premium", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        sa.text("UPDATE problems SET is_premium = true WHERE link = ANY(:links)")
        .bindparams(links=PREMIUM_LINKS)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("problems", "is_premium")

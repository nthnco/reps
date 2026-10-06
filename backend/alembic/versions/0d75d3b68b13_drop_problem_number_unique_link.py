"""drop problem number, make normalized link unique

Revision ID: 0d75d3b68b13
Revises: b956df9fbdf5
Create Date: 2026-10-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d75d3b68b13'
down_revision: Union[str, Sequence[str], None] = 'b956df9fbdf5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(op.f('uq_problems_number'), 'problems', type_='unique')
    op.drop_constraint(op.f('ck_problems_number_positive'), 'problems', type_='check')
    op.drop_column('problems', 'number')
    # Rows saved before this migration may hold un-normalized links; rewrite
    # them the same way schemas.normalize_leetcode_link does. If two rows were
    # the same problem, the unique constraint below fails and says so.
    op.execute(
        "UPDATE problems SET link = 'https://leetcode.com/problems/' "
        "|| lower(substring(link from '/problems/([^/?#]+)')) || '/'"
    )
    op.create_unique_constraint(op.f('uq_problems_link'), 'problems', ['link'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f('uq_problems_link'), 'problems', type_='unique')
    # The old numbers are gone, so the column comes back nullable.
    op.add_column('problems', sa.Column('number', sa.Integer(), nullable=True))
    op.create_check_constraint(op.f('ck_problems_number_positive'), 'problems', 'number > 0')
    op.create_unique_constraint(op.f('uq_problems_number'), 'problems', ['number'])

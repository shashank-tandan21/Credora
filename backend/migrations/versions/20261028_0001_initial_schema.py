"""Create the initial persistence schema."""

from alembic import op

from app.models import Base
import app.models  # noqa: F401


revision = "20261028_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)

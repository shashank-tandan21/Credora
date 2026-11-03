"""Add persisted assessment components and loan schedules."""

from alembic import op
import sqlalchemy as sa


revision = "20261103_0002"
down_revision = "20261028_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "components" not in {column["name"] for column in inspector.get_columns("credit_assessments")}:
        op.add_column(
            "credit_assessments",
            sa.Column("components", sa.Text(), nullable=False, server_default="[]"),
        )
    if "installments" not in {column["name"] for column in inspector.get_columns("loans")}:
        op.add_column(
            "loans",
            sa.Column("installments", sa.Text(), nullable=False, server_default="[]"),
        )

    constraints = {
        constraint["name"]
        for table in ("loans", "repayments", "recovery_requests", "recovery_milestones")
        for constraint in inspector.get_check_constraints(table)
    }
    definitions = (
        ("loans", "ck_loans_principal_positive", "principal_amount > 0"),
        ("loans", "ck_loans_interest_nonnegative", "interest_amount >= 0"),
        ("loans", "ck_loans_total_not_below_principal", "total_repayment >= principal_amount"),
        ("loans", "ck_loans_duration_positive", "duration_days > 0"),
        ("repayments", "ck_repayments_principal_nonnegative", "principal_amount >= 0"),
        ("repayments", "ck_repayments_interest_nonnegative", "interest_amount >= 0"),
        ("repayments", "ck_repayments_amount_positive", "amount > 0"),
        ("repayments", "ck_repayments_installment_positive", "installment_number > 0"),
        ("recovery_requests", "ck_recovery_total_positive", "proposed_total > 0"),
        ("recovery_milestones", "ck_recovery_milestone_amount_positive", "amount > 0"),
    )
    for table, name, condition in definitions:
        if name not in constraints:
            op.create_check_constraint(name, table, condition)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "installments" in {column["name"] for column in inspector.get_columns("loans")}:
        op.drop_column("loans", "installments")
    if "components" in {column["name"] for column in inspector.get_columns("credit_assessments")}:
        op.drop_column("credit_assessments", "components")

"""add invitation activity enums

Revision ID: add_invitation_activity_enums
Revises: 
Create Date: 2026-08-22

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "8f3b2c1d4a56"
down_revision = "d72c7196a552"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing enum values to activitytype
    op.execute("ALTER TYPE activitytype ADD VALUE IF NOT EXISTS 'USER_INVITED'")
    op.execute("ALTER TYPE activitytype ADD VALUE IF NOT EXISTS 'USER_INVITE_ACCEPTED'")
    op.execute("ALTER TYPE activitytype ADD VALUE IF NOT EXISTS 'USER_INVITE_CANCELLED'")
    op.execute("ALTER TYPE activitytype ADD VALUE IF NOT EXISTS 'USER_INVITE_RESENT'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values
    pass
"""implement_pharmacy_and_inventory_ledger

Revision ID: d1a4f78ade9b
Revises: 82186647dea4
Create Date: 2026-05-15 12:24:33.783779

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd1a4f78ade9b'
down_revision: Union[str, Sequence[str], None] = '82186647dea4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Create Pharmacy Inventory Table
    op.create_table('pharmacy_inventory',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('hospital_id', sa.Uuid(), nullable=False),
        sa.Column('item_name', sa.String(length=255), nullable=False),
        sa.Column('generic_name', sa.String(length=255), nullable=True),
        sa.Column('batch_number', sa.String(length=100), nullable=False),
        sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('stock_quantity', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('reorder_level', sa.Float(), nullable=False),
        sa.Column('hsn_code', sa.String(length=20), nullable=True),
        sa.Column('tax_percent', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('pharmacy_inventory', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_pharmacy_inventory_batch_number'), ['batch_number'], unique=False)
        batch_op.create_index(batch_op.f('ix_pharmacy_inventory_hospital_id'), ['hospital_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_pharmacy_inventory_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_pharmacy_inventory_item_name'), ['item_name'], unique=False)

    # 2. Create Inventory Transactions Table
    op.create_table('inventory_transactions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('hospital_id', sa.Uuid(), nullable=False),
        sa.Column('inventory_item_id', sa.Uuid(), nullable=False),
        sa.Column('transaction_type', sa.Enum('PURCHASE', 'SALE', 'ADJUSTMENT', 'EXPIRY', 'RETURN', name='inventorytransactiontype'), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('reference_id', sa.Uuid(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['pharmacy_inventory.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inventory_transactions_hospital_id'), ['hospital_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_transactions_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_transactions_inventory_item_id'), ['inventory_item_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_transactions_reference_id'), ['reference_id'], unique=False)

def downgrade() -> None:
    op.drop_table('inventory_transactions')
    op.drop_table('pharmacy_inventory')

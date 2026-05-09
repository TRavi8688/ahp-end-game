import os
import re

path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\1bc750f88bb4_add_multi_tenant_hospital_structure.py'

if os.path.exists(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # Replace batch_op.add_column(sa.Column('signature'...) with a raw SQL ADD COLUMN IF NOT EXISTS
    # and do the same for prev_hash
    content = content.replace(
        "batch_op.add_column(sa.Column('signature', sa.String(length=255), nullable=True))",
        "op.execute(sa.text('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS signature VARCHAR(255)'))"
    )
    content = content.replace(
        "batch_op.add_column(sa.Column('prev_hash', sa.String(length=255), nullable=True))",
        "op.execute(sa.text('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(255)'))"
    )
    
    # Do the same for 9317d6acb6e0
    path2 = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'
    if os.path.exists(path2):
        with open(path2, 'r') as f:
            content2 = f.read()
        content2 = content2.replace(
            "batch_op.add_column(sa.Column('signature', sa.String(length=255), nullable=True))",
            "op.execute(sa.text('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS signature VARCHAR(255)'))"
        )
        content2 = content2.replace(
            "batch_op.add_column(sa.Column('prev_hash', sa.String(length=255), nullable=True))",
            "op.execute(sa.text('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(255)'))"
        )
        with open(path2, 'w') as f:
            f.write(content2)

    with open(path, 'w') as f:
        f.write(content)

print("Migrations patched with IF NOT EXISTS for audit_logs columns.")

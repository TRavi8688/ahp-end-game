import os
import re

files = [
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\1bc750f88bb4_add_multi_tenant_hospital_structure.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'
]

def robust_fix(path):
    if not os.path.exists(path): return
    with open(path, 'r') as f:
        content = f.read()
    
    # Replace all sa.Enum(...) with sa.String(50)
    # This bypasses all PostgreSQL TYPE issues while keeping the data the same
    content = re.sub(r'sa\.Enum\([^)]+\)', 'sa.String(50)', content)
    
    # Remove any manual Enum creation blocks
    lines = content.splitlines()
    new_lines = []
    skip = False
    for line in lines:
        if "# --- PostgreSQL Enum Creation" in line or "bind = op.get_bind()" in line or "if bind.dialect.name == 'postgresql':" in line:
            skip = True
            continue
        if skip:
            if "op.create_table" in line or "with op.batch_alter_table" in line or "def downgrade()" in line:
                skip = False
            else:
                continue
        new_lines.append(line)
    
    with open(path, 'w') as f:
        f.write("\n".join(new_lines))

for f in files:
    robust_fix(f)

print("Migrations refactored to use String(50) for maximum cloud reliability.")

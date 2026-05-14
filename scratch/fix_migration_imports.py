import sys

file_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\94ae1a4c2cea_hospyn_2_0_master_clinical_schema.py'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)
    if 'import sqlalchemy as sa' in line:
        new_lines.append('import app\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ FIX APPLIED: Added 'import app' to migration.")

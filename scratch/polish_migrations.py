import os

def clean_file_final(path):
    if not os.path.exists(path): return
    with open(path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    in_upgrade = False
    
    for line in lines:
        if "def upgrade()" in line:
            in_upgrade = True
            new_lines.append(line)
            continue
        if "def downgrade()" in line:
            in_upgrade = False
            new_lines.append(line)
            continue
            
        if in_upgrade:
            # Skip stray brackets or empty lines that were part of the mess
            stripped = line.strip()
            if stripped == "]" or stripped == "]," or stripped == "]]":
                continue
            # Remove redundant comments
            if "# REMOVE_ME" in line: continue
            if "# ### commands auto generated" in line and "# ### commands auto generated" in "".join(new_lines[-5:]):
                continue
            
        new_lines.append(line)

    with open(path, 'w') as f:
        f.writelines(new_lines)

files = [
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\1bc750f88bb4_add_multi_tenant_hospital_structure.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'
]

for f in files:
    clean_file_final(f)

print("Migration files polished.")

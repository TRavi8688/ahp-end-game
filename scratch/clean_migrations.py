import os

files = [
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\1bc750f88bb4_add_multi_tenant_hospital_structure.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'
]

names_to_remove = [
    ", name='messageroleenum'",
    ", name='queuestatusenum'",
    ", name='addedbyenum'",
    ", name='accesslevelenum'",
    ", name='accessstatusenum'",
    ", name='verificationstatusenum'",
    ", name='licensestatusenum'",
    ", name='recordtypeenum'",
    ", name='notificationtypeenum'",
    ", name='roleenum'",
    ", name='organizationtypeenum'"
]

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        content = f.read()
    
    for name in names_to_remove:
        content = content.replace(name, "")
    
    # Remove my manual block if it exists
    start_marker = "# --- PostgreSQL Enum Creation"
    end_marker = "# ### commands auto generated"
    if start_marker in content:
        start_idx = content.find(start_marker)
        end_idx = content.find(end_marker)
        if start_idx != -1 and end_idx != -1:
            content = content[:start_idx] + content[end_idx:]

    with open(file_path, 'w') as f:
        f.write(content)

print("Migration files cleaned.")

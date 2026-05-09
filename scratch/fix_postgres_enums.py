import os
import re

files = [
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\1bc750f88bb4_add_multi_tenant_hospital_structure.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'
]

enum_definitions = """
    # --- PostgreSQL Enum Creation (Mandatory for Cloud DBs) ---
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        enum_types = [
            ('addedbyenum', ['patient', 'doctor', 'ai', 'nurse', 'system']),
            ('roleenum', ['patient', 'doctor', 'admin', 'nurse', 'pharmacy', 'hospital_admin']),
            ('licensestatusenum', ['pending', 'verified', 'rejected']),
            ('verificationstatusenum', ['pending', 'basic_verified', 'identity_verified', 'otp_verified', 'completed']),
            ('messageroleenum', ['user', 'assistant', 'system']),
            ('queuestatusenum', ['checked_in', 'waiting_vitals', 'waiting_doctor', 'consultation', 'pharmacy', 'completed', 'cancelled']),
            ('accesslevelenum', ['read', 'write']),
            ('accessstatusenum', ['requested', 'granted', 'revoked']),
            ('recordtypeenum', ['document', 'scan', 'vitals', 'prescription', 'lab_report']),
            ('notificationtypeenum', ['alert', 'message', 'consent_request', 'consent_granted', 'system']),
            ('organizationtypeenum', ['hospital', 'pharmacy', 'lab'])
        ]
        for name, values in enum_types:
            op.execute(sa.text(f"DO $$ BEGIN CREATE TYPE {name} AS ENUM ({','.join([f"'{v}'" for v in values])}); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
"""

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if "def upgrade() -> None:" in line:
            new_lines.append(line)
            new_lines.append('    """Upgrade schema."""\n')
            new_lines.append(enum_definitions)
            # Skip the next line which is usually the docstring
            continue
        if '"""Upgrade schema."""' in line and "def upgrade()" in new_lines[-1]:
             continue
             
        # Add create_type=False to all Enum calls with a name
        # regex to find sa.Enum(...) and inject create_type=False
        if "sa.Enum" in line and "name=" in line and "create_type=" not in line:
            line = line.replace(")", ", create_type=False)")
            
        new_lines.append(line)

    with open(file_path, 'w') as f:
        f.writelines(new_lines)

print("Migration files fixed with explicit Enum creation and create_type=False.")

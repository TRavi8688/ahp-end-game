import os

files = [
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\1bc750f88bb4_add_multi_tenant_hospital_structure.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'
]

# Map of enum names to their values
enums = {
    'addedbyenum': ['patient', 'doctor', 'ai', 'nurse', 'system'],
    'roleenum': ['patient', 'doctor', 'admin', 'nurse', 'pharmacy', 'hospital_admin'],
    'licensestatusenum': ['pending', 'verified', 'rejected'],
    'verificationstatusenum': ['pending', 'basic_verified', 'identity_verified', 'otp_verified', 'completed'],
    'messageroleenum': ['user', 'assistant', 'system'],
    'queuestatusenum': ['checked_in', 'waiting_vitals', 'waiting_doctor', 'consultation', 'pharmacy', 'completed', 'cancelled'],
    'accesslevelenum': ['read', 'write'],
    'accessstatusenum': ['requested', 'granted', 'revoked'],
    'recordtypeenum': ['document', 'scan', 'vitals', 'prescription', 'lab_report'],
    'notificationtypeenum': ['alert', 'message', 'consent_request', 'consent_granted', 'system'],
    'organizationtypeenum': ['hospital', 'pharmacy', 'lab']
}

def fix_file(path):
    if not os.path.exists(path): return
    with open(path, 'r') as f:
        content = f.read()
    
    # 1. Inject the Enum Creation Block at the start of upgrade()
    enum_creation_code = """    # --- PostgreSQL Enum Creation (Mandatory for Cloud DBs) ---
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        enum_types = [
"""
    for name, values in enums.items():
        enum_creation_code += f"            ('{name}', {values}),\n"
    
    enum_creation_code += """        ]
        for name, values in enum_types:
            op.execute(sa.text(f"DO $$ BEGIN CREATE TYPE {name} AS ENUM ({','.join([f\\"'{{v}}'\\" for v in values])}); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
"""
    
    # Remove existing injections if any
    content = content.replace("# --- PostgreSQL Enum Creation", "# REMOVE_ME")
    # (Simplified: Just find the upgrade function and insert)
    lines = content.splitlines()
    new_lines = []
    in_upgrade = False
    injected = False
    for line in lines:
        if "def upgrade()" in line:
            in_upgrade = True
            new_lines.append(line)
            continue
        if in_upgrade and not injected:
            if '"""Upgrade schema."""' in line or "# ### commands" in line:
                new_lines.append(line)
                new_lines.append(enum_creation_code)
                injected = True
                continue
        new_lines.append(line)
    
    content = "\n".join(new_lines)
    
    # 2. Fix sa.Enum calls: Add name and create_type=False
    # Example: sa.Enum('patient', 'doctor', 'ai', 'nurse', 'system') -> sa.Enum('patient', 'doctor', 'ai', 'nurse', 'system', name='addedbyenum', create_type=False)
    for name, values in enums.items():
        val_str = ", ".join([f"'{v}'" for v in values])
        # Find sa.Enum(...) that has these values
        pattern = f"sa.Enum({val_str})"
        replacement = f"sa.Enum({val_str}, name='{name}', create_type=False)"
        content = content.replace(pattern, replacement)
        
        # Also handle cases where it might have been partially fixed
        content = content.replace(f"name='{name}', create_type=False, create_type=False", f"name='{name}', create_type=False")

    with open(path, 'w') as f:
        f.write(content)

for f in files:
    fix_file(f)

print("Migration files stabilized.")

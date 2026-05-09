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

def clean_file(path):
    if not os.path.exists(path): return
    with open(path, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    in_upgrade = False
    in_downgrade = False
    upgrade_lines = []
    downgrade_lines = []
    header_lines = []
    
    state = 'header'
    for line in lines:
        if "def upgrade()" in line:
            state = 'upgrade'
            continue
        if "def downgrade()" in line:
            state = 'downgrade'
            continue
        
        if state == 'header':
            header_lines.append(line)
        elif state == 'upgrade':
            upgrade_lines.append(line)
        elif state == 'downgrade':
            downgrade_lines.append(line)

    # Filter upgrade_lines to remove old injections and duplicate docstrings
    filtered_upgrade = []
    for line in upgrade_lines:
        if '"""Upgrade schema."""' in line: continue
        if "# --- PostgreSQL Enum Creation" in line: continue
        if "# REMOVE_ME" in line: continue
        if "bind = op.get_bind()" in line: continue
        if "if bind.dialect.name == 'postgresql':" in line: continue
        if "enum_types = [" in line: continue
        if "op.execute(sa.text" in line: continue
        if "val_str =" in line: continue
        if "EXCEPTION WHEN duplicate_object" in line: continue
        if "CREATE TYPE" in line: continue
        # Skip lines that look like they were part of the old blocks
        if any(f"'{k}'" in line for k in enums.keys()) and "[" in line and "]" in line: continue
        if "        ]" in line.strip(): continue
        if "    ]" in line.strip(): continue
        if "    for name, values in enum_types:" in line: continue
        
        # Clean sa.Enum calls in the remaining lines
        for name, values in enums.items():
             val_str = ", ".join([f"'{v}'" for v in values])
             if f"sa.Enum({val_str})" in line:
                 line = line.replace(f"sa.Enum({val_str})", f"sa.Enum({val_str}, name='{name}', create_type=False)")
             # deduplicate create_type=False
             line = line.replace("create_type=False, create_type=False", "create_type=False")
             
        filtered_upgrade.append(line)

    # Reconstruct the file
    final_content = "".join(header_lines)
    final_content += "def upgrade() -> None:\n"
    final_content += '    """Upgrade schema."""\n'
    
    # Insert ONE clean enum block
    final_content += "    # --- PostgreSQL Enum Creation (Mandatory for Cloud DBs) ---\n"
    final_content += "    bind = op.get_bind()\n"
    final_content += "    if bind.dialect.name == 'postgresql':\n"
    for name, values in enums.items():
        val_str = ",".join([f"'{v}'" for v in values])
        final_content += f"        op.execute(sa.text(\"DO $$ BEGIN CREATE TYPE {name} AS ENUM ({val_str}); EXCEPTION WHEN duplicate_object THEN null; END $$;\"))\n"
    
    final_content += "\n".join(filtered_upgrade)
    final_content += "\ndef downgrade() -> None:\n"
    final_content += "".join(downgrade_lines)

    with open(path, 'w') as f:
        f.write(final_content)

for f in files:
    clean_file(f)

print("Migration files surgically cleaned.")

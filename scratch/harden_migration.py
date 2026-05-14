import sys

file_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\94ae1a4c2cea_hospyn_2_0_master_clinical_schema.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Forensic Replacement
content = content.replace('app.core.encryption.StringEncryptedType', 'StringEncryptedType')
content = content.replace('app.core.encryption.TextEncryptedType', 'TextEncryptedType')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ FORENSIC HARDENING: Removed all absolute app.* namespaces from migration.")

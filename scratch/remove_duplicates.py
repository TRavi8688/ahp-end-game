import os
import re

path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions\9317d6acb6e0_add_token_version_to_users.py'

if os.path.exists(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # Tables that are already created in 1bc750f88bb4
    duplicate_tables = [
        'job_failures',
        'departments',
        'messages',
        'queue_entries',
        'staff_profiles',
        'record_shares'
    ]
    
    for table in duplicate_tables:
        # Regex to remove op.create_table(table, ...) and its indices
        # This is simplified: remove the block from op.create_table(table to next op.create_table or with op.batch_alter_table
        pattern = rf"op\.create_table\('{table}',.*?\)\n\s+with op\.batch_alter_table\('{table}',.*?\)\n\s+batch_op\.create_index\(.*?\)\n\s+batch_op\.create_index\(.*?\)\n"
        content = re.sub(pattern, "", content, flags=re.DOTALL)
        
        # Also remove if it's just the table without index
        pattern2 = rf"op\.create_table\('{table}',.*?\)\n"
        content = re.sub(pattern2, "", content, flags=re.DOTALL)
        
        # Also remove indices separately if they remained
        pattern3 = rf"with op\.batch_alter_table\('{table}',.*?\)\n\s+batch_op\.create_index\(.*?\)\n"
        content = re.sub(pattern3, "", content, flags=re.DOTALL)

    with open(path, 'w') as f:
        f.write(content)

print("Duplicate table creations removed from 9317d6acb6e0.")

import os
import re

dir_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions'
files = [f for f in os.listdir(dir_path) if f.endswith('.py')]

for f in files:
    path = os.path.join(dir_path, f)
    with open(path, 'r') as file:
        content = file.read()
    
    # Replace batch_op.drop_index(batch_op.f('ix_...')) with op.execute(DROP INDEX IF EXISTS ...)
    # This is a bit tricky with regex, so we'll do it carefully
    
    def replace_drop_index(match):
        idx_name_match = re.search(r"ix_\w+", match.group(0))
        if idx_name_match:
            idx_name = idx_name_match.group(0)
            return f"op.execute(sa.text('DROP INDEX IF EXISTS {idx_name}'))"
        return match.group(0)

    new_content = re.sub(r"batch_op\.drop_index\(.*?\)", replace_drop_index, content)
    new_content = re.sub(r"op\.drop_index\(.*?\)", replace_drop_index, new_content)

    if new_content != content:
        with open(path, 'w') as file:
            file.write(new_content)
        print(f"Patched {f} with safe index drops.")

print("All migrations patched with DROP INDEX IF EXISTS.")

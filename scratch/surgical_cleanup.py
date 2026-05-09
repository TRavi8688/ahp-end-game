import os
import re

dir_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions'
files = [f for f in os.listdir(dir_path) if f.endswith('.py')]

for f in files:
    path = os.path.join(dir_path, f)
    with open(path, 'r') as file:
        content = file.read()
    
    # Fix the unmatched brackets carefully
    # Looking for op.execute(sa.text('DROP INDEX IF EXISTS ...')) followed by one or more extra )
    new_content = re.sub(r"(op\.execute\(sa\.text\('DROP INDEX IF EXISTS .*?'\)\))\)+", r"\1", content)
    
    if new_content != content:
        with open(path, 'w') as file:
            file.write(new_content)
        print(f"Surgically fixed {f}")

print("All migrations surgically cleaned.")

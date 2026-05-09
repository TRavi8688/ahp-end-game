import os
import re

dir_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions'
files = [f for f in os.listdir(dir_path) if f.endswith('.py')]

for f in files:
    path = os.path.join(dir_path, f)
    with open(path, 'r') as file:
        lines = file.readlines()
    
    new_lines = []
    for line in lines:
        if "DROP INDEX IF EXISTS" in line:
            # Fix the unmatched closing bracket
            # Count opening vs closing
            open_count = line.count('(')
            close_count = line.count(')')
            if close_count > open_count:
                line = line.rstrip()
                while line.endswith(')') and line.count(')') > line.count('('):
                    line = line[:-1]
                line += ")\n"
        new_lines.append(line)

    with open(path, 'w') as file:
        file.writelines(new_lines)

print("Migration syntax polished.")

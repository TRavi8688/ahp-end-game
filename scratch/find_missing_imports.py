import os
import re

root = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o'
for dirpath, _, filenames in os.walk(root):
    if 'node_modules' in dirpath or '.git' in dirpath:
        continue
    for f in filenames:
        if f.endswith('.py'):
            path = os.path.join(dirpath, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                if 'Optional' in content:
                    # Check if 'Optional' is imported
                    import_match = re.search(r'from typing import (.*)', content)
                    if import_match:
                        imports = import_match.group(1)
                        if 'Optional' not in imports:
                            print(f"MISSING IMPORT: {path}")
                    elif 'import typing' not in content:
                        print(f"NO TYPING IMPORT: {path}")
            except:
                pass

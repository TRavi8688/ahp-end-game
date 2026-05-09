import os
import re

root = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o'
for dirpath, _, filenames in os.walk(root):
    if any(x in dirpath for x in ['node_modules', '.git', 'venv', '__pycache__', 'scratch']):
        continue
    for f in filenames:
        if f.endswith('.py'):
            path = os.path.join(dirpath, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Check for 'Optional' usage
                if re.search(r'\bOptional\b', content):
                    # Check if 'Optional' is imported properly
                    # 1. from typing import ..., Optional, ...
                    # 2. import typing (then it would be typing.Optional, but many use Optional directly)
                    
                    has_proper_import = False
                    # Pattern for 'from typing import ... Optional'
                    if re.search(r'from typing import [^#\n]*\bOptional\b', content):
                        has_proper_import = True
                    
                    if not has_proper_import:
                        # Maybe it's imported as something else or typing.Optional is used?
                        # If Optional is used directly but not in 'from typing import', it's a bug.
                        if not re.search(r'typing\.Optional', content):
                             print(f"DEFECTIVE: {path}")
            except:
                pass

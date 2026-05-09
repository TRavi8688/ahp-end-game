import os
import re

root = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o'
for dirpath, _, filenames in os.walk(root):
    if any(x in dirpath for x in ['node_modules', '.git', 'venv', '__pycache__']):
        continue
    for f in filenames:
        if f.endswith('.py'):
            path = os.path.join(dirpath, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Simple check for 'Optional' usage (not in a comment/string is hard, but let's try)
                if 'Optional[' in content:
                    # Check if 'Optional' is imported
                    has_import = False
                    if 'from typing import' in content:
                        import_match = re.search(r'from typing import (.*)', content)
                        if import_match and 'Optional' in import_match.group(1):
                            has_import = True
                    elif 'import typing' in content:
                        has_import = True
                    
                    if not has_import:
                        print(f"STILL MISSING: {path}")
            except:
                pass

import os
import re

root = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o'
dirs = ['app', 'tests']

for d in dirs:
    base_path = os.path.join(root, d)
    if not os.path.exists(base_path): continue
    for dirpath, _, filenames in os.walk(base_path):
        for f in filenames:
            if f.endswith('.py'):
                path = os.path.join(dirpath, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        content = file.read()
                    
                    if 'Optional' in content:
                        # Case 1: 'from typing import ...' exists but missing Optional
                        match = re.search(r'from typing import (.*)', content)
                        if match:
                            imports = match.group(1)
                            if 'Optional' not in imports:
                                new_line = match.group(0) + ", Optional"
                                content = content.replace(match.group(0), new_line)
                                with open(path, 'w', encoding='utf-8') as file:
                                    file.write(content)
                                print(f"UPDATED: {path}")
                        # Case 2: 'from typing import' doesn't exist at all
                        elif 'import typing' not in content:
                            content = "from typing import Optional\n" + content
                            with open(path, 'w', encoding='utf-8') as file:
                                file.write(content)
                            print(f"ADDED: {path}")
                except Exception as e:
                    print(f"ERROR processing {path}: {e}")

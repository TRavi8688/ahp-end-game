import os
import re

files = [
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\app\api\staff.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\app\core\encryption.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\app\models\verification.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\app\services\bed_service.py',
    r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\app\services\staff_service.py'
]

def fix_file(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'Optional' in content:
        if 'from typing import' in content:
            # Check if Optional is already in the import list
            match = re.search(r'from typing import (.*)', content)
            if match and 'Optional' not in match.group(1):
                new_import = match.group(0) + ", Optional"
                content = content.replace(match.group(0), new_import)
                print(f"Updated typing import in {path}")
        else:
            # Add the import at the top
            content = "from typing import Optional\n" + content
            print(f"Added typing import to {path}")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

for f in files:
    fix_file(f)

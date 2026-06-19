import ast
import os
import glob

def check_file(path):
    with open(path, "r", encoding="utf-8") as f:
        source = f.read()
        
    try:
        tree = ast.parse(source)
    except Exception as e:
        return
        
    has_optional_import = False
    has_optional_usage = False
    
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module == "typing":
                for alias in node.names:
                    if alias.name == "Optional":
                        has_optional_import = True
        elif isinstance(node, ast.Name):
            if node.id == "Optional":
                has_optional_usage = True
                
    if has_optional_usage and not has_optional_import:
        print(f"Missing Optional import: {path}")

for root, _, files in os.walk("app/api"):
    for file in files:
        if file.endswith(".py"):
            check_file(os.path.join(root, file))

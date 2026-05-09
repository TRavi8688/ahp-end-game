import ast
import os

root = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o'

def check_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        
        # We need to find all names and check if they are defined
        # This is hard to do perfectly with just AST, but we can look for 'Optional' specifically
        # and check if 'typing' is imported.
        
        has_optional = False
        has_optional_import = False
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and node.id == 'Optional':
                has_optional = True
            if isinstance(node, ast.ImportFrom) and node.module == 'typing':
                for alias in node.names:
                    if alias.name == 'Optional':
                        has_optional_import = True
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == 'typing':
                         # If they use typing.Optional, our node.id == 'Optional' check might miss it
                         # But usually people do 'from typing import Optional'
                         pass
        
        if has_optional and not has_optional_import:
            # Check if it's used as typing.Optional (which is an attribute)
            is_typing_dot_optional = False
            for node in ast.walk(tree):
                if isinstance(node, ast.Attribute) and node.attr == 'Optional':
                    if isinstance(node.value, ast.Name) and node.value.id == 'typing':
                        is_typing_dot_optional = True
            
            if not is_typing_dot_optional:
                print(f"LINT ERROR: {path} uses 'Optional' but doesn't import it from typing.")
                
    except SyntaxError as e:
        print(f"SYNTAX ERROR: {path} - {e}")
    except Exception as e:
        pass

for dirpath, _, filenames in os.walk(root):
    if any(x in dirpath for x in ['node_modules', '.git', 'venv', '__pycache__', 'scratch']):
        continue
    for f in filenames:
        if f.endswith('.py'):
            check_file(os.path.join(dirpath, f))

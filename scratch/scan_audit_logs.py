import os

dir_path = r'c:\Users\DELL\OneDrive\Desktop\ahp\ahp.2.o\alembic\versions'
files = [f for f in os.listdir(dir_path) if f.endswith('.py')]

for f in files:
    path = os.path.join(dir_path, f)
    with open(path, 'r') as file:
        content = file.read()
        if 'audit_logs' in content and 'signature' in content:
            print(f"{f}: Found audit_logs and signature")
            if 'op.add_column' in content or 'batch_op.add_column' in content:
                print(f"  -> Migration adds signature column")

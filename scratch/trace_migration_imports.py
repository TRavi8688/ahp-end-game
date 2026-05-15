import sys
import os
import importlib.util

# Ensure app is in path
sys.path.append(os.getcwd())

def trace_imports(module_name, path):
    print(f"--- Tracing: {module_name} ---")
    
    # Capture initial modules
    initial_modules = set(sys.modules.keys())
    
    try:
        spec = importlib.util.spec_from_file_location(module_name, path)
        module = importlib.util.module_from_spec(spec)
        # Mock alembic context
        import unittest.mock
        sys.modules['alembic'] = unittest.mock.MagicMock()
        sys.modules['alembic.context'] = unittest.mock.MagicMock()
        
        spec.loader.exec_module(module)
    except Exception as e:
        print(f"LOAD_FAILURE: {e}")
        # We continue to check what was loaded even on partial failure
        
    # Capture final modules
    final_modules = set(sys.modules.keys())
    new_modules = final_modules - initial_modules
    
    # Audit for forbidden modules
    forbidden = [
        'app.core.config', 
        'app.services', 
        'redis', 
        'fastapi', 
        'app.main',
        'dotenv'
    ]
    
    violations = []
    for mod in new_modules:
        for f in forbidden:
            if mod.startswith(f):
                violations.append(mod)
    
    if violations:
        print(f"VIOLATIONS DETECTED: {len(violations)} forbidden modules loaded.")
        for v in sorted(violations):
            print(f"   - {v}")
    else:
        print("PURITY_VERIFIED: No runtime dependencies loaded.")

if __name__ == "__main__":
    # 1. Trace Master Migration
    trace_imports("master_migration", "alembic/versions/94ae1a4c2cea_hospyn_2_0_master_clinical_schema.py")
    print("\n" + "="*40 + "\n")
    # 2. Trace env.py (this WILL load config because it needs it, but we check if it's the ONLY violation)
    trace_imports("alembic_env", "alembic/env.py")

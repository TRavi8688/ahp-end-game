import os
import difflib
from pathlib import Path

REPO_ROOT = Path(r"c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new")
PHASE_ROOT = Path(r"C:\Users\DELL\Downloads")

# Mapping of phase directories to their expected root in the main repo
PHASE_MAPPINGS = {
    "phase-1": REPO_ROOT, # Migrations usually go to alembic/versions, root files to root
    "phase-2": REPO_ROOT / "backend" / "notification-service",
    "phase-3": REPO_ROOT, # Needs special handling depending on file (auth vs github)
    "phase-4": REPO_ROOT / "backend" / "ai-service",
    "phase-5/hospyn-phase5": REPO_ROOT,
    "phase-6/hospyn-phase6": REPO_ROOT,
    "phase-7": REPO_ROOT,
    "phase-8/hospyn-phase8": REPO_ROOT,
}

IGNORE_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build"}
IGNORE_EXTS = {".tar.gz", ".zip", ".pyc", ".png", ".jpg", ".jpeg", ".ico"}

def resolve_target_path(phase_name, file_path, rel_path):
    # Custom routing rules based on my knowledge of the phases
    parts = list(rel_path.parts)
    
    if phase_name == "phase-1":
        if "alembic" not in parts and parts[0].endswith(".py"):
            return REPO_ROOT / "alembic" / "versions" / parts[0]
        return REPO_ROOT / rel_path
        
    elif phase_name == "phase-3":
        if parts[0] == "deploy.yml":
            return REPO_ROOT / ".github" / "workflows" / "deploy.yml"
        elif parts[0] == "REQUIRED_SECRETS.md":
            return REPO_ROOT / ".github" / "REQUIRED_SECRETS.md"
        elif parts[0] in ["auth.py"]:
            return REPO_ROOT / "backend" / "auth-service" / "app" / "api" / "v1" / "auth.py"
        elif parts[0] == "main.py":
            return REPO_ROOT / "backend" / "auth-service" / "app" / "main.py"
        elif parts[0] == "security.py":
            return REPO_ROOT / "backend" / "auth-service" / "app" / "core" / "security.py"
        elif parts[0] == "requirements.txt":
            return REPO_ROOT / "backend" / "auth-service" / "requirements.txt"
            
    elif phase_name == "phase-4":
        if parts[0] == "main.py":
            return REPO_ROOT / "backend" / "ai-service" / "app" / "main.py"
        elif parts[0] == "settings.py":
            return REPO_ROOT / "backend" / "ai-service" / "app" / "config" / "settings.py"
        elif parts[0] == "test_ai_integration.py":
            return REPO_ROOT / "backend" / "ai-service" / "tests" / "test_ai_integration.py"
        elif parts[0] == ".env.example":
            return REPO_ROOT / "backend" / "ai-service" / ".env.example"
        elif parts[0] == "requirements.txt":
            return REPO_ROOT / "backend" / "ai-service" / "requirements.txt"
            
    elif phase_name == "phase-7":
        if parts[0] == "deploy.yml":
            return REPO_ROOT / ".github" / "workflows" / "deploy.yml"
            
    # Default routing
    return PHASE_MAPPINGS.get(phase_name, REPO_ROOT) / rel_path

def diff_files(source_path, target_path):
    try:
        with open(source_path, 'r', encoding='utf-8') as f:
            src_lines = f.readlines()
        with open(target_path, 'r', encoding='utf-8') as f:
            tgt_lines = f.readlines()
            
        diff = list(difflib.unified_diff(
            src_lines, tgt_lines,
            fromfile=f"PHASE: {source_path.name}",
            tofile=f"REPO: {target_path.name}",
            n=0
        ))
        return "".join(diff)
    except Exception as e:
        return f"Error reading files: {e}"

results = []

for phase_key in PHASE_MAPPINGS:
    phase_dir = PHASE_ROOT / phase_key
    if not phase_dir.exists():
        continue
        
    for root, dirs, files in os.walk(phase_dir):
        # Mutate dirs in-place to ignore certain directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for file in files:
            if any(file.endswith(ext) for ext in IGNORE_EXTS):
                continue
                
            src_path = Path(root) / file
            rel_path = src_path.relative_to(phase_dir)
            
            tgt_path = resolve_target_path(phase_key, src_path, rel_path)
            
            if not tgt_path.exists():
                results.append(f"MISSING: {tgt_path} (from {phase_key})")
                continue
                
            diff = diff_files(src_path, tgt_path)
            if diff:
                results.append(f"DIFF FOUND: {tgt_path} (from {phase_key})\n```diff\n{diff[:1000]}{'...' if len(diff) > 1000 else ''}\n```")

report_path = REPO_ROOT / "line_by_line_audit.md"
with open(report_path, "w", encoding="utf-8") as f:
    f.write("# Line-by-Line Audit Report\n\n")
    if not results:
        f.write("Perfect match! No missing files or code drift found.\n")
    else:
        f.write("\n\n".join(results))

print(f"Audit complete. Results written to {report_path}")

import os
import re

# Configurations
SEARCH_PATH = "."
REPLACEMENTS = {
    # Case-sensitive mappings
    r"AHP": "Hospyn",
    r"ahp": "hospyn",
    r"Ahp": "Hospyn",
}

EXCLUDE_DIRS = {
    ".git", "venv", ".next", "node_modules", "build", "web-build", 
    ".gemini", ".system_generated", "knowledge", "brain", ".expo", 
    ".vscode", "__pycache__"
}
EXCLUDE_FILES = {"ahp.db", "fix_branding.py", "package-lock.json", "yarn.lock"}

def migrate_branding():
    print("Starting Refined Global Migration: AHP -> Hospyn...")
    
    for root, dirs, files in os.walk(SEARCH_PATH):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        
        for file in files:
            if file in EXCLUDE_FILES or file.endswith(".db") or file.endswith(".png") or file.endswith(".jpg"):
                continue
                
            file_path = os.path.join(root, file)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                
                # Protect GCP IDs and GCS Buckets (both contain 'ahp')
                # These are strictly lowercase in the config usually.
                placeholder_project = "PROTECTED_GCP_PROJECT_ID"
                placeholder_bucket = "PROTECTED_GCS_BUCKET_NAME"
                
                # Protect 'ahp2o-495503'
                new_content = new_content.replace("ahp2o-495503-storage", placeholder_bucket)
                new_content = new_content.replace("ahp2o-495503", placeholder_project)
                
                # Protect environment variable KEYS (AHP_DATABASE_URL etc) if user wants to keep them
                # User said: "Secret Manager Keys: (Legacy names will be kept to maintain connection)"
                # This usually refers to the environment variable names.
                # Regex to find AHP_ prefix followed by CAPS
                env_vars = re.findall(r"AHP_[A-Z_]+", new_content)
                env_placeholders = {}
                for i, var in enumerate(set(env_vars)):
                    ph = f"ENV_VAR_PH_{i}"
                    env_placeholders[ph] = var
                    new_content = new_content.replace(var, ph)

                # Global Case-Sensitive Replacements
                new_content = new_content.replace("AHP", "Hospyn")
                new_content = new_content.replace("ahp", "hospyn")
                new_content = new_content.replace("Ahp", "Hospyn")
                
                # Restore environment variables
                for ph, var in env_placeholders.items():
                    new_content = new_content.replace(ph, var)

                # Restore GCP IDs
                new_content = new_content.replace(placeholder_bucket, "ahp2o-495503-storage")
                new_content = new_content.replace(placeholder_project, "ahp2o-495503")
                
                if new_content != content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated: {file_path}")
                    
            except (UnicodeDecodeError, PermissionError):
                continue

if __name__ == "__main__":
    migrate_branding()
    print("Migration to Hospyn Complete.")

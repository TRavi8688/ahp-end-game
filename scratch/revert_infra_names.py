import os

path = '.github/workflows/deploy-ecosystem.yml'
with open(path, 'r') as f:
    content = f.read()

# Revert infrastructure identifiers that must match GCP resources
replacements = {
    "hospyn-repo": "ahp-repo",
    "hospyn-backend": "ahp-backend",
    "hospyn-api": "ahp-api",
    "hospyn-worker": "ahp-worker",
    "hospyn-vpc": "ahp-vpc",
    "hospyn-subnet": "ahp-subnet"
}

new_content = content
for old, new in replacements.items():
    new_content = new_content.replace(old, new)

if new_content != content:
    with open(path, 'w') as f:
        f.write(new_content)
    print("SUCCESS: Reverted infrastructure identifiers to match GCP resources.")
else:
    print("No changes needed or identifiers already reverted.")

import re

path = '.github/workflows/deploy-ecosystem.yml'
with open(path, 'r') as f:
    content = f.read()

# Remove --token and its following value (quoted or unquoted)
# Pattern: --token followed by whitespace, then either a quoted string or a non-whitespace string
content = re.sub(r' --token\s+"[^"]+"', '', content)
content = re.sub(r' --token\s+\${{ secrets\.FIREBASE_TOKEN }}', '', content)

with open(path, 'w') as f:
    f.write(content)

print("SUCCESS: Removed all Firebase tokens from the workflow.")

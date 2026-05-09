import os
import subprocess
from dotenv import load_dotenv

load_dotenv()

# Secrets to migrate
secrets = [
    'DATABASE_URL',
    'SECRET_KEY',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'ENCRYPTION_KEY',
    'TWO_FACTOR_API_KEY',
    'ANTHROPIC_API_KEY',
    'SARVAM_KEY',
    'GEMINI_API_KEY',
    'GROQ_API_KEY'
]

def create_secret(name, value):
    if not value:
        print(f"Skipping {name} as it has no value.")
        return
    
    # Check if secret exists
    check = subprocess.run('gcloud secrets list --filter=name:{0} --format="value(name)"'.format(name), capture_output=True, text=True, shell=True)
    if not check.stdout.strip():
        print(f"Creating secret: {name}")
        subprocess.run('gcloud secrets create {0} --replication-policy=automatic'.format(name), check=True, shell=True)
    
    # Add version
    print(f"Adding version to secret: {name}")
    process = subprocess.Popen('gcloud secrets versions add {0} --data-file=-'.format(name), stdin=subprocess.PIPE, shell=True)
    process.communicate(input=value.encode())

for s in secrets:
    create_secret(s, os.getenv(s))

print("All secrets successfully migrated to GCP Secret Manager.")

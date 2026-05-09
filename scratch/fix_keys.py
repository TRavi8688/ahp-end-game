from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import base64
import re

# 1. Generate new keys
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
priv_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
pub_pem = private_key.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

priv_b64 = base64.b64encode(priv_pem).decode()
pub_b64 = base64.b64encode(pub_pem).decode()

# 2. Update the workflow file
path = '.github/workflows/deploy-ecosystem.yml'
with open(path, 'r') as f:
    content = f.read()

# Replace existing keys
content = re.sub(r'JWT_PRIVATE_KEY: ".*?"', f'JWT_PRIVATE_KEY: "{priv_b64}"', content)
content = re.sub(r'JWT_PUBLIC_KEY: ".*?"', f'JWT_PUBLIC_KEY: "{pub_b64}"', content)

with open(path, 'w') as f:
    f.write(content)

print("SUCCESS: Workflow updated with fresh, uncorrupted keys.")

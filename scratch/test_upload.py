import requests
import base64

url = "http://127.0.0.1:8000/api/v1/patient/chat"

# 1x1 JPEG base64
b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
img_bytes = base64.b64decode(b64)

# Create a valid token for the test user or assume endpoint requires auth.
# Actually, it requires auth! I can't easily test without a token.

print("Need auth token to test /chat endpoint.")

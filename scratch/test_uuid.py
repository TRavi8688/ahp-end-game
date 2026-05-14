import uuid
try:
    u = uuid.uuid4()
    u2 = uuid.UUID(u)
    print("Success")
except Exception as e:
    print(f"Error: {e}")

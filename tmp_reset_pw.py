
import asyncio
import sqlite3
import bcrypt
import hashlib
import base64

def _get_hashable_password(password: str) -> bytes:
    sha256_hash = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(sha256_hash)

def get_password_hash(password: str) -> str:
    password_bytes = _get_hashable_password(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")

def reset_password():
    new_password = "Password123"
    hashed = get_password_hash(new_password)
    
    conn = sqlite3.connect('test.db')
    cursor = conn.cursor()
    
    # Find user_id for Hospyn-TEST-DRIVE
    cursor.execute("SELECT user_id FROM patients WHERE hospyn_id = 'Hospyn-TEST-DRIVE'")
    row = cursor.fetchone()
    if not row:
        print("Error: Hospyn-TEST-DRIVE not found in patients table")
        return
    
    user_id = row[0]
    
    # Update users table
    cursor.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (hashed, user_id))
    conn.commit()
    print(f"Successfully reset password for Hospyn-TEST-DRIVE (User ID: {user_id}) to 'Password123'")
    conn.close()

if __name__ == "__main__":
    reset_password()

import sqlite3
import os

db_path = "hospyn_local.db" # Default name usually
if not os.path.exists(db_path):
    print(f"Database {db_path} not found. Checking .env...")
    # Try to find it in .env
    with open(".env", "r") as f:
        for line in f:
            if "DATABASE_URL" in line and "sqlite" in line:
                db_path = line.split("///")[-1].strip()
                break

if os.path.exists(db_path):
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE medical_records ADD COLUMN record_name VARCHAR(255)")
        print("Added record_name column.")
    except Exception as e:
        print(f"Error adding record_name: {e}")
        
    try:
        cursor.execute("ALTER TABLE medical_records ADD COLUMN hospital_name VARCHAR(255)")
        print("Added hospital_name column.")
    except Exception as e:
        print(f"Error adding hospital_name: {e}")
        
    conn.commit()
    conn.close()
else:
    print(f"Could not find database at {db_path}")

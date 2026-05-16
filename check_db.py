import sqlite3
import os

db_path = 'hospyn_local.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"Tables: {tables}")
    
    cursor.execute("SELECT version_num FROM alembic_version;")
    version = cursor.fetchone()
    print(f"Alembic Version: {version}")
    conn.close()
else:
    print("Database not found.")

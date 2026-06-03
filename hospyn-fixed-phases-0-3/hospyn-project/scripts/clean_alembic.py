import sqlite3

def clean_alembic_junk():
    conn = sqlite3.connect('hospyn_local.db')
    cursor = conn.cursor()
    
    # Find all temp tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '_alembic_tmp_%'")
    tables = cursor.fetchall()
    
    for table in tables:
        print(f"Dropping junk table: {table[0]}")
        cursor.execute(f"DROP TABLE {table[0]}")
    
    conn.commit()
    conn.close()
    print("Cleaned all Alembic temporary tables.")

if __name__ == "__main__":
    clean_alembic_junk()

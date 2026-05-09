
import sqlite3
conn = sqlite3.connect('test.db')
cursor = conn.cursor()
cursor.execute("SELECT count(*) FROM medical_records WHERE patient_id = (SELECT id FROM patients WHERE hospyn_id = 'Hospyn-TEST-DRIVE')")
count = cursor.fetchone()[0]
print(f"Medical Records for Hospyn-TEST-DRIVE: {count}")
conn.close()

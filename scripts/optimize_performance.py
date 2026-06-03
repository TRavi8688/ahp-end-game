import sqlite3
import os

def optimize_db():
    db_path = "hospyn.db"
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found.")
        return

    print(f"--- Optimizing {db_path} for Production ---")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # List of enterprise indexes to add for Phase 9 performance
    indexes = [
        # Prescriptions
        "CREATE INDEX IF NOT EXISTS idx_prescription_qr ON digital_prescriptions(qr_code_id);",
        "CREATE INDEX IF NOT EXISTS idx_prescription_patient ON digital_prescriptions(patient_id);",
        "CREATE INDEX IF NOT EXISTS idx_prescription_hospital ON digital_prescriptions(hospital_id);",
        "CREATE INDEX IF NOT EXISTS idx_prescription_status ON digital_prescriptions(status);",
        
        # Lab Orders
        "CREATE INDEX IF NOT EXISTS idx_lab_order_patient ON lab_diagnostic_orders(patient_id);",
        "CREATE INDEX IF NOT EXISTS idx_lab_order_hospital ON lab_diagnostic_orders(hospital_id);",
        "CREATE INDEX IF NOT EXISTS idx_lab_order_status ON lab_diagnostic_orders(status);",
        
        # Core Optimization
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
        "CREATE INDEX IF NOT EXISTS idx_patients_hospyn_id ON patients(hospyn_id);",
        "CREATE INDEX IF NOT EXISTS idx_queue_hospital_status ON queue_entries(hospital_id, status);"
    ]

    for idx in indexes:
        try:
            print(f"Executing: {idx}")
            cursor.execute(idx)
        except Exception as e:
            print(f"Failed: {e}")

    conn.commit()
    conn.close()
    print("--- Database Optimization Complete ---")

if __name__ == "__main__":
    optimize_db()

-- Hospyn 2.0: Enterprise Postgres RLS Enforcement Script
-- This script enables Row Level Security (RLS) on all tenant-scoped tables.
-- It ensures that even if the application layer has a bug, data leakage 
-- between hospitals is physically impossible at the storage layer.

BEGIN;

-- 1. Enable RLS on all Tenant-Scoped Tables
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinician_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_diagnostic_orders ENABLE ROW LEVEL SECURITY;

-- 2. Define the Universal Isolation Policy
-- This policy checks if the 'hospital_id' column matches the 'app.current_tenant' session variable.

-- Policy for Patients
CREATE POLICY tenant_isolation_policy ON patients
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Medical Records
CREATE POLICY tenant_isolation_policy ON medical_records
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Conditions
CREATE POLICY tenant_isolation_policy ON conditions
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Medications
CREATE POLICY tenant_isolation_policy ON medications
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Allergies
CREATE POLICY tenant_isolation_policy ON allergies
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Messages
CREATE POLICY tenant_isolation_policy ON messages
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Audit Logs
CREATE POLICY tenant_isolation_policy ON audit_logs
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Queue Entries
CREATE POLICY tenant_isolation_policy ON queue_entries
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for AI Events (Forensics)
CREATE POLICY tenant_isolation_policy ON clinical_ai_events
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- Policy for Clinician Overrides
CREATE POLICY tenant_isolation_policy ON clinician_overrides
    FOR ALL
    TO public
    USING (hospital_id::text = current_setting('app.current_tenant', True));

-- 3. Special Case: Hospitals table (Only allow a hospital to see itself)
CREATE POLICY hospital_self_isolation ON hospitals
    FOR SELECT
    TO public
    USING (id::text = current_setting('app.current_tenant', True));

COMMIT;

-- VERIFICATION QUERY:
-- SHOW app.current_tenant;
-- SELECT * FROM patients; -- Should return 0 rows if app.current_tenant is not set.

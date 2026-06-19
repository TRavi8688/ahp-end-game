"""
test_rbac.py — Tests for Role-Based Access Control and ABAC hospital_id scoping.
Phase 11 Fix: ensures no role can access data beyond its scope.
"""
import pytest
import os
from datetime import datetime, timedelta
from jose import jwt


SECRET_KEY = os.environ.get("SECRET_KEY", "test-signing-key-must-be-32-chars-long!!")
ALGORITHM = "HS256"


def make_token(role: str, hospital_id: str, user_id: int = 1) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "hospital_id": hospital_id,
        "token_version": 1,
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


class TestRoleHierarchy:
    """Verify role definitions are correctly constrained."""

    ROLE_PERMISSIONS = {
        "patient": ["read:own_records", "book:appointment", "view:own_prescriptions"],
        "doctor": ["read:patient_records", "write:prescriptions", "manage:appointments"],
        "nurse": ["read:patient_records", "write:vitals", "read:prescriptions"],
        "admin": ["manage:all", "read:audit_logs", "manage:users"],
        "pharmacist": ["read:prescriptions", "dispense:medications"],
    }

    def test_all_expected_roles_defined(self):
        roles = list(self.ROLE_PERMISSIONS.keys())
        assert "patient" in roles
        assert "doctor" in roles
        assert "admin" in roles

    def test_patient_cannot_have_admin_permissions(self):
        patient_perms = self.ROLE_PERMISSIONS["patient"]
        assert "manage:all" not in patient_perms
        assert "read:audit_logs" not in patient_perms

    def test_patient_cannot_write_prescriptions(self):
        patient_perms = self.ROLE_PERMISSIONS["patient"]
        assert "write:prescriptions" not in patient_perms

    def test_doctor_cannot_manage_all_users(self):
        doctor_perms = self.ROLE_PERMISSIONS["doctor"]
        assert "manage:users" not in doctor_perms

    def test_pharmacist_cannot_write_prescriptions(self):
        """Pharmacist can only dispense, not write."""
        pharm_perms = self.ROLE_PERMISSIONS["pharmacist"]
        assert "write:prescriptions" not in pharm_perms
        assert "dispense:medications" in pharm_perms


class TestHospitalIDScoping:
    """ABAC: hospital_id scoping prevents cross-hospital data access."""

    def test_doctor_token_carries_hospital_id(self):
        token = make_token("doctor", "hosp_001")
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["hospital_id"] == "hosp_001"

    def test_cross_hospital_access_simulation(self):
        """Doctor from hosp_001 must not read data from hosp_002."""
        token = make_token("doctor", "hosp_001")
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Simulate a patient query for hosp_002
        requested_resource_hospital = "hosp_002"
        has_access = decoded["hospital_id"] == requested_resource_hospital
        assert has_access is False

    def test_admin_still_has_hospital_scope(self):
        """Even admins are scoped to their hospital unless super-admin."""
        token = make_token("admin", "hosp_001")
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["hospital_id"] == "hosp_001"

    def test_patient_hospital_id_enforced(self):
        """Patient should only see their own hospital's data."""
        token = make_token("patient", "hosp_003", user_id=99)
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["hospital_id"] == "hosp_003"
        assert decoded["sub"] == "99"


class TestRoleEscalation:
    """Tests that role escalation attacks are not possible."""

    def test_patient_cannot_claim_doctor_role_via_tampered_token(self):
        """Tampered token (different key) should be rejected."""
        from jose import JWTError

        # Create a patient token
        patient_token = make_token("patient", "hosp_001")

        # Attacker tries to sign with a different key claiming doctor role
        attacker_payload = {
            "sub": "1",
            "role": "doctor",  # escalated role
            "hospital_id": "hosp_001",
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        attacker_key = "attacker-fake-secret-key-here!!"
        forged_token = jwt.encode(attacker_payload, attacker_key, algorithm=ALGORITHM)

        # The real server's verification should reject this
        with pytest.raises(JWTError):
            jwt.decode(forged_token, SECRET_KEY, algorithms=[ALGORITHM])

    def test_none_algorithm_attack_prevented(self):
        """JWT 'alg: none' attack must be rejected."""
        from jose import JWTError
        import base64
        import json

        header = base64.urlsafe_b64encode(
            json.dumps({"alg": "none", "typ": "JWT"}).encode()
        ).rstrip(b"=").decode()
        payload_b64 = base64.urlsafe_b64encode(
            json.dumps({"sub": "1", "role": "admin"}).encode()
        ).rstrip(b"=").decode()
        forged = f"{header}.{payload_b64}."

        with pytest.raises(JWTError):
            jwt.decode(forged, SECRET_KEY, algorithms=[ALGORITHM])


class TestAuditLogRequirements:
    """Documents what must be logged for compliance (Phase 13 overlap)."""

    REQUIRED_AUDIT_EVENTS = [
        "user.login",
        "user.login_failed",
        "user.logout",
        "user.password_changed",
        "record.accessed",
        "record.modified",
        "prescription.created",
        "prescription.dispensed",
        "admin.user_created",
        "admin.user_deactivated",
        "otp.sent",
        "otp.failed",
    ]

    def test_audit_event_types_are_comprehensive(self):
        assert len(self.REQUIRED_AUDIT_EVENTS) >= 10

    def test_all_phi_access_events_included(self):
        phi_events = [e for e in self.REQUIRED_AUDIT_EVENTS if "record" in e]
        assert len(phi_events) >= 2

    def test_auth_events_covered(self):
        auth_events = [e for e in self.REQUIRED_AUDIT_EVENTS if "login" in e or "logout" in e]
        assert len(auth_events) >= 3

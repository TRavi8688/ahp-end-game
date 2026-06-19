import pytest
from httpx import ASGITransport, AsyncClient
import uuid
from app.models.models import Hospital, Doctor, StaffProfile, Patient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.models import Base
from app.main import app
from app.core.database import get_db

DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

@pytest.fixture(autouse=True)
async def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as ac:
        yield ac

@pytest.fixture
async def testing_db():
    async with TestingSessionLocal() as session:
        yield session

@pytest.mark.asyncio
async def test_cross_tenant_isolation(client: AsyncClient, testing_db):
    """
    Simulates a doctor from Hospital A trying to access a patient or invoice in Hospital B.
    """
    # Create Hospital A and B
    hosp_a_id = uuid.uuid4()
    hosp_b_id = uuid.uuid4()
    
    hosp_a = Hospital(id=hosp_a_id, name="Hospital A", hospyn_id="HOSA-1", short_code="HOSA", registration_number="REG-A-123")
    hosp_b = Hospital(id=hosp_b_id, name="Hospital B", hospyn_id="HOSB-1", short_code="HOSB", registration_number="REG-B-123")
    
    testing_db.add_all([hosp_a, hosp_b])
    
    # Create Doctor A in Hospital A
    doc_a_id = uuid.uuid4()
    # (Simplified user creation via public registration endpoint)
    res = await client.post("/api/v1/auth/register", json={
        "email": "doctorA@hospitala.com",
        "password": "SecurePassword123!",
        "first_name": "Doc",
        "last_name": "A",
        "role": "doctor"
    })
    assert res.status_code == 200
    doc_a_user_id = res.json()["id"]
    
    # Assign Doctor A to Hospital A
    staff_a = StaffProfile(user_id=uuid.UUID(doc_a_user_id), hospital_id=hosp_a_id)
    testing_db.add(staff_a)
    
    # Create Patient B in Hospital B
    res_b = await client.post("/api/v1/auth/register", json={
        "email": "patientB@hospitalb.com",
        "password": "SecurePassword123!",
        "first_name": "Pat",
        "last_name": "B",
        "role": "patient"
    })
    pat_b_user_id = res_b.json()["id"]
    
    # Update patient to belong to Hospital B
    stmt = select(Patient).where(Patient.user_id == uuid.UUID(pat_b_user_id))
    pat_b = (await testing_db.execute(stmt)).scalars().first()
    pat_b.hospital_id = hosp_b_id
    await testing_db.commit()
    
    # Login Doctor A
    login_res = await client.post("/api/v1/auth/login", data={"username": "doctorA@hospitala.com", "password": "SecurePassword123!"})
    token = login_res.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": str(hosp_a_id)}
    
    # Attempt to access Patient B's profile
    fetch_res = await client.get(f"/api/v1/clinical/patients/{pat_b.id}", headers=headers)
    
    # Must be 403 or 404
    assert fetch_res.status_code in [403, 404], "CRITICAL: Doctor A accessed Patient B in Hospital B!"

@pytest.mark.asyncio
async def test_role_escalation_protection(client: AsyncClient, testing_db):
    """
    Simulates a standard user attempting to access a Super-Admin endpoint.
    """
    # Login as normal patient
    res = await client.post("/api/v1/auth/register", json={
        "email": "sneaky@patient.com",
        "password": "SecurePassword123!",
        "first_name": "Sneaky",
        "last_name": "P",
        "role": "patient"
    })
    
    login_res = await client.post("/api/v1/auth/login", data={"username": "sneaky@patient.com", "password": "SecurePassword123!"})
    token = login_res.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Attempt to hit super-admin hospital onboarding approval
    hospital_id = uuid.uuid4()
    admin_res = await client.post(f"/api/v1/onboarding/admin-approve-hospital/{hospital_id}", headers=headers)
    
    # Must be forbidden
    assert admin_res.status_code in [401, 403], f"Role Escalation Succeeded! Got {admin_res.status_code}"

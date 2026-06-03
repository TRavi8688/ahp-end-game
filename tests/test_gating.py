import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.models import User, RoleEnum, Hospital, HospitalSettings, StaffProfile, Doctor, Base
from app.api.deps import get_current_user
import uuid

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
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as ac:
        yield ac

@pytest.fixture
async def setup_gating_data():
    async with TestingSessionLocal() as session:
        # Create Hospital
        hospital = Hospital(name="Gating Hospital", hospyn_id="Hospyn-GATE", short_code="GATE", registration_number="REG-GATE")
        session.add(hospital)
        await session.flush()

        # Create Hospital Settings (disabled by default)
        settings = HospitalSettings(
            hospital_id=hospital.id,
            enable_pharmacy=False,
            enable_labs=False,
            enable_inpatient_beds=False,
            enable_hr=False,
            enable_billing=True
        )
        session.add(settings)

        # Create Staff User
        admin_user = User(
            email="admin@gating.com",
            hashed_password=get_password_hash("password"),
            role=RoleEnum.hospital_admin,
            token_version=1,
            first_name="Admin",
            last_name="User"
        )
        session.add(admin_user)
        await session.flush()

        # Create Staff Profile
        staff = StaffProfile(
            user_id=admin_user.id,
            hospital_id=hospital.id
        )
        session.add(staff)

        # Create Doctor User
        doc_user = User(
            email="doctor@gating.com",
            hashed_password=get_password_hash("password"),
            role=RoleEnum.doctor,
            token_version=1,
            first_name="Doc",
            last_name="Tor"
        )
        session.add(doc_user)
        await session.flush()

        # Create Doctor Profile
        doc_staff = StaffProfile(
            user_id=doc_user.id,
            hospital_id=hospital.id
        )
        session.add(doc_staff)

        doctor = Doctor(
            user_id=doc_user.id,
            specialty="General",
            license_number="LIC-GATING-DOC"
        )
        session.add(doctor)

        await session.commit()

        return {
            "hospital_id": hospital.id,
            "admin_user_id": admin_user.id,
            "doc_user_id": doc_user.id
        }

@pytest.mark.asyncio
async def test_pharmacy_gating_disabled(client, setup_gating_data):
    token = create_access_token(setup_gating_data["admin_user_id"], role=RoleEnum.hospital_admin.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Access v1 pharmacy endpoint
    response = await client.get("/api/v1/pharmacy/inventory", headers=headers)
    assert response.status_code == 403
    assert "not enabled" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_pharmacy_gating_enabled(client, setup_gating_data):
    token = create_access_token(setup_gating_data["admin_user_id"], role=RoleEnum.hospital_admin.value)
    headers = {"Authorization": f"Bearer {token}"}

    async with TestingSessionLocal() as session:
        result = await session.execute(
            select(HospitalSettings).where(HospitalSettings.hospital_id == setup_gating_data["hospital_id"])
        )
        settings = result.scalars().first()
        settings.enable_pharmacy = True
        await session.commit()

    response = await client.get("/api/v1/pharmacy/inventory", headers=headers)
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_admission_gating_disabled(client, setup_gating_data):
    token = create_access_token(setup_gating_data["admin_user_id"], role=RoleEnum.hospital_admin.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Access v1 admissions endpoint
    response = await client.post("/api/v1/admissions/", json={"patient_id": str(uuid.uuid4()), "queue_token_id": 1}, headers=headers)
    assert response.status_code == 403
    assert "not enabled" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_lab_order_gating_disabled(client, setup_gating_data):
    token = create_access_token(setup_gating_data["doc_user_id"], role=RoleEnum.doctor.value)
    headers = {"Authorization": f"Bearer {token}"}

    # Access clinical lab order creation endpoint
    response = await client.post("/api/v1/clinical/lab-orders", json={"patient_id": str(uuid.uuid4()), "tests": ["CBC"], "clinical_history": "Fever"}, headers=headers)
    assert response.status_code == 403
    assert "not enabled" in response.json()["detail"].lower()

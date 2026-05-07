import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient
import uuid

from app.main import app
from app.models.models import Base, User, Hospital, StaffProfile, RoleEnum
from app.core.security import get_password_hash, create_access_token
from app.core.database import get_db

# Use in-memory SQLite for testing to ensure clean state
DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac

@pytest.fixture
async def setup_data():
    async with TestingSessionLocal() as session:
        # Create Hospital A
        hosp_a = Hospital(name="Hospital A", registration_number="HOSP-A", version_id=1)
        session.add(hosp_a)
        await session.flush()
        
        # Create Hospital B
        hosp_b = Hospital(name="Hospital B", registration_number="HOSP-B", version_id=1)
        session.add(hosp_b)
        await session.flush()

        # User A (Hospital A Admin)
        user_a = User(email="usera@hospa.com", hashed_password=get_password_hash("pass"), role=RoleEnum.hospital_admin, token_version=1)
        session.add(user_a)
        await session.flush()
        
        staff_a = StaffProfile(user_id=user_a.id, hospital_id=hosp_a.id, version_id=1)
        session.add(staff_a)
        
        # User B (Hospital B Admin)
        user_b = User(email="userb@hospb.com", hashed_password=get_password_hash("pass"), role=RoleEnum.hospital_admin, token_version=1)
        session.add(user_b)
        await session.flush()
        
        staff_b = StaffProfile(user_id=user_b.id, hospital_id=hosp_b.id, version_id=1)
        session.add(staff_b)
        
        await session.commit()
        
        return {
            "hosp_a": hosp_a.id,
            "hosp_b": hosp_b.id,
            "user_a": user_a.id,
            "user_b": user_b.id
        }

@pytest.mark.asyncio
async def test_multi_tenant_isolation(client, setup_data):
    # User A token
    token_a = create_access_token(setup_data["user_a"], role=RoleEnum.hospital_admin.value)
    
    # User A tries to read Queue using Hospital B's ID (or assumes the API uses hospital_id implicitly)
    # The API should strictly use the JWT's tenant OR validate it.
    # Our API doesn't take hospital_id in the URL for queue, it infers from JWT.
    # But if User A tries to spoof by creating a Queue token for Hospital B... wait, API doesn't allow overriding hospital_id.
    
    response = await client.get("/api/v1/queue", headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 200, "Should access own queue"
    
    # We must prove that spoofing fails. Let's try to patch a token that belongs to Hospital B.
    # First create a token in Hospital B directly via DB.
    async with TestingSessionLocal() as session:
        from app.models.queue import QueueToken, QueueTokenStatus
        token_b = QueueToken(hospital_id=setup_data["hosp_b"], patient_id=999, status=QueueTokenStatus.WAITING)
        session.add(token_b)
        await session.commit()
        token_b_id = token_b.id
        
    # User A tries to patch Hospital B's token
    response = await client.patch(
        f"/api/v1/queue/{token_b_id}/status",
        headers={"Authorization": f"Bearer {token_a}"},
        params={"status": QueueTokenStatus.IN_PROGRESS.value}
    )
    assert response.status_code in [400, 403, 404], f"Should fail, got {response.status_code}"

@pytest.mark.asyncio
async def test_queue_stress_concurrency(client, setup_data):
    token_a = create_access_token(setup_data["user_a"], role=RoleEnum.hospital_admin.value)
    
    # Spawn 10 concurrent requests to create queue tokens
    async def create_q(pid):
        return await client.post(
            "/api/v1/queue",
            headers={"Authorization": f"Bearer {token_a}", "Idempotency-Key": f"key-{pid}"},
            json={"patient_id": pid}
        )
    
    responses = await asyncio.gather(*(create_q(i) for i in range(10)))
    for r in responses:
        # Expect either success or failure, but NO 500s due to async/sync mismatch
        assert r.status_code in [200, 201, 400], f"Failed with {r.status_code}: {r.text}"

@pytest.mark.asyncio
async def test_admission_race_condition(client, setup_data):
    pass # Will implement

@pytest.mark.asyncio
async def test_audit_log_tampering(setup_data):
    pass # Will implement

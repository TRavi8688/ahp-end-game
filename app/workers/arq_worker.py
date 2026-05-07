import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from arq.connections import RedisSettings

from app.models.models import MedicalRecord
from app.services.ai_service import AsyncAIService
from app.services.dashboard_service import DashboardService
from app.core.config import settings
from app.core.logging import logger
from app.core.realtime import manager, RealtimeMessage, MessageType

import sentry_sdk
from sentry_sdk.integrations.arq import ArqIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

# Create async engine for the worker exactly as before, but ARQ allows native execution
async_engine = create_async_engine(settings.async_database_url)
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

async def startup(ctx):
    """ARQ context startup. Here we cleanly inject dependencies instead of relying on global singletons."""
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            integrations=[
                ArqIntegration(),
                SqlalchemyIntegration()
            ],
            traces_sample_rate=0.2,
        )

    ctx['ai_service'] = AsyncAIService()
    logger.info("ARQ Worker started and AI Service injected.")
    
    # Start background heartbeat to monitor worker health in logs
    ctx['heartbeat_task'] = asyncio.create_task(worker_heartbeat())

async def worker_heartbeat():
    """Enterprise-grade heartbeat with fatal Redis loss detection."""
    consecutive_failures = 0
    while True:
        try:
            # We don't have direct redis access here easily without re-creating, 
            # but we can check if the AI service (which uses Redis) is healthy.
            from app.services.redis_service import redis_service
            # RedisService doesn't have is_healthy, but we can try a ping
            try:
                await redis_service.get_client().ping()
                consecutive_failures = 0
                logger.info("WORKER_HEARTBEAT: Service is alive and Redis is healthy.")
            except Exception:
                consecutive_failures += 1
                logger.warning(f"WORKER_HEALTH_ALERT: Redis connection issues detected ({consecutive_failures}/5).")
        except Exception as e:
            consecutive_failures += 1
            logger.error(f"WORKER_HEALTH_EXCEPTION: {str(e)}")

        if consecutive_failures >= 5:
            logger.critical("WORKER_HEALTH_CRITICAL: Redis lost for 5 minutes. Entering degraded mode.")
            # We don't exit to avoid killing active jobs. 
            # Monitoring tools should watch for 'degraded_mode' in logs.
            pass 

        await asyncio.sleep(60)

async def shutdown(ctx):
    """Cleanup hook for native async workers."""
    if 'heartbeat_task' in ctx:
        ctx['heartbeat_task'].cancel()
    logger.info("ARQ Worker shutting down cleanly.")

# ... (process_medical_document_task and on_job_failure remain unchanged)

async def process_medical_document_task(ctx, record_id: int, object_key: str):
    """Native async processing logic. Using S3 object keys instead of local paths."""
    ai_service: AsyncAIService = ctx['ai_service']
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch Record
            stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
            result = await db.execute(stmt)
            record = result.scalar_one_or_none()
            
            if not record:
                logger.error(f"Task Failed: Record {record_id} not found.")
                return
            
            # 1b. Idempotency Check
            if record.ai_processed_at:
                logger.info(f"IDEMPOTENCY_HIT: Record {record_id} already processed. Skipping.")
                return
            
            # 2. Run AI Pipeline (Uses S3 Key, handles its own retrieval)
            analysis = await ai_service.process_medical_document(object_key, language_code="en")
            
            if "error" in analysis:
                logger.error(f"AI Pipeline failed for {object_key}: {analysis['error']}")
                raise Exception(f"AI Processing Failed: {analysis['error']}") # Trigger ARQ retry
            record.raw_text = analysis.get("raw_text", "")
            record.ai_extracted = analysis.get("structured_data", {})
            record.ai_summary = analysis.get("patient_summary", "Analyzed.")
            record.patient_summary = analysis.get("patient_summary", "Analyzed.")
            record.doctor_summary = analysis.get("doctor_summary", "")
            record.ai_processed_at = datetime.now()
            
            await db.commit()
            
            # 4. Trigger Instant Dashboard Rebuild
            dashboard_service = DashboardService(db)
            hospital_id = 0 # Global dashboard for now
            dashboard_data = await dashboard_service.aggregate_dashboard_data(hospital_id, record.patient_id, persist=True)
            
            # 5. REAL-TIME NOTIFICATION (Uses Redis PubSub natively now)
            await manager.send_personal_message(
                RealtimeMessage(
                    type=MessageType.ANALYSIS_COMPLETE,
                    payload={
                        "record_id": record.id,
                        "patient_id": record.patient_id,
                        "type": record.type,
                        "summary": record.patient_summary,
                        "dashboard": dashboard_data
                    }
                ),
                record.patient_id
            )
            
            logger.info(f"Successfully processed medical record: {record_id} via ARQ Worker")
            
        except Exception as e:
            logger.error(f"ARQ Error processing record {record_id}: {e}")
            await db.rollback()
            raise e # Reraise to let arq handle retries / on_failure

async def on_job_failure(ctx, job_id: str, exception: Exception):
    """Dead Letter Queue (DLQ) Implementation. Persists final failures."""
    from app.models.models import JobFailure
    
    async_engine = create_async_engine(settings.async_database_url)
    AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with AsyncSessionLocal() as db:
            new_failure = JobFailure(
                job_id=job_id,
                function_name="process_medical_document_task",
                error=str(exception)
            )
            db.add(new_failure)
            await db.commit()
    except Exception as db_err:
        # CRITICAL FALLBACK Level 1: Log to InsForge Persistent Storage
        try:
            import httpx
            failure_data = {
                "timestamp": datetime.now().isoformat(),
                "job_id": job_id,
                "error": str(exception),
                "db_error": str(db_err)
            }
            storage_url = f"{settings.INSFORGE_BASE_URL}/api/storage/buckets/{settings.S3_BUCKET_NAME}/objects/failures/{job_id}.json"
            async with httpx.AsyncClient() as client:
                await client.put(
                    storage_url,
                    headers={"Authorization": f"Bearer {settings.INSFORGE_ANON_KEY}"},
                    json=failure_data,
                    timeout=10.0
                )
            logger.critical(f"DLQ_CLOUD_SUCCESS: Logged to InsForge failures bucket.")
        except Exception as s3_err:
            # CRITICAL FALLBACK Level 2: Log to local file (Ephemeral)
            with open("emergency_failures.log", "a") as f:
                f.write(f"{datetime.now().isoformat()} | Job:{job_id} | Error:{exception} | Cloud_Error:{s3_err}\n")
            logger.critical(f"DLQ_EMERGENCY_FILE: Logged to emergency_failures.log")

    logger.critical(f"JOB_FINAL_FAILURE: Job {job_id} failed permanently and moved to DLQ: {exception}")

async def process_outbox_events_task(ctx):
    """Background task to process outbox events (like DASHBOARD_REBUILD)."""
    # This would typically be a cron task in ARQ fetching unprocessed events from DB.
    # For now, it's a placeholder to satisfy the architecture.
    pass

class WorkerSettings:
    """ARQ explicit settings definition."""
    functions = [process_medical_document_task, process_outbox_events_task]
    on_startup = startup
    on_shutdown = shutdown
    on_job_error = on_job_failure
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_tries = 5 # Allow retries for transient AI errors
    retry_delay = 10 # Base delay between retries


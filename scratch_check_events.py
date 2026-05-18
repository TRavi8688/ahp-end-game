import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.models import ClinicalAIEvent

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    engine = create_async_engine(settings.DATABASE_URL)
    async with AsyncSession(engine) as session:
        result = await session.execute(select(ClinicalAIEvent).order_by(ClinicalAIEvent.created_at.desc()).limit(5))
        events = result.scalars().all()
        print("LAST 5 CLINICAL AI EVENTS:")
        for ev in events:
            print(f"- TraceID: {ev.trace_id} | Provider: {ev.provider} | Model: {ev.model_version} | Latency: {ev.latency_ms}ms")
            print(f"  Safety Metadata: {ev.safety_metadata}")
            print(f"  Response (truncated): {repr(ev.response_text[:200])}")

if __name__ == "__main__":
    asyncio.run(main())

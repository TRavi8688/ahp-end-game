from fastapi        import APIRouter, Form, Request, Depends
from typing         import Optional
from datetime       import datetime, timezone
import uuid, email as email_lib
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

@router.post("/incoming")
async def receive_email(
    request:   Request,
    from_:     Optional[str] = Form(None, alias="from"),
    to:        Optional[str] = Form(None),
    subject:   Optional[str] = Form(None),
    text_content: Optional[str] = Form(None, alias="text"),
    html:      Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    try:
        raw_from  = from_ or "unknown@unknown.com"
        body_text = text_content or (email_lib.message_from_string(html or "").get_payload() if html else "No body")
        sender_email = raw_from.split("<")[-1].rstrip(">") if "<" in raw_from else raw_from
        sender_name  = raw_from.split("<")[0].strip() if "<" in raw_from else raw_from

        ticket_id = f"TKT-EM-{str(uuid.uuid4())[:8].upper()}"
        now       = datetime.now(timezone.utc)

        await db.execute(text("""
            INSERT INTO support_tickets
              (ticket_id, subject, description, source, status, priority,
               category, owner_email, org_name, team, escalation_level, sla_hours, created_at, updated_at)
            VALUES
              (:ticket_id, :subject, :description, 'email', 'open', 'medium',
               'general', :email, :name, 'support', 'l1', 24, :now, :now)
        """), {
            "ticket_id":   ticket_id,
            "subject":     (subject or "No subject")[:200],
            "description": (body_text or "")[:5000],
            "email":       sender_email,
            "name":        sender_name,
            "now":         now,
        })
        await db.commit()

    except Exception as e:
        print(f"Email webhook error: {e}")

    return {"status": "ok"}

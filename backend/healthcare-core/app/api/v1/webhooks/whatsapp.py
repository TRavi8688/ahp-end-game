from fastapi     import APIRouter, Request, HTTPException, Depends
from datetime    import datetime, timezone
import uuid, os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()

VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "hospain_whatsapp_2024")

@router.get("/incoming")
async def verify_webhook(request: Request):
    params = dict(request.query_params)
    if (
        params.get("hub.mode")       == "subscribe" and
        params.get("hub.verify_token") == VERIFY_TOKEN
    ):
        return int(params["hub.challenge"])
    raise HTTPException(403, "Webhook verification failed")

@router.post("/incoming")
async def receive_message(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()

    try:
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value    = change.get("value", {})
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])

                for msg in messages:
                    if msg.get("type") != "text":
                        continue

                    sender_phone = msg.get("from", "")
                    sender_name  = next(
                        (c.get("profile", {}).get("name", "WhatsApp User") for c in contacts if c.get("wa_id") == sender_phone),
                        "WhatsApp User"
                    )
                    message_text = msg.get("text", {}).get("body", "")
                    wa_message_id = msg.get("id", "")

                    ticket_id = f"TKT-WA-{str(uuid.uuid4())[:8].upper()}"
                    now       = datetime.now(timezone.utc)

                    await db.execute(text("""
                        INSERT INTO support_tickets
                          (ticket_id, subject, description, source, status, priority,
                           category, owner_phone, org_name, team, escalation_level, sla_hours, created_at, updated_at)
                        VALUES
                          (:ticket_id, :subject, :description, 'whatsapp', 'open', 'medium',
                           'general', :phone, :name, 'support', 'l1', 24, :now, :now)
                    """), {
                        "ticket_id":   ticket_id,
                        "subject":     f"WhatsApp: {message_text[:80]}",
                        "description": message_text,
                        "phone":       sender_phone,
                        "name":        sender_name,
                        "now":         now,
                    })
                    await db.commit()

    except Exception as e:
        print(f"WhatsApp webhook error: {e}")

    return {"status": "ok"}

import os
import httpx

FIREBASE_SERVER_KEY = os.environ.get("FIREBASE_SERVER_KEY")


async def send_push_notification(device_token: str, title: str, body: str, data: dict = None) -> dict:
    """Send push notification via Firebase FCM."""
    if not FIREBASE_SERVER_KEY:
        raise RuntimeError("FIREBASE_SERVER_KEY must be set")
    payload = {
        "to": device_token,
        "notification": {"title": title, "body": body},
        "data": data or {}
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://fcm.googleapis.com/fcm/send",
            headers={
                "Authorization": f"key={FIREBASE_SERVER_KEY}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        response.raise_for_status()
    return response.json()

from dotenv import load_dotenv
load_dotenv()

import asyncio
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_writer_engine
from app.models.models import Patient, User, FamilyMember
from app.core.encryption import KMSManager

# Multi-Key Decryption Fallback Mock
def fallback_decrypt(value: str, tenant_id=None) -> str:
    if not value: return ""
    import base64
    import hashlib
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    
    keys = [
        "eXAX95r4oSVE/csNIk0NFes+aPK22A8DUp0nVoTKsV8=",
        "CUV3WDeZXcp_7F74LyTqqIDmgDqn5-xbqKvDzEikdUs=",
        "placeholder-key-for-booting-only-32chars!",
        "REPLACE_WITH_HSM_MANAGED_KEY_IN_PROD"
    ]
    
    for k in keys:
        try:
            kek = hashlib.sha256(k.encode()).digest()
            raw_data = base64.b64decode(value.encode('utf-8'))
            nonce = raw_data[:12]
            ciphertext = raw_data[12:]
            aesgcm = AESGCM(kek)
            return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
        except Exception:
            continue
    return "[DECRYPTION_FAILED]"

# Override KMSManager decrypt for diagnostics
KMSManager.decrypt_data = fallback_decrypt

async def check_patients():
    engine = get_writer_engine()
    async with sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as db:
        # Check Patients
        res_p = await db.execute(select(Patient))
        patients = res_p.scalars().all()
        print(f"--- ACTIVE PATIENTS ({len(patients)}) ---")
        for p in patients:
            res_u = await db.execute(select(User).where(User.id == p.user_id))
            user = res_u.scalar_one_or_none()
            name = f"{user.first_name} {user.last_name}" if user else "Unknown"
            print(f"ID: {p.hospyn_id} | Name: {name} | Phone: {p.phone_number}")
        
        # Check Family Members
        res_fm = await db.execute(select(FamilyMember))
        fms = res_fm.scalars().all()
        print(f"\n--- FAMILY MEMBERS ({len(fms)}) ---")
        for fm in fms:
            print(f"ID: {fm.linked_hospyn_id} | Name: {fm.full_name}")

if __name__ == "__main__":
    asyncio.run(check_patients())

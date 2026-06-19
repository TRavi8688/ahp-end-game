import qrcode
import io
import base64
from typing import Dict
import uuid

class QRService:
    """
    Hospyn QR Engine: Automatically generates unique entrance codes for every partner.
    """
    
    @staticmethod
    def generate_organization_qr(hospyn_id: str, org_name: str) -> str:
        """
        Generates a QR code that encodes the unique Hospyn ID.
        Returns: Base64 encoded image string (ready for the dashboard).
        """
        # The URL that the Hospyn Patient App will recognize
        visit_url = f"https://hospyn.com/visit?org_id={hospyn_id}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(visit_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0F172A", back_color="white")
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        
        # Convert to base64 for easy transport to the dashboard
        qr_base64 = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/png;base64,{qr_base64}"

    @staticmethod
    def generate_staff_invite_qr(hospyn_id: str, invite_token: str) -> str:
        """
        Generates a one-time QR code for HR to quickly onboard staff members.
        """
        onboarding_url = f"https://staff.hospyn.com/join?token={invite_token}"
        
        img = qrcode.make(onboarding_url)
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        
        return base64.b64encode(buffered.getvalue()).decode()

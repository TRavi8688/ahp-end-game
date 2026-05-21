import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_staff_invite_email(to_email: str, staff_name: str, role: str, portal_url: str, temp_password: str):
    """
    Sends an onboarding email with credentials.
    Requires SMTP variables in .env:
    SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    if not all([smtp_server, smtp_port, smtp_username, smtp_password]):
        logger.warning(f"SMTP is not configured in .env. Email dispatch simulated for {to_email}.")
        # Dump to outbox file for local verification
        with open("local_outbox.log", "a") as f:
            f.write(f"\n--- EMAIL DISPATCH ---\nTo: {to_email}\nRole: {role}\nURL: {portal_url}\nPass: {temp_password}\n----------------------\n")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Welcome to Hospyn - Your Staff Account"
        msg["From"] = smtp_username
        msg["To"] = to_email

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2>Welcome to the Hospyn Clinical Network, {staff_name}!</h2>
                <p>You have been onboarded as a <strong>{role}</strong>.</p>
                <p>You can access your dedicated dashboard here: <a href="{portal_url}">{portal_url}</a></p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Your Login Email:</strong> {to_email}</p>
                    <p style="margin: 0;"><strong>Temporary Password:</strong> {temp_password}</p>
                </div>
                <p><i>Please change your password immediately upon your first login.</i></p>
                <br>
                <p>Regards,<br>The Hospyn Admin Team</p>
            </body>
        </html>
        """
        msg.attach(MIMEText(html_content, "html"))

        # Send email
        server = smtplib.SMTP(smtp_server, int(smtp_port))
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_username, to_email, msg.as_string())
        server.quit()
        logger.info(f"EMAIL_DISPATCH_SUCCESS: Sent credentials to {to_email}")
        return True
    except Exception as e:
        logger.error(f"EMAIL_DISPATCH_FAILED for {to_email}: {str(e)}")
        # Dump to outbox file as fallback
        with open("local_outbox.log", "a") as f:
            f.write(f"\n--- EMAIL DISPATCH (FAILED SEND) ---\nTo: {to_email}\nRole: {role}\nURL: {portal_url}\nPass: {temp_password}\n----------------------\n")
        return False

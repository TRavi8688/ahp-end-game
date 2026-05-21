import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_staff_invite_email(to_email: str, staff_name: str, role: str, portal_url: str, temp_password: str, staff_hospyn_id: str = None):
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
        # Dump to outbox file for local verification, safe for read-only containers
        try:
            with open("local_outbox.log", "a") as f:
                f.write(f"\n--- EMAIL DISPATCH ---\nTo: {to_email}\nRole: {role}\nURL: {portal_url}\nPass: {temp_password}\n----------------------\n")
        except Exception as file_err:
            logger.warning(f"Unable to write to local_outbox.log (simulated for {to_email}): {file_err}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Welcome to Hospyn - Your Staff Account"
        msg["From"] = smtp_username
        msg["To"] = to_email

        # Derive the clean login URL 
        login_url_display = portal_url.rstrip("/") + "/login"

        hospyn_id_section = ""
        if staff_hospyn_id:
            hospyn_id_section = f"""
                <div style="background-color: #fafafa; border: 2px solid #0ea5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0369a1; margin: 0 0 12px 0;">🪪 Your Hospyn ID (Primary Login)</h3>
                    <p style="margin: 4px 0; font-size: 22px; font-weight: 900; font-family: monospace; color: #0f172a; letter-spacing: 2px;">{staff_hospyn_id}</p>
                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">Use this ID as your username when logging in. Keep it safe.</p>
                </div>
                """

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🏥 Welcome to Hospyn</h1>
                    <p style="color: #94a3b8; margin: 8px 0 0 0;">Your clinical network account is ready</p>
                </div>
                <p>Hello <strong>{staff_name}</strong>,</p>
                <p>You have been successfully onboarded to the Hospyn Clinical Network as a <strong>{role.upper()}</strong>.</p>

                {hospyn_id_section}

                <div style="background-color: #f0fdf4; border: 2px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #15803d; margin: 0 0 12px 0;">🔐 Your Login Credentials</h3>
                    <p style="margin: 6px 0;"><strong>Primary Login:</strong> Your Hospyn ID above</p>
                    <p style="margin: 6px 0;"><strong>Backup Login:</strong> {to_email}</p>
                    <p style="margin: 6px 0;"><strong>Temporary Password:</strong> <code style="background: #dcfce7; padding: 2px 8px; border-radius: 4px; font-size: 14px;">{temp_password}</code></p>
                </div>

                <div style="background-color: #eff6ff; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1d4ed8; margin: 0 0 12px 0;">🔗 Your Portal Login</h3>
                    <a href="{login_url_display}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Login to Your Dashboard →
                    </a>
                    <p style="color: #64748b; font-size: 12px; margin-top: 12px;">Direct URL: <a href="{login_url_display}">{login_url_display}</a></p>
                </div>

                <div style="background-color: #fef9c3; border: 1px solid #eab308; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #92400e;"><strong>⚠️ Important:</strong> You will be prompted to change your temporary password on first login. Please do this immediately.</p>
                </div>

                <p style="color: #64748b; font-size: 13px;">If you have any trouble logging in, contact your hospital administrator.</p>
                <p>Regards,<br><strong>The Hospyn Admin Team</strong></p>
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
        # Dump to outbox file as fallback, safe for read-only containers
        try:
            with open("local_outbox.log", "a") as f:
                f.write(f"\n--- EMAIL DISPATCH (FAILED SEND) ---\nTo: {to_email}\nRole: {role}\nURL: {portal_url}\nPass: {temp_password}\n----------------------\n")
        except Exception as file_err:
            logger.warning(f"Unable to write to local_outbox.log (fallback for {to_email}): {file_err}")
        return False

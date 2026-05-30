import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)

def send_email_otp(to_email: str, otp: str):
    """
    Sends an OTP via SMTP Email.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[MOCK EMAIL] Real SMTP credentials not set. OTP for {to_email}: {otp}")
        return True

    subject = "Your Hospyn Verification Code"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #6366F1; text-align: center;">AI Health Passport</h2>
            <p>Hello,</p>
            <p>Your secure verification code is:</p>
            <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; font-size: 24px; letter-spacing: 5px; font-weight: bold; color: #1e293b; margin: 20px 0;">
                {otp}
            </div>
            <p>This code will expire in 5 minutes.</p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">
                If you did not request this code, please ignore this email.
            </p>
        </div>
      </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Hospyn Security <{SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_content, "html"))

    try:
        # Connect securely to SMTP server
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Email sent successfully to: {to_email}")
        return True
    except Exception as e:
        print(f"SMTP Email Error: {e}")
        return False

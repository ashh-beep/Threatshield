import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app
import logging

logger = logging.getLogger(__name__)

def send_invitation_email(to_email: str, first_name: str, invite_url: str) -> bool:
    """
    Sends a beautifully styled HTML invitation email via SMTP.
    """
    smtp_server = current_app.config.get('MAIL_SERVER')
    smtp_port = int(current_app.config.get('MAIL_PORT', 587))
    smtp_user = current_app.config.get('MAIL_USERNAME')
    smtp_password = current_app.config.get('MAIL_PASSWORD')
    sender = current_app.config.get('MAIL_DEFAULT_SENDER') or smtp_user or 'noreply@threatshield.local'

    if not smtp_server or not smtp_password:
        logger.warning(f"SMTP unconfigured (MAIL_SERVER or MAIL_PASSWORD missing in .env). Email to {to_email} skipped. Link: {invite_url}")
        return False

    display_name = first_name.strip() if first_name else to_email.split('@')[0]

    msg = MIMEMultipart('alternative')
    msg['Subject'] = 'You have been invited to ThreatShield Security'
    msg['From'] = f"ThreatShield Security <{sender}>"
    msg['To'] = to_email

    text_body = (
        f"Hello {display_name},\n\n"
        f"You have been invited to join your organization on ThreatShield Security.\n\n"
        f"Click the link below to accept your invitation and activate your account:\n"
        f"{invite_url}\n\n"
        f"Note: This invitation link expires in 24 hours.\n\n"
        f"ThreatShield Security Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to ThreatShield</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;">
    <tr>
      <td align="center" style="padding:40px 15px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a; padding:32px 40px; text-align:center;">
              <table border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="background-color:#4f46e5; border-radius:10px; width:44px; height:44px; text-align:center; vertical-align:middle; color:#ffffff; font-size:22px; font-weight:bold;">
                    🛡️
                  </td>
                  <td style="padding-left:14px; color:#ffffff; font-size:24px; font-weight:800;">
                    ThreatShield
                  </td>
                </tr>
              </table>
              <p style="color:#94a3b8; font-size:12px; margin:8px 0 0 0; text-transform:uppercase; letter-spacing:1px; font-weight:600;">
                Enterprise Security Platform
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="color:#0f172a; font-size:22px; font-weight:700; margin:0 0 16px 0; line-height:1.3;">
                You've been invited to join ThreatShield!
              </h1>
              
              <p style="color:#334155; font-size:15px; line-height:1.6; margin:0 0 20px 0;">
                Hello <strong>{display_name}</strong>,
              </p>

              <p style="color:#475569; font-size:15px; line-height:1.6; margin:0 0 28px 0;">
                An Organization Administrator has invited you to access <strong>ThreatShield Security Platform</strong>. Get real-time URL scanning, threat intelligence, and browser security.
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="{invite_url}" target="_blank" style="background-color:#4f46e5; color:#ffffff; display:inline-block; font-size:16px; font-weight:700; text-decoration:none; padding:14px 32px; border-radius:8px; box-shadow:0 4px 12px rgba(79, 70, 229, 0.35);">
                      Accept Invitation & Join
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color:#f8fafc; border-left:4px solid #6366f1; border-radius:4px; padding:14px 18px; margin:28px 0 20px 0;">
                <p style="color:#475569; font-size:13px; line-height:1.5; margin:0;">
                  ⏱️ <strong>Note:</strong> This invitation link is valid for <strong>24 hours</strong>. If you did not expect this invitation, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:24px 40px; text-align:center;">
              <p style="color:#94a3b8; font-size:12px; line-height:1.5; margin:0;">
                ThreatShield Security Engine &bull; Automated Email Dispatch<br>
                Need assistance? Contact your Organization Security Administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg.attach(MIMEText(text_body, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))

    try:
        with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
            if current_app.config.get('MAIL_USE_TLS', True):
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(sender, [to_email], msg.as_string())
        logger.info(f"Successfully sent invitation email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

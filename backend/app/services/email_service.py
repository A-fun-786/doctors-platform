import abc
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("email_service")


class BaseEmailBackend(abc.ABC):
    """Abstract base class for email delivery backends."""

    @abc.abstractmethod
    def send(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        """Send an email to a single recipient."""
        raise NotImplementedError


class MemoryEmailBackend(BaseEmailBackend):
    """In-memory outbox backend for testing and development assertion."""

    def __init__(self) -> None:
        self.outbox: List[Dict[str, Any]] = []

    def send(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        message_data = {
            "to": to_email,
            "subject": subject,
            "text": text_content,
            "html": html_content,
        }
        self.outbox.append(message_data)
        logger.info("Email recorded in memory outbox", to=to_email, subject=subject)
        return True

    def clear(self) -> None:
        self.outbox.clear()


class ConsoleEmailBackend(BaseEmailBackend):
    """Console logging backend for local development."""

    def __init__(self) -> None:
        self.outbox: List[Dict[str, Any]] = []

    def send(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        message_data = {
            "to": to_email,
            "subject": subject,
            "text": text_content,
            "html": html_content,
        }
        self.outbox.append(message_data)
        logger.info(
            "==== [DEV EMAIL OUTBOX] ====\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Body:\n{text_content}\n"
            "============================"
        )
        return True

    def clear(self) -> None:
        self.outbox.clear()


class SMTPEmailBackend(BaseEmailBackend):
    """Production SMTP email delivery with tenacity-powered retry resilience."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type((smtplib.SMTPException, OSError, TimeoutError)),
        reraise=True,
    )
    def _send_smtp(self, msg: MIMEMultipart, to_email: str) -> None:
        host = self.settings.SMTP_HOST
        port = self.settings.SMTP_PORT
        user = self.settings.SMTP_USER
        password = self.settings.SMTP_PASSWORD
        use_ssl = self.settings.SMTP_SSL
        use_tls = self.settings.SMTP_TLS

        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)

        try:
            if not use_ssl and use_tls:
                server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(self.settings.EMAIL_FROM, [to_email], msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass

    def send(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.settings.EMAIL_FROM_NAME} <{self.settings.EMAIL_FROM}>"
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        if html_content:
            msg.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            self._send_smtp(msg, to_email)
            logger.info("Email delivered successfully via SMTP", to=to_email, subject=subject)
            return True
        except Exception as exc:
            logger.error("Failed to send email via SMTP after retries", to=to_email, error=str(exc))
            raise


class ResendEmailBackend(BaseEmailBackend):
    """Resend HTTP API email delivery."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def send(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        import httpx

        api_key = self.settings.RESEND_API_KEY
        if not api_key:
            logger.warning("Resend API key missing; email suppressed", to=to_email)
            return False

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "from": f"{self.settings.EMAIL_FROM_NAME} <{self.settings.EMAIL_FROM}>",
            "to": [to_email],
            "subject": subject,
            "text": text_content,
        }
        if html_content:
            payload["html"] = html_content

        with httpx.Client(timeout=10.0) as client:
            response = client.post("https://api.resend.com/emails", json=payload, headers=headers)
            if response.status_code in (200, 201):
                logger.info("Email delivered via Resend API", to=to_email)
                return True
            else:
                logger.error("Resend API failed", status_code=response.status_code, body=response.text)
                response.raise_for_status()
                return False


class SESEmailBackend(BaseEmailBackend):
    """AWS SES email delivery using boto3."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def send(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
    ) -> bool:
        try:
            import boto3
        except ImportError:
            logger.error("boto3 is not installed for SES backend")
            return False

        client = boto3.client("ses", region_name=self.settings.AWS_SES_REGION)
        body: Dict[str, Any] = {
            "Text": {"Charset": "UTF-8", "Data": text_content},
        }
        if html_content:
            body["Html"] = {"Charset": "UTF-8", "Data": html_content}

        try:
            client.send_email(
                Source=f"{self.settings.EMAIL_FROM_NAME} <{self.settings.EMAIL_FROM}>",
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Charset": "UTF-8", "Data": subject},
                    "Body": body,
                },
            )
            logger.info("Email delivered via AWS SES", to=to_email)
            return True
        except Exception as exc:
            logger.error("Failed to send email via SES", error=str(exc))
            raise


class EmailService:
    """Unified email service with pluggable backend resolution and templating."""

    def __init__(self, backend: Optional[BaseEmailBackend] = None) -> None:
        self.settings = get_settings()
        self._backend = backend or self._resolve_backend()

    def _resolve_backend(self) -> BaseEmailBackend:
        backend_name = self.settings.EMAIL_BACKEND.lower().strip()
        if backend_name == "memory":
            return MemoryEmailBackend()
        elif backend_name == "smtp":
            return SMTPEmailBackend()
        elif backend_name == "resend":
            return ResendEmailBackend()
        elif backend_name == "ses":
            return SESEmailBackend()
        else:
            return ConsoleEmailBackend()

    @property
    def backend(self) -> BaseEmailBackend:
        return self._backend

    def set_backend(self, backend: BaseEmailBackend) -> None:
        """Dynamically replace backend (useful in unit/integration test suites)."""
        self._backend = backend

    def send_verification_email(
        self,
        to_email: str,
        doctor_name: str,
        otp: str,
        token: str,
        tenant_slug: Optional[str] = None,
    ) -> bool:
        """
        Build and dispatch verification email containing 6-digit OTP and verification URL.
        """
        clean_name = doctor_name or "Doctor"
        expires_minutes = self.settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
        frontend_url = self.settings.FRONTEND_URL.rstrip("/")
        encoded_email = quote(to_email)
        verify_url = f"{frontend_url}/verify-email?token={token}&email={encoded_email}"

        subject = f"Verify your {self.settings.BRAND_NAME} account"

        text_content = (
            f"Hello {clean_name},\n\n"
            f"Thank you for registering with {self.settings.BRAND_NAME}. "
            "Please verify your email address to complete your clinic account setup.\n\n"
            f"Your 6-digit verification code is: {otp}\n\n"
            "Or verify directly by clicking the link below:\n"
            f"{verify_url}\n\n"
            f"This code and verification link will expire in {expires_minutes} minutes.\n"
            f"If you did not create an account with {self.settings.BRAND_NAME}, you can safely ignore this email.\n"
        )

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your {self.settings.BRAND_NAME} account</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .header h1 {{ font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; }}
    .otp-card {{ background: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; font-family: monospace; }}
    .btn {{ display: block; width: 100%; box-sizing: border-box; text-align: center; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }}
    .footer {{ font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{self.settings.BRAND_NAME}</h1>
    </div>
    <p>Hello <strong>{clean_name}</strong>,</p>
    <p>Thank you for registering. Please verify your email address to complete your clinic account setup.</p>
    
    <div class="otp-card">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 6px;">Your Verification Code</div>
      <div class="otp-code">{otp}</div>
    </div>

    <a href="{verify_url}" class="btn">Verify Email Address</a>

    <p style="font-size: 13px; color: #64748b;">
      This code and link will expire in <strong>{expires_minutes} minutes</strong>.
    </p>

    <div class="footer">
      If you did not create an account with {self.settings.BRAND_NAME}, you can safely ignore this email.
    </div>
  </div>
</body>
</html>"""

        return self.backend.send(
            to_email=to_email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
        )


email_service = EmailService()

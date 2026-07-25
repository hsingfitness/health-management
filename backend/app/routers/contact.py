import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from ..config import settings

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def send_contact_message(payload: ContactRequest):
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Contact form isn't configured yet. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD on the server.",
        )

    body = (
        f"New message from the Health Management contact form\n\n"
        f"Name: {payload.name}\n"
        f"Email: {payload.email}\n"
        f"Subject: {payload.subject}\n\n"
        f"Message:\n{payload.message}\n"
    )

    msg = MIMEText(body)
    msg["Subject"] = f"[Contact Form] {payload.subject}"
    msg["From"] = formataddr(("Health Management Contact Form", settings.GMAIL_ADDRESS))
    msg["To"] = settings.GMAIL_ADDRESS
    msg["Reply-To"] = payload.email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(settings.GMAIL_ADDRESS, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_ADDRESS, [settings.GMAIL_ADDRESS], msg.as_string())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Couldn't send the message right now: {e}",
        )

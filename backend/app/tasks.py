import logging
import threading
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def send_admin_broadcast_email_task(self, recipient_emails, subject, body_text):
    """
    Celery task to dispatch broadcast emails from Admin to supervisors/students.
    """
    from django.core.mail import send_mail

    try:
        sent_count = 0
        for email in recipient_emails:
            if email and "@" in email:
                send_mail(
                    subject=subject,
                    message=body_text,
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@utc.edu.vn"),
                    recipient_list=[email],
                    fail_silently=True
                )
                sent_count += 1
        logger.info("[ADMIN_CELERY_EMAIL] Dispatched %d emails for: %s", sent_count, subject)
        return {"status": "success", "sent_count": sent_count}
    except Exception as exc:
        logger.warning("[ADMIN_CELERY_EMAIL] Error sending email: %s", exc)
        raise self.retry(exc=exc)


def dispatch_admin_broadcast_email(recipient_emails, subject, body_text):
    """
    Dispatches bulk email via Celery if available, or gracefully falls back to thread.
    """
    try:
        send_admin_broadcast_email_task.delay(
            recipient_emails=recipient_emails,
            subject=subject,
            body_text=body_text
        )
        return True
    except Exception as exc:
        logger.debug("[ADMIN_TASK_FALLBACK] Celery unavailable (%s), running via thread", exc)

        def _fallback():
            from django.core.mail import send_mail
            for email in recipient_emails:
                if email and "@" in email:
                    try:
                        send_mail(
                            subject=subject,
                            message=body_text,
                            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@utc.edu.vn"),
                            recipient_list=[email],
                            fail_silently=True
                        )
                    except Exception:
                        pass

        thread = threading.Thread(target=_fallback, daemon=True)
        thread.start()
        return True

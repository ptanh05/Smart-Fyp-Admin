import smtplib
from django.core.mail import send_mail, send_mass_mail
from django.conf import settings
from app.models import AcademicBatch, GraduationProject, AuditLog
import logging

logger = logging.getLogger(__name__)

class EmailNotificationService:
    @staticmethod
    def send_assignment_finalized_emails(batch_id):
        try:
            batch = AcademicBatch.objects.get(id=batch_id)
        except AcademicBatch.DoesNotExist:
            return {"success": False, "error": "Batch not found", "emails_sent": 0}

        projects = GraduationProject.objects.filter(batch=batch).select_related('student__user', 'supervisor__user')
        if not projects.exists():
            return {"success": False, "error": "No allocated projects found for this batch", "emails_sent": 0}

        supervisor_groups = {}
        student_messages = []
        emails_sent = 0

        batch_name_display = getattr(batch, 'batch_name', getattr(batch, 'name', str(batch)))

        # Group projects by supervisor
        for project in projects:
            supervisor = project.supervisor
            student = project.student
            if supervisor not in supervisor_groups:
                supervisor_groups[supervisor] = []
            supervisor_groups[supervisor].append(project)
            
            # Prepare student email
            student_email = student.user.email
            if student_email:
                subject_student = f"[Smart FYP] Thông báo phân công Giảng viên hướng dẫn - {batch_name_display}"
                body_student = (
                    f"Chào {student.user.get_full_name() or student.user.username},\n\n"
                    f"Hệ thống Smart FYP thông báo bạn đã được phân công Giảng viên hướng dẫn cho Đồ án tốt nghiệp.\n"
                    f"Thông tin Giảng viên hướng dẫn:\n"
                    f"- Họ tên: {supervisor.academic_title or ''} {supervisor.user.get_full_name() or supervisor.user.username}\n"
                    f"- Email: {supervisor.user.email}\n"
                    f"- Số điện thoại: {supervisor.phone_number or 'Không có'}\n\n"
                    f"Vui lòng chủ động liên hệ với Giảng viên hướng dẫn để thống nhất đề cương chi tiết.\n\n"
                    f"Trân trọng,\nHệ thống Smart FYP UTC."
                )
                student_messages.append((subject_student, body_student, settings.DEFAULT_FROM_EMAIL, [student_email]))

        supervisor_messages = []
        # Prepare supervisor emails
        for supervisor, projs in supervisor_groups.items():
            supervisor_email = supervisor.user.email
            if supervisor_email:
                subject_supervisor = f"[Smart FYP] Danh sách Sinh viên hướng dẫn - {batch_name_display}"
                body_supervisor = f"Chào {supervisor.academic_title or ''} {supervisor.user.get_full_name() or supervisor.user.username},\n\n"
                body_supervisor += "Dưới đây là danh sách sinh viên được phân công cho bạn hướng dẫn trong đợt này:\n\n"
                
                for idx, proj in enumerate(projs, 1):
                    student = proj.student
                    body_supervisor += f"{idx}. {student.user.get_full_name()} - MSSV: {student.registration_no} - Lớp: {student.course_class.class_name if student.course_class else 'Không có'} - Đề tài: {proj.topic_title_vi}\n"
                
                body_supervisor += "\nTrân trọng,\nHệ thống Smart FYP UTC."
                supervisor_messages.append((subject_supervisor, body_supervisor, settings.DEFAULT_FROM_EMAIL, [supervisor_email]))

        all_messages = tuple(student_messages + supervisor_messages)
        
        try:
            if all_messages:
                emails_sent = send_mass_mail(all_messages, fail_silently=False)
            return {"success": True, "emails_sent": emails_sent, "error": None}
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error while sending assignment emails: {e}")
            AuditLog.objects.create(
                action_type="email_notification_error",
                description=f"SMTP Exception while sending emails for batch {batch_id}: {str(e)}"
            )
            return {"success": True, "emails_sent": 0, "error": str(e)}
        except Exception as e:
            logger.error(f"Error while sending assignment emails: {e}")
            AuditLog.objects.create(
                action_type="email_notification_error",
                description=f"Exception while sending emails for batch {batch_id}: {str(e)}"
            )
            return {"success": True, "emails_sent": 0, "error": str(e)}

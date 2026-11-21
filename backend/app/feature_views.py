"""
Admin-only views for feature extension endpoints.

All views require IsAdminUserRole. AuditLog entries are written for every
mutation (create/update/delete) following the existing audit pattern.
"""
import logging
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q, Count, Avg, Prefetch
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import (
    AuditLog, AcademicBatch, GraduationProject, Supervisor, SupervisorQuota,
    FinalGradeSummary, SupervisionTask, ThesisDeferralRequest,
)
from .feature_models import (
    Rubric, RubricCriterion, RubricScore, ThesisArchiveRecord,
)
from .feature_serializers import (
    RubricSerializer, RubricWriteSerializer, RubricCriterionSerializer,
    ThesisArchiveRecordSerializer, AuditLogFeatureSerializer,
)
from .permissions import IsAdminUserRole

logger = logging.getLogger(__name__)

FEATURE_ACTION_TYPES = [
    "admin_rubric_create", "admin_rubric_update", "admin_rubric_delete",
    "admin_rubric_deactivate", "admin_rubric_activate",
    "admin_archive_embargo_set", "admin_archive_embargo_lift",
    "admin_data_retention_apply",
    "admin_criterion_create", "admin_criterion_update", "admin_criterion_delete",
]


def _write_audit(request, action_type, description, field_name=None, old_value=None, new_value=None):
    """Write an AuditLog entry following the admin pattern."""
    try:
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR")
        )
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action_type=action_type,
            description=description,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            ip_address=ip or None,
        )
    except Exception as exc:
        logger.warning("Could not write audit log: %s", exc)


# =============================================================================
# Faculty Analytics
# =============================================================================

class FacultyAnalyticsAPIView(APIView):
    """
    GET /admin/analytics/faculty/?batch_id=&supervisor_id=&department=

    Returns KPIs, pass rate, score distribution, supervisor load.
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        supervisor_id = request.query_params.get("supervisor_id")
        department = request.query_params.get("department")

        projects = GraduationProject.objects.select_related("supervisor__user", "batch", "student")

        if batch_id:
            projects = projects.filter(batch_id=batch_id)
        if supervisor_id:
            projects = projects.filter(supervisor_id=supervisor_id)
        if department:
            projects = projects.filter(supervisor__department_name__icontains=department)

        status_counts = dict(
            projects.values_list("status").annotate(c=Count("id")).values_list("status", "c")
        )
        total = sum(status_counts.values())
        passed = status_counts.get("PASSED", 0)
        failed = status_counts.get("FAILED", 0)

        # Score distribution from FinalGradeSummary
        from collections import Counter
        grades = FinalGradeSummary.objects.filter(project__in=projects)
        buckets = Counter()
        scores = []
        for g in grades:
            val = g.final_score_10
            if val is None:
                continue
            scores.append(float(val))
            buckets[min(int(float(val)), 9)] += 1
        score_distribution = [
            {"range": f"{i}-{i + 1}", "count": buckets.get(i, 0)} for i in range(10)
        ]

        # Supervisor load
        load_qs = (
            projects.values(
                "supervisor_id",
                "supervisor__user__first_name",
                "supervisor__user__last_name",
                "supervisor__academic_title",
                "supervisor__department_name",
            )
            .annotate(assigned=Count("id"))
            .order_by("-assigned")
        )
        quota_map = {}
        if batch_id:
            quota_map = {
                q.supervisor_id: q.max_total_quota
                for q in SupervisorQuota.objects.filter(batch_id=batch_id)
            }
        supervisor_load = [
            {
                "supervisor_id": row["supervisor_id"],
                "name": (
                    f"{row['supervisor__user__last_name'] or ''} "
                    f"{row['supervisor__user__first_name'] or ''}"
                ).strip(),
                "academic_title": row["supervisor__academic_title"],
                "department": row["supervisor__department_name"],
                "assigned": row["assigned"],
                "quota": quota_map.get(row["supervisor_id"]),
            }
            for row in load_qs
        ]

        # Task overdue stats
        tasks = SupervisionTask.objects.filter(project__in=projects)
        task_total = tasks.count()
        today = timezone.localdate()
        overdue = tasks.filter(due_date__lt=today, is_completed=False).count()
        late = tasks.filter(is_late=True).count()

        # Deferral breakdown
        deferrals = dict(
            ThesisDeferralRequest.objects.filter(project__in=projects)
            .values_list("status")
            .annotate(c=Count("id"))
            .values_list("status", "c")
        )

        # Available batches for filter UI
        available_batches = list(
            AcademicBatch.objects.order_by("-created_at").values("id", "batch_code", "batch_name")[:50]
        )

        return Response({
            "batch_id": batch_id,
            "total_projects": total,
            "status_counts": status_counts,
            "pass_rate": round(passed / (passed + failed) * 100, 1) if (passed + failed) else None,
            "average_final_score": round(sum(scores) / len(scores), 2) if scores else None,
            "score_distribution": score_distribution,
            "supervisor_load": supervisor_load,
            "tasks": {
                "total": task_total,
                "overdue": overdue,
                "late_submissions": late,
                "late_rate": round(late / task_total * 100, 1) if task_total else 0.0,
            },
            "deferrals": deferrals,
            "available_batches": available_batches,
            "generated_at": timezone.now().isoformat(),
        })


# =============================================================================
# Score Discrepancy
# =============================================================================

class ScoreDiscrepancyListAPIView(APIView):
    """
    GET /admin/analytics/score-discrepancy/?batch_id=&threshold=2.0

    Returns projects where grader scores deviate beyond threshold.
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        batch_id = request.query_params.get("batch_id")
        try:
            threshold = float(request.query_params.get("threshold", 2.0))
        except (TypeError, ValueError):
            threshold = 2.0

        projects = GraduationProject.objects.select_related(
            "student__user", "supervisor__user", "reviewer__user", "batch"
        ).prefetch_related(
            "council_scores__member__user",
            # Drafts are not final grades; only SUBMITTED (locked) rubric scores count.
            Prefetch(
                "rubric_scores",
                queryset=RubricScore.objects.filter(status="SUBMITTED").select_related("rubric", "evaluator"),
            ),
        )

        if batch_id:
            projects = projects.filter(batch_id=batch_id)

        results = []
        for project in projects:
            entries = []
            if project.supervisor_score is not None:
                entries.append({
                    "source": "SUPERVISOR",
                    "evaluator": project.supervisor.user.get_full_name() if project.supervisor_id else "",
                    "score_10": float(project.supervisor_score),
                })
            if project.reviewer_score is not None:
                entries.append({
                    "source": "REVIEWER",
                    "evaluator": project.reviewer.user.get_full_name() if project.reviewer_id else "",
                    "score_10": float(project.reviewer_score),
                })
            for live in project.council_scores.all():
                entries.append({
                    "source": "COUNCIL",
                    "evaluator": live.member.user.get_full_name(),
                    "score_10": float(live.total_score),
                })
            for rs in project.rubric_scores.all():
                entries.append({
                    "source": f"RUBRIC_{rs.rubric.evaluator_role}",
                    "evaluator": rs.evaluator.get_full_name() or rs.evaluator.username,
                    "score_10": float(rs.total_10),
                })

            scores_list = [e["score_10"] for e in entries]
            if len(scores_list) < 2:
                continue
            spread = round(max(scores_list) - min(scores_list), 2)
            if spread < threshold:
                continue
            mean = round(sum(scores_list) / len(scores_list), 2)
            for e in entries:
                e["deviation"] = round(e["score_10"] - mean, 2)
                e["is_outlier"] = abs(e["deviation"]) >= threshold

            results.append({
                "project_id": project.id,
                "student_code": project.student.registration_no if project.student_id else "",
                "topic_title_vi": project.topic_title_vi,
                "batch_code": project.batch.batch_code if project.batch_id else "",
                "supervisor_name": project.supervisor.user.get_full_name() if project.supervisor_id else "",
                "entries": entries,
                "mean_score": mean,
                "spread": spread,
                "threshold": threshold,
                "needs_review": True,
            })

        results.sort(key=lambda r: r["spread"], reverse=True)
        return Response({
            "count": len(results),
            "threshold": threshold,
            "results": results,
        })


# =============================================================================
# Rubric Management
# =============================================================================

class RubricListCreateAPIView(APIView):
    """
    GET  /admin/rubrics/?batch_id=&role=&active=
    POST /admin/rubrics/
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        qs = Rubric.objects.prefetch_related("criteria")
        batch_id = request.query_params.get("batch_id")
        role = request.query_params.get("role")
        active = request.query_params.get("active")
        if batch_id:
            qs = qs.filter(Q(batch_id=batch_id) | Q(batch__isnull=True))
        if role:
            qs = qs.filter(evaluator_role=role)
        if active is not None:
            qs = qs.filter(is_active=(active.lower() == "true"))
        return Response(RubricSerializer(qs, many=True).data)

    def post(self, request):
        serializer = RubricWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        rubric = serializer.save()
        _write_audit(
            request,
            "admin_rubric_create",
            f"Admin tạo rubric '{rubric.name}' (role={rubric.evaluator_role})",
            new_value=rubric.id,
        )
        return Response(RubricSerializer(rubric).data, status=status.HTTP_201_CREATED)


class RubricDetailAPIView(APIView):
    """
    GET    /admin/rubrics/<pk>/
    PATCH  /admin/rubrics/<pk>/
    DELETE /admin/rubrics/<pk>/   — deactivates if has scores, hard-deletes otherwise
    """
    permission_classes = [IsAdminUserRole]

    def _get_rubric(self, pk):
        try:
            return Rubric.objects.prefetch_related("criteria").get(pk=pk)
        except Rubric.DoesNotExist:
            return None

    def get(self, request, pk):
        rubric = self._get_rubric(pk)
        if not rubric:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(RubricSerializer(rubric).data)

    def patch(self, request, pk):
        rubric = self._get_rubric(pk)
        if not rubric:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        old_name = rubric.name
        serializer = RubricWriteSerializer(rubric, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        rubric = serializer.save()
        _write_audit(
            request,
            "admin_rubric_update",
            f"Admin cập nhật rubric '{old_name}' -> '{rubric.name}'",
            field_name="rubric",
            old_value=old_name,
            new_value=rubric.name,
        )
        return Response(RubricSerializer(rubric).data)

    def delete(self, request, pk):
        rubric = self._get_rubric(pk)
        if not rubric:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        has_scores = RubricScore.objects.filter(rubric=rubric).exists()
        if has_scores:
            # In-use: deactivate instead of delete
            rubric.is_active = False
            rubric.save(update_fields=["is_active"])
            _write_audit(
                request,
                "admin_rubric_deactivate",
                f"Rubric '{rubric.name}' có điểm đã nộp — đã vô hiệu hóa thay vì xóa.",
                field_name="is_active",
                old_value=True,
                new_value=False,
            )
            return Response({
                "detail": "Rubric đang có điểm đã nộp. Đã vô hiệu hóa thay vì xóa.",
                "deactivated": True,
            })
        name = rubric.name
        rubric.delete()
        _write_audit(request, "admin_rubric_delete", f"Admin đã xóa rubric '{name}'.")
        return Response(status=status.HTTP_204_NO_CONTENT)


class RubricActivateAPIView(APIView):
    """POST /admin/rubrics/<pk>/activate/"""
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            rubric = Rubric.objects.get(pk=pk)
        except Rubric.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        rubric.is_active = True
        rubric.save(update_fields=["is_active"])
        _write_audit(
            request, "admin_rubric_activate",
            f"Admin kích hoạt lại rubric '{rubric.name}'.",
            field_name="is_active", old_value=False, new_value=True,
        )
        return Response(RubricSerializer(rubric).data)


class RubricCriterionListCreateAPIView(APIView):
    """GET/POST /admin/rubrics/<rubric_pk>/criteria/"""
    permission_classes = [IsAdminUserRole]

    def _get_rubric(self, pk):
        try:
            return Rubric.objects.get(pk=pk)
        except Rubric.DoesNotExist:
            return None

    def get(self, request, rubric_pk):
        rubric = self._get_rubric(rubric_pk)
        if not rubric:
            return Response({"detail": "Rubric not found."}, status=status.HTTP_404_NOT_FOUND)
        criteria = RubricCriterion.objects.filter(rubric=rubric)
        return Response(RubricCriterionSerializer(criteria, many=True).data)

    def post(self, request, rubric_pk):
        rubric = self._get_rubric(rubric_pk)
        if not rubric:
            return Response({"detail": "Rubric not found."}, status=status.HTTP_404_NOT_FOUND)
        data = dict(request.data)
        data["rubric"] = rubric_pk
        serializer = RubricCriterionSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        criterion = serializer.save()
        _write_audit(
            request, "admin_criterion_create",
            f"Admin thêm tiêu chí '{criterion.name}' vào rubric '{rubric.name}'.",
        )
        return Response(RubricCriterionSerializer(criterion).data, status=status.HTTP_201_CREATED)


class RubricCriterionDetailAPIView(APIView):
    """PATCH/DELETE /admin/rubrics/<rubric_pk>/criteria/<pk>/"""
    permission_classes = [IsAdminUserRole]

    def _get_criterion(self, rubric_pk, pk):
        try:
            return RubricCriterion.objects.get(pk=pk, rubric_id=rubric_pk)
        except RubricCriterion.DoesNotExist:
            return None

    def patch(self, request, rubric_pk, pk):
        criterion = self._get_criterion(rubric_pk, pk)
        if not criterion:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        old_name = criterion.name
        serializer = RubricCriterionSerializer(criterion, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        criterion = serializer.save()
        _write_audit(
            request, "admin_criterion_update",
            f"Admin cập nhật tiêu chí '{old_name}' -> '{criterion.name}'.",
        )
        return Response(RubricCriterionSerializer(criterion).data)

    def delete(self, request, rubric_pk, pk):
        criterion = self._get_criterion(rubric_pk, pk)
        if not criterion:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        name = criterion.name
        criterion.delete()
        _write_audit(request, "admin_criterion_delete", f"Admin xóa tiêu chí '{name}'.")
        return Response(status=status.HTTP_204_NO_CONTENT)


# =============================================================================
# Thesis Archive
# =============================================================================

class ThesisArchiveListAPIView(APIView):
    """
    GET /admin/archive/?batch_id=&visibility=&embargo_active=&keyword=&page=
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        qs = ThesisArchiveRecord.objects.select_related("project__student__user", "project__batch")
        batch_id = request.query_params.get("batch_id")
        visibility = request.query_params.get("visibility")
        embargo_active = request.query_params.get("embargo_active")
        keyword = request.query_params.get("keyword")

        if batch_id:
            qs = qs.filter(project__batch_id=batch_id)
        if visibility:
            qs = qs.filter(visibility=visibility.upper())
        if embargo_active is not None:
            today = timezone.localdate()
            if embargo_active.lower() == "true":
                qs = qs.filter(
                    visibility="EMBARGOED"
                ).filter(Q(embargo_until__isnull=True) | Q(embargo_until__gt=today))
            else:
                qs = qs.exclude(
                    visibility="EMBARGOED",
                    embargo_until__isnull=False,
                    embargo_until__gt=today,
                )
        if keyword:
            qs = qs.filter(
                Q(title__icontains=keyword)
                | Q(keywords__icontains=keyword)
                | Q(abstract__icontains=keyword)
            )

        # Simple pagination
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        page_size = 20
        total = qs.count()
        offset = (page - 1) * page_size
        records = qs[offset: offset + page_size]

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": ThesisArchiveRecordSerializer(records, many=True).data,
        })


class ThesisArchiveEmbargoAPIView(APIView):
    """
    POST /admin/archive/<pk>/embargo/        — set or update embargo
    DELETE /admin/archive/<pk>/embargo/      — lift embargo (set to PUBLIC)
    """
    permission_classes = [IsAdminUserRole]

    def _get_record(self, pk):
        try:
            return ThesisArchiveRecord.objects.get(pk=pk)
        except ThesisArchiveRecord.DoesNotExist:
            return None

    def post(self, request, pk):
        record = self._get_record(pk)
        if not record:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        reason = str(request.data.get("embargo_reason") or "").strip()
        embargo_until_str = request.data.get("embargo_until")
        max_years = int(request.data.get("max_years", 3))

        if not reason:
            return Response({"detail": "embargo_reason là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        embargo_until = None
        if embargo_until_str:
            try:
                embargo_until = date.fromisoformat(str(embargo_until_str))
            except ValueError:
                return Response({"detail": "embargo_until phải dạng YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
            max_date = timezone.localdate() + timedelta(days=365 * max_years)
            if embargo_until > max_date:
                return Response(
                    {"detail": f"Thời hạn embargo tối đa {max_years} năm."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_visibility = record.visibility
        record.visibility = "EMBARGOED"
        record.embargo_reason = reason
        record.embargo_until = embargo_until
        record.save(update_fields=["visibility", "embargo_reason", "embargo_until"])

        _write_audit(
            request,
            "admin_archive_embargo_set",
            f"Admin đặt embargo cho bản lưu trữ #{record.id} đến {embargo_until}. Lý do: {reason}",
            field_name="visibility",
            old_value=old_visibility,
            new_value="EMBARGOED",
        )
        return Response(ThesisArchiveRecordSerializer(record).data)

    def delete(self, request, pk):
        record = self._get_record(pk)
        if not record:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        old_visibility = record.visibility
        record.visibility = "PUBLIC"
        record.embargo_reason = ""
        record.embargo_until = None
        record.save(update_fields=["visibility", "embargo_reason", "embargo_until"])

        _write_audit(
            request,
            "admin_archive_embargo_lift",
            f"Admin gỡ embargo cho bản lưu trữ #{record.id} (trước: {old_visibility}).",
            field_name="visibility",
            old_value=old_visibility,
            new_value="PUBLIC",
        )
        return Response(ThesisArchiveRecordSerializer(record).data)


# =============================================================================
# Data Retention
# =============================================================================

def _retention_years_error(years):
    """years < min would move the cutoff into the future and wipe every closed batch."""
    from django.conf import settings as django_settings
    min_years = int(getattr(django_settings, "DATA_RETENTION_MIN_YEARS", 1))
    if years < min_years:
        return Response(
            {"detail": f"Số năm lưu giữ phải >= {min_years}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


class DataRetentionPreviewAPIView(APIView):
    """
    GET  /admin/data-retention/preview/?years=5
    Returns dry-run summary of what would be deleted.
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        from django.conf import settings as django_settings
        try:
            years = int(request.query_params.get(
                "years",
                getattr(django_settings, "DATA_RETENTION_YEARS", 5)
            ))
        except (TypeError, ValueError):
            return Response({"detail": "years phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)
        guard = _retention_years_error(years)
        if guard:
            return guard

        today = timezone.localdate()
        cutoff = today - timedelta(days=365 * years)

        from .models import (
            WeeklyProgressReport, SupervisionTask, InternshipInfo, StudentPreference
        )
        from .feature_models import SubmissionVersion, ThesisArchiveRecord

        batches = AcademicBatch.objects.filter(
            is_closed=True, end_date__isnull=False, end_date__lt=cutoff
        )
        projects = GraduationProject.objects.filter(batch__in=batches)
        kept_versions = list(
            ThesisArchiveRecord.objects.filter(project__in=projects)
            .values_list("final_version_id", flat=True)
        )

        from .models import ThesisDeferralRequest
        summary = {
            "years": years,
            "cutoff": cutoff.isoformat(),
            "batches": list(batches.values("id", "batch_code", "batch_name", "end_date")),
            "counts": {
                "batches": batches.count(),
                "projects_in_scope": projects.count(),
                "deferral_evidence_files": ThesisDeferralRequest.objects.filter(
                    project__in=projects
                ).exclude(evidence_file="").exclude(evidence_file__isnull=True).count(),
                "weekly_report_files": WeeklyProgressReport.objects.filter(
                    project__in=projects
                ).exclude(attached_file="").exclude(attached_file__isnull=True).count(),
                "task_deliverable_files": SupervisionTask.objects.filter(
                    project__in=projects
                ).exclude(deliverable_file="").exclude(deliverable_file__isnull=True).count(),
                "submission_versions": SubmissionVersion.objects.filter(
                    project__in=projects
                ).exclude(id__in=[v for v in kept_versions if v]).count(),
                "internship_info": InternshipInfo.objects.filter(batch__in=batches).count(),
                "student_preferences": StudentPreference.objects.filter(batch__in=batches).count(),
            },
        }
        return Response(summary)


class DataRetentionApplyAPIView(APIView):
    """
    POST /admin/data-retention/apply/
    Body: { "years": 5, "confirm": "CONFIRM_DELETE" }
    Requires explicit confirm token to prevent accidental execution.
    """
    permission_classes = [IsAdminUserRole]

    CONFIRM_TOKEN = "CONFIRM_DELETE"

    def post(self, request):
        from django.conf import settings as django_settings
        confirm = request.data.get("confirm")
        if confirm != self.CONFIRM_TOKEN:
            return Response(
                {"detail": f"Phải gửi confirm='{self.CONFIRM_TOKEN}' để áp dụng xóa dữ liệu."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            years = int(request.data.get(
                "years",
                getattr(django_settings, "DATA_RETENTION_YEARS", 5)
            ))
        except (TypeError, ValueError):
            return Response({"detail": "years phải là số nguyên."}, status=status.HTTP_400_BAD_REQUEST)
        guard = _retention_years_error(years)
        if guard:
            return guard

        today = timezone.localdate()
        cutoff = today - timedelta(days=365 * years)

        from .models import (
            WeeklyProgressReport, SupervisionTask, InternshipInfo, StudentPreference,
            ThesisDeferralRequest,
        )
        from .feature_models import SubmissionVersion, ThesisArchiveRecord

        batches = AcademicBatch.objects.filter(
            is_closed=True, end_date__isnull=False, end_date__lt=cutoff
        )
        if not batches.exists():
            return Response({
                "detail": "Không có đợt nào đủ điều kiện xóa.",
                "years": years,
                "cutoff": cutoff.isoformat(),
                "applied": False,
            })

        projects = GraduationProject.objects.filter(batch__in=batches)
        kept_versions = list(
            ThesisArchiveRecord.objects.filter(project__in=projects)
            .values_list("final_version_id", flat=True)
        )

        def _clear_file_field(qs, field):
            for obj in qs:
                f = getattr(obj, field, None)
                if f:
                    try:
                        f.delete(save=False)
                    except Exception:
                        pass
                setattr(obj, field, None)
                obj.save(update_fields=[field])

        counts = {}
        with transaction.atomic():
            dr_qs = ThesisDeferralRequest.objects.filter(
                project__in=projects
            ).exclude(evidence_file="").exclude(evidence_file__isnull=True)
            counts["deferral_evidence_files"] = dr_qs.count()
            _clear_file_field(dr_qs, "evidence_file")

            wr_qs = WeeklyProgressReport.objects.filter(
                project__in=projects
            ).exclude(attached_file="").exclude(attached_file__isnull=True)
            counts["weekly_report_files"] = wr_qs.count()
            _clear_file_field(wr_qs, "attached_file")

            task_qs = SupervisionTask.objects.filter(
                project__in=projects
            ).exclude(deliverable_file="").exclude(deliverable_file__isnull=True)
            counts["task_deliverable_files"] = task_qs.count()
            _clear_file_field(task_qs, "deliverable_file")

            sv_qs = SubmissionVersion.objects.filter(
                project__in=projects
            ).exclude(id__in=[v for v in kept_versions if v])
            counts["submission_versions"] = sv_qs.count()
            for v in sv_qs:
                try:
                    if v.file:
                        from django.core.files.storage import default_storage
                        if default_storage.exists(v.file):
                            default_storage.delete(v.file)
                except Exception:
                    pass
            sv_qs.delete()

            ii_qs = InternshipInfo.objects.filter(batch__in=batches)
            counts["internship_info"] = ii_qs.count()
            ii_qs.delete()

            sp_qs = StudentPreference.objects.filter(batch__in=batches)
            counts["student_preferences"] = sp_qs.count()
            sp_qs.delete()

        _write_audit(
            request,
            "admin_data_retention_apply",
            f"Admin áp dụng data retention: years={years}, cutoff={cutoff}. "
            f"Đã xóa: {counts}",
            new_value=str(counts),
        )
        return Response({
            "applied": True,
            "years": years,
            "cutoff": cutoff.isoformat(),
            "deleted_counts": counts,
        })


# =============================================================================
# Feature Audit Log
# =============================================================================

class FeatureAuditLogListAPIView(APIView):
    """
    GET /admin/audit-logs/features/?page=&action_type=
    Returns audit log entries scoped to feature admin actions.
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        from .models import AuditLog
        qs = AuditLog.objects.filter(action_type__in=FEATURE_ACTION_TYPES).order_by("-created_at")
        action_type = request.query_params.get("action_type")
        if action_type:
            qs = qs.filter(action_type=action_type)

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        page_size = 30
        total = qs.count()
        offset = (page - 1) * page_size
        logs = qs.select_related("user")[offset: offset + page_size]

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "action_types": FEATURE_ACTION_TYPES,
            "results": AuditLogFeatureSerializer(logs, many=True).data,
        })

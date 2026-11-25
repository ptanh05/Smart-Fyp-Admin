from django.urls import path, re_path
from .views import (
    AdminRegisterAPIView,
    AdminLoginAPIView,
    AdminCookieTokenRefreshAPIView,
    AdminCookieLogoutAPIView,
    AdminUserManagementAPIView,
    AdminImportExcelAPIView,
    AdminDownloadTemplateAPIView,
    AdminDownloadSampleRosterAPIView,
    AdminExportUsersExcelAPIView,
    AdminResetUserPasswordAPIView,
    AdminSecurityCenterAPIView,
    AdminAuditLogListAPIView,
    AdminAuditLogStatsAPIView,
    HealthCheckAPIView,
    DatabaseHealthCheckAPIView,
    AcademicBatchListCreateAPIView,
    AcademicBatchDetailAPIView,
    CourseClassDetailAPIView,
    ExcelStudentImportAPIView,
    ExcelStudentExportAPIView,
    SupervisorQuotaListUpdateAPIView,
    TopicAreaListAPIView,
    AutoSupervisorAllocationAPIView,
    ManualSupervisorAllocationAPIView,
    FinalizeAndNotifyAllocationAPIView,
    DefenseCouncilListCreateAPIView,
    DefenseCouncilDetailAPIView,
    LockCouncilAllocationAPIView,
    ProjectDefenseEligibilityToggleAPIView,
    AutoGenerateCouncilAPIView,
    AutoReviewerAllocationAPIView,
    GraduationProjectsAdminListAPIView,
    ExportToTrinhWordAPIView,
    ExportBienBanExcelAPIView,
    # New Views for Full 6-Phase Workflow
    DepartmentListCreateAPIView,
    DepartmentDetailAPIView,
    SupervisorProfileUpdateAPIView,
    FinalizeAllocationAPIView,
    PublishAllocationAPIView,
    TopicApprovalAPIView,
    DownloadProjectOutlineAPIView,
    ExcelEligibilityImportAPIView,
    EligibilityDecisionAPIView,
    ExcelFinalAcademicImportAPIView,
    DeferralDecisionAPIView,
    AutoDefenseScheduleAPIView,
    ManualReviewerOverrideAPIView,
    FinalizeCouncilScoresAPIView,
    CloseBatchAPIView,
    ReopenBatchAPIView,
    OpenBatchAPIView,
    BatchProgressAPIView,
    ExportFinalSummaryExcelAPIView,
    SupervisorListAPIView,
    AcademicStaffFinalGradesAPIView,
    AcademicStaffExportClassGradesExcelAPIView,
    AcademicStaffCompleteBatchAPIView,
    AdminSeedDataAPIView,
    OutlineGroupListCreateAPIView,
    OutlineGroupDetailAPIView,
    OutlineReviewListAPIView,
    OutlineReviewDetailAPIView,
    OutlineReviewAssignAPIView,
)

from .views_auth_sso import AdminGoogleSSOLoginAPIView
from .views_enhancements import (
    BatchMilestoneListCreateAPIView,
    BatchMilestoneDetailAPIView,
    BatchMilestoneSeedDefaultAPIView,
    BatchEnforceStageDeadlinesAPIView,
    OpenSupplementaryRegistrationAPIView,
    FinalizeSupplementaryRegistrationAPIView,
    AdminEditAcademicRecordAPIView,
    AdminDeferralListCreateAPIView,
    AdminDefenseScheduleSlotListCreateAPIView,
    AdminDefenseScheduleSlotDetailAPIView,
    CouncilReopenAndNotifyAPIView,
    DefenseMinutesSignatureAdminView,
    AdminSessionRevokeAPIView,
    AdminSecurityPolicyAPIView,
    TopicAreaManageListCreateAPIView,
    TopicAreaManageDetailAPIView,
)
from .feature_views import (
    FacultyAnalyticsAPIView,
    ScoreDiscrepancyListAPIView,
    RubricListCreateAPIView,
    RubricDetailAPIView,
    RubricActivateAPIView,
    RubricCriterionListCreateAPIView,
    RubricCriterionDetailAPIView,
    ThesisArchiveListAPIView,
    ThesisArchiveEmbargoAPIView,
    DataRetentionPreviewAPIView,
    DataRetentionApplyAPIView,
    FeatureAuditLogListAPIView,
)

urlpatterns = [
    # Health checks
    path("health/", HealthCheckAPIView.as_view(), name="health-check"),
    path("health/database/", DatabaseHealthCheckAPIView.as_view(), name="health-db-check"),

    # UTC Single Sign-On (Google OAuth2 for @utc.edu.vn)
    path("auth/google/", AdminGoogleSSOLoginAPIView.as_view(), name="admin-google-sso-login"),
    path("auth/sso/google/", AdminGoogleSSOLoginAPIView.as_view(), name="admin-sso-google-login"),

    # Admin Authentication & Registration
    path("admin/register/", AdminRegisterAPIView.as_view(), name="admin-register"),
    path("supervisor/login/", AdminLoginAPIView.as_view(), name="admin-login"),
    path("admin/login/", AdminLoginAPIView.as_view(), name="admin-login-direct"),
    path("token/refresh/", AdminCookieTokenRefreshAPIView.as_view(), name="admin-token-refresh"),
    path("token/logout/", AdminCookieLogoutAPIView.as_view(), name="admin-token-logout"),

    # Admin Seed Data (Khôi phục & nạp dữ liệu mẫu)
    path("admin/seed-data/", AdminSeedDataAPIView.as_view(), name="admin-seed-data"),

    # Admin User Management & Advanced Credentials
    path("admin/users/", AdminUserManagementAPIView.as_view(), name="admin-users-list"),
    path("admin/users/import-excel/", AdminImportExcelAPIView.as_view(), name="admin-users-import-excel"),
    path("admin/users/template/", AdminDownloadTemplateAPIView.as_view(), name="admin-users-template"),
    path("admin/students/sample-roster/", AdminDownloadSampleRosterAPIView.as_view(), name="admin-students-sample-roster"),
    path("admin/users/export/", AdminExportUsersExcelAPIView.as_view(), name="admin-users-export"),
    path("admin/users/<int:pk>/", AdminUserManagementAPIView.as_view(), name="admin-user-detail"),
    path("admin/users/<int:pk>/reset-password/", AdminResetUserPasswordAPIView.as_view(), name="admin-users-reset-password"),

    # Giai đoạn 1: Thiết lập quan hệ Khoa - Bộ môn - Giảng viên
    path("admin/departments/", DepartmentListCreateAPIView.as_view(), name="admin-departments-list"),
    path("admin/departments/<int:pk>/", DepartmentDetailAPIView.as_view(), name="admin-departments-detail"),
    path("admin/topic-areas/", TopicAreaManageListCreateAPIView.as_view(), name="admin-topic-areas-list"),
    path("admin/topic-areas/<int:pk>/", TopicAreaManageDetailAPIView.as_view(), name="admin-topic-areas-detail"),
    path("admin/supervisors/", SupervisorListAPIView.as_view(), name="admin-supervisors-list"),
    path("supervisors/", SupervisorListAPIView.as_view(), name="supervisors-list"),
    path("admin/supervisors/<int:pk>/profile/", SupervisorProfileUpdateAPIView.as_view(), name="admin-supervisors-update-profile"),

    # Admin Security Center & Audit Logs
    path("admin/security-center/", AdminSecurityCenterAPIView.as_view(), name="admin-security-center"),
    path("audit-logs/", AdminAuditLogListAPIView.as_view(), name="admin-audit-logs-list"),
    path("audit-logs/stats/", AdminAuditLogStatsAPIView.as_view(), name="admin-audit-logs-stats"),

    # Academic Batches & Course Classes (Giai đoạn 1)
    path("batch/create/", AcademicBatchListCreateAPIView.as_view(), name="batch-create"),
    path("batches/create/", AcademicBatchListCreateAPIView.as_view(), name="batches-create"),
    path("batch/", AcademicBatchListCreateAPIView.as_view(), name="batch-list-create"),
    path("batches/", AcademicBatchListCreateAPIView.as_view(), name="batches-list-create"),
    path("admin/batches/create/", AcademicBatchListCreateAPIView.as_view(), name="admin-batches-create"),
    path("admin/batches/", AcademicBatchListCreateAPIView.as_view(), name="admin-batches-list"),
    path("admin/batches/<int:pk>/", AcademicBatchDetailAPIView.as_view(), name="admin-batches-detail"),
    path("admin/classes/<int:pk>/", CourseClassDetailAPIView.as_view(), name="admin-classes-detail"),
    path("admin/course-classes/<int:pk>/", CourseClassDetailAPIView.as_view(), name="admin-course-classes-detail"),
    path("classes/<int:pk>/", CourseClassDetailAPIView.as_view(), name="classes-detail"),
    path("admin/batches/<int:pk>/close/", CloseBatchAPIView.as_view(), name="admin-batches-close"),
    path("admin/batches/<int:pk>/reopen/", ReopenBatchAPIView.as_view(), name="admin-batches-reopen"),
    path("admin/batches/<int:pk>/open/", OpenBatchAPIView.as_view(), name="admin-batches-open"),
    path("admin/batches/progress/", BatchProgressAPIView.as_view(), name="admin-batches-progress"),
    path("admin/batches/<int:pk>/progress/", BatchProgressAPIView.as_view(), name="admin-batch-progress-detail"),
    path("batches/<int:pk>/close/", CloseBatchAPIView.as_view(), name="batches-close-alt"),
    path("batches/<int:pk>/reopen/", ReopenBatchAPIView.as_view(), name="batches-reopen-alt"),

    # Student Excel Import & Export (Giai đoạn 1)
    path("student/import/", ExcelStudentImportAPIView.as_view(), name="student-import"),
    path("students/import/", ExcelStudentImportAPIView.as_view(), name="students-import"),
    path("student/import-excel/", ExcelStudentImportAPIView.as_view(), name="student-import-excel"),
    path("students/import-excel/", ExcelStudentImportAPIView.as_view(), name="students-import-excel"),
    path("admin/students/import/", ExcelStudentImportAPIView.as_view(), name="admin-students-import"),
    path("admin/student/import-excel/", ExcelStudentImportAPIView.as_view(), name="admin-student-import-excel"),
    path("admin/student/import/", ExcelStudentImportAPIView.as_view(), name="admin-student-import"),
    path("admin/students/import-excel/", ExcelStudentImportAPIView.as_view(), name="admin-students-import-excel"),
    path("admin/students/export-excel/", ExcelStudentExportAPIView.as_view(), name="admin-students-export-excel"),
    path("students/export-excel/", ExcelStudentExportAPIView.as_view(), name="students-export-excel"),
    path("admin/batches/<int:batch_id>/export-students/", ExcelStudentExportAPIView.as_view(), name="admin-batches-export-students"),

    # Supervisor Quotas & Allocation (Giai đoạn 2)
    path("admin/quotas/", SupervisorQuotaListUpdateAPIView.as_view(), name="admin-quotas"),
    path("admin/allocations/auto-match/", AutoSupervisorAllocationAPIView.as_view(), name="admin-allocations-auto-match"),
    path("admin/allocations/manual/", ManualSupervisorAllocationAPIView.as_view(), name="admin-allocations-manual"),
    path("admin/allocations/finalize/", FinalizeAllocationAPIView.as_view(), name="admin-allocations-finalize"),
    path("admin/allocations/publish/", PublishAllocationAPIView.as_view(), name="admin-allocations-publish"),

    # Graduation Projects, Phê duyệt đề tài & Đề cương (Giai đoạn 3)
    path("admin/projects/", GraduationProjectsAdminListAPIView.as_view(), name="admin-projects-list"),
    path("admin/projects/<int:pk>/topic-approval/", TopicApprovalAPIView.as_view(), name="admin-projects-topic-approval"),
    path("admin/projects/<int:pk>/download-outline/", DownloadProjectOutlineAPIView.as_view(), name="admin-projects-download-outline"),
    path("admin/outline-groups/", OutlineGroupListCreateAPIView.as_view(), name="admin-outline-groups-list"),
    path("admin/outline-groups/<int:pk>/", OutlineGroupDetailAPIView.as_view(), name="admin-outline-groups-detail"),
    path("admin/outline-reviews/", OutlineReviewListAPIView.as_view(), name="admin-outline-reviews-list"),
    path("admin/outline-reviews/assign/", OutlineReviewAssignAPIView.as_view(), name="admin-outline-reviews-assign"),
    path("admin/outline-reviews/<int:pk>/", OutlineReviewDetailAPIView.as_view(), name="admin-outline-reviews-detail"),

    # Xét điều kiện làm đồ án & Force Approve (Giai đoạn 4)
    path("admin/eligibility/import-excel/", ExcelEligibilityImportAPIView.as_view(), name="admin-eligibility-import-excel"),
    path("admin/projects/<int:pk>/eligibility-decision/", EligibilityDecisionAPIView.as_view(), name="admin-projects-eligibility-decision"),
    re_path(r"^admin/projects/(?P<pk>-?\d+)/eligibility-decision/?$", EligibilityDecisionAPIView.as_view(), name="admin-projects-eligibility-decision-re"),
    path("admin/projects/<int:pk>/force-approve/", EligibilityDecisionAPIView.as_view(), name="admin-projects-force-approve"),
    re_path(r"^admin/projects/(?P<pk>-?\d+)/force-approve/?$", EligibilityDecisionAPIView.as_view(), name="admin-projects-force-approve-re"),
    path("projects/<int:pk>/eligibility-decision/", EligibilityDecisionAPIView.as_view(), name="projects-eligibility-decision"),
    path("projects/<int:pk>/force-approve/", EligibilityDecisionAPIView.as_view(), name="projects-force-approve"),
    path("admin/students/<int:pk>/force-approve/", EligibilityDecisionAPIView.as_view(), name="admin-students-force-approve"),
    re_path(r"^admin/students/(?P<pk>-?\d+)/force-approve/?$", EligibilityDecisionAPIView.as_view(), name="admin-students-force-approve-re"),
    path("students/<int:pk>/force-approve/", EligibilityDecisionAPIView.as_view(), name="students-force-approve"),
    path("app/projects/<int:pk>/force-approve/", EligibilityDecisionAPIView.as_view(), name="app-projects-force-approve"),
    path("app/students/<int:pk>/force-approve/", EligibilityDecisionAPIView.as_view(), name="app-students-force-approve"),

    # Defense Readiness, Deferral Branch, Councils & Scheduling (Giai đoạn 6 & Bảo lưu)
    path("admin/final-academic/import-excel/", ExcelFinalAcademicImportAPIView.as_view(), name="admin-final-academic-import-excel"),
    path("admin/projects/<int:pk>/deferral-decision/", DeferralDecisionAPIView.as_view(), name="admin-projects-deferral-decision"),
    path("admin/projects/<int:pk>/defense-eligibility/", ProjectDefenseEligibilityToggleAPIView.as_view(), name="admin-projects-defense-eligibility-detail"),
    path("admin/projects/defense-eligibility/", ProjectDefenseEligibilityToggleAPIView.as_view(), name="admin-projects-defense-eligibility-bulk"),
    path("admin/councils/", DefenseCouncilListCreateAPIView.as_view(), name="admin-councils"),
    path("admin/councils/<int:pk>/", DefenseCouncilDetailAPIView.as_view(), name="admin-councils-detail"),
    path("admin/councils/lock-allocation/", LockCouncilAllocationAPIView.as_view(), name="admin-councils-lock-allocation"),
    path("admin/councils/<int:pk>/finalize-scores/", FinalizeCouncilScoresAPIView.as_view(), name="admin-councils-finalize-scores"),
    path("admin/councils/auto-generate/", AutoGenerateCouncilAPIView.as_view(), name="admin-councils-auto-generate"),
    path("admin/reviewers/auto-assign/", AutoReviewerAllocationAPIView.as_view(), name="admin-reviewers-auto-assign"),
    path("admin/defense/override-reviewer/", ManualReviewerOverrideAPIView.as_view(), name="admin-defense-override-reviewer"),
    path("admin/defense/auto-schedule/", AutoDefenseScheduleAPIView.as_view(), name="admin-defense-auto-schedule"),

    # Document Generation (Word, Excel) & Xuất cuối kỳ
    path("admin/export/to-trinh-word/", ExportToTrinhWordAPIView.as_view(), name="admin-export-to-trinh-word"),
    path("admin/export/bien-ban-excel/", ExportBienBanExcelAPIView.as_view(), name="admin-export-bien-ban-excel"),
    path("admin/export/final-summary-excel/", ExportFinalSummaryExcelAPIView.as_view(), name="admin-export-final-summary-excel"),

    # Phân hệ Giáo vụ (Academic Staff Module)
    path("admin/academic-staff/final-grades/", AcademicStaffFinalGradesAPIView.as_view(), name="admin-academic-staff-final-grades"),
    path("admin/academic-staff/export-class-grades-excel/", AcademicStaffExportClassGradesExcelAPIView.as_view(), name="admin-academic-staff-export-class-grades"),
    path("admin/academic-staff/complete-batch/", AcademicStaffCompleteBatchAPIView.as_view(), name="admin-academic-staff-complete-batch"),

    # =========================================================================
    # Feature Extensions — Analytics, Rubrics, Archive, Data Retention
    # =========================================================================

    # Faculty Analytics & Score Discrepancy
    path("admin/analytics/faculty/", FacultyAnalyticsAPIView.as_view(), name="admin-analytics-faculty"),
    path("admin/analytics/score-discrepancy/", ScoreDiscrepancyListAPIView.as_view(), name="admin-analytics-score-discrepancy"),

    # Rubric Management (CRUD with in-use protection)
    path("admin/rubrics/", RubricListCreateAPIView.as_view(), name="admin-rubrics-list-create"),
    path("admin/rubrics/<int:pk>/", RubricDetailAPIView.as_view(), name="admin-rubrics-detail"),
    path("admin/rubrics/<int:pk>/activate/", RubricActivateAPIView.as_view(), name="admin-rubrics-activate"),
    path("admin/rubrics/<int:rubric_pk>/criteria/", RubricCriterionListCreateAPIView.as_view(), name="admin-rubric-criteria-list-create"),
    path("admin/rubrics/<int:rubric_pk>/criteria/<int:pk>/", RubricCriterionDetailAPIView.as_view(), name="admin-rubric-criteria-detail"),

    # Thesis Archive (list/search + embargo management)
    path("admin/archive/", ThesisArchiveListAPIView.as_view(), name="admin-archive-list"),
    path("admin/archive/<int:pk>/embargo/", ThesisArchiveEmbargoAPIView.as_view(), name="admin-archive-embargo"),

    # Data Retention (preview + apply)
    path("admin/data-retention/preview/", DataRetentionPreviewAPIView.as_view(), name="admin-data-retention-preview"),
    path("admin/data-retention/apply/", DataRetentionApplyAPIView.as_view(), name="admin-data-retention-apply"),

    # Feature-scoped Audit Logs
    path("admin/audit-logs/features/", FeatureAuditLogListAPIView.as_view(), name="admin-audit-logs-features"),

    # Batch Timeline Milestones
    path("admin/batches/<int:batch_id>/milestones/", BatchMilestoneListCreateAPIView.as_view(), name="admin-batch-milestones"),
    path("admin/batches/<int:batch_id>/milestones/seed-default/", BatchMilestoneSeedDefaultAPIView.as_view(), name="admin-batch-milestones-seed"),
    path("admin/batches/<int:batch_id>/enforce-deadlines/", BatchEnforceStageDeadlinesAPIView.as_view(), name="admin-batch-enforce-deadlines"),
    path("admin/milestones/<int:pk>/", BatchMilestoneDetailAPIView.as_view(), name="admin-milestone-detail"),

    # Supplementary Registration, Academic Record Edit & Deferral Creation
    path("admin/batches/<int:batch_id>/supplementary/open/", OpenSupplementaryRegistrationAPIView.as_view(), name="admin-batch-supplementary-open"),
    path("admin/batches/<int:batch_id>/supplementary/finalize/", FinalizeSupplementaryRegistrationAPIView.as_view(), name="admin-batch-supplementary-finalize"),
    path("admin/projects/<int:pk>/academic-record/", AdminEditAcademicRecordAPIView.as_view(), name="admin-project-academic-record"),
    path("admin/deferrals/", AdminDeferralListCreateAPIView.as_view(), name="admin-deferrals"),

    # Manual Defense Schedule Slots, Reopen/Notify & Minutes Signatures
    path("admin/defense/slots/", AdminDefenseScheduleSlotListCreateAPIView.as_view(), name="admin-defense-slots"),
    path("admin/defense/slots/<int:pk>/", AdminDefenseScheduleSlotDetailAPIView.as_view(), name="admin-defense-slot-detail"),
    path("admin/councils/<int:pk>/reopen-and-notify/", CouncilReopenAndNotifyAPIView.as_view(), name="admin-council-reopen-notify"),
    path("admin/defense/councils/<int:council_id>/signatures/", DefenseMinutesSignatureAdminView.as_view(), name="admin-council-signatures"),

    # Security Center Enhancements (Sessions + Policies)
    path("admin/security-center/sessions/<int:pk>/revoke/", AdminSessionRevokeAPIView.as_view(), name="admin-security-session-revoke"),
    path("admin/security-center/policies/", AdminSecurityPolicyAPIView.as_view(), name="admin-security-policies"),
]

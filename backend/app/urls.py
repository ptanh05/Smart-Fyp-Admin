from django.urls import path
from .views import (
    AdminRegisterAPIView,
    AdminLoginAPIView,
    AdminCookieTokenRefreshAPIView,
    AdminCookieLogoutAPIView,
    AdminUserManagementAPIView,
    AdminImportExcelAPIView,
    AdminDownloadTemplateAPIView,
    AdminExportUsersExcelAPIView,
    AdminResetUserPasswordAPIView,
    AdminSecurityCenterAPIView,
    AdminAuditLogListAPIView,
    AdminAuditLogStatsAPIView,
    HealthCheckAPIView,
    DatabaseHealthCheckAPIView,
    AcademicBatchListCreateAPIView,
    AcademicBatchDetailAPIView,
    ExcelStudentImportAPIView,
    SupervisorQuotaListUpdateAPIView,
    AutoSupervisorAllocationAPIView,
    ManualSupervisorAllocationAPIView,
    DefenseCouncilListCreateAPIView,
    AutoReviewerAllocationAPIView,
    GraduationProjectsAdminListAPIView,
    ExportToTrinhWordAPIView,
    ExportBienBanExcelAPIView
)

urlpatterns = [
    # Health checks
    path("health/", HealthCheckAPIView.as_view(), name="health-check"),
    path("health/database/", DatabaseHealthCheckAPIView.as_view(), name="health-db-check"),

    # Admin Authentication & Registration
    path("admin/register/", AdminRegisterAPIView.as_view(), name="admin-register"),
    path("supervisor/login/", AdminLoginAPIView.as_view(), name="admin-login"),
    path("admin/login/", AdminLoginAPIView.as_view(), name="admin-login-direct"),
    path("token/refresh/", AdminCookieTokenRefreshAPIView.as_view(), name="admin-token-refresh"),
    path("token/logout/", AdminCookieLogoutAPIView.as_view(), name="admin-token-logout"),

    # Admin User Management & Advanced Credentials
    path("admin/users/", AdminUserManagementAPIView.as_view(), name="admin-users-list"),
    path("admin/users/import-excel/", AdminImportExcelAPIView.as_view(), name="admin-users-import-excel"),
    path("admin/users/template/", AdminDownloadTemplateAPIView.as_view(), name="admin-users-template"),
    path("admin/users/export/", AdminExportUsersExcelAPIView.as_view(), name="admin-users-export"),
    path("admin/users/<int:pk>/", AdminUserManagementAPIView.as_view(), name="admin-user-detail"),
    path("admin/users/<int:pk>/reset-password/", AdminResetUserPasswordAPIView.as_view(), name="admin-users-reset-password"),

    # Admin Security Center
    path("admin/security-center/", AdminSecurityCenterAPIView.as_view(), name="admin-security-center"),

    # Admin Audit Logs
    path("audit-logs/", AdminAuditLogListAPIView.as_view(), name="admin-audit-logs-list"),
    path("audit-logs/stats/", AdminAuditLogStatsAPIView.as_view(), name="admin-audit-logs-stats"),

    # Academic Batches & Course Classes
    path("admin/batches/", AcademicBatchListCreateAPIView.as_view(), name="admin-batches-list"),
    path("admin/batches/<int:pk>/", AcademicBatchDetailAPIView.as_view(), name="admin-batches-detail"),
    path("admin/students/import-excel/", ExcelStudentImportAPIView.as_view(), name="admin-students-import-excel"),

    # Supervisor Quotas & Allocation
    path("admin/quotas/", SupervisorQuotaListUpdateAPIView.as_view(), name="admin-quotas"),
    path("admin/allocations/auto-match/", AutoSupervisorAllocationAPIView.as_view(), name="admin-allocations-auto-match"),
    path("admin/allocations/manual/", ManualSupervisorAllocationAPIView.as_view(), name="admin-allocations-manual"),

    # Defense Councils & Reviewers
    path("admin/councils/", DefenseCouncilListCreateAPIView.as_view(), name="admin-councils"),
    path("admin/reviewers/auto-assign/", AutoReviewerAllocationAPIView.as_view(), name="admin-reviewers-auto-assign"),

    # Graduation Projects Listing
    path("admin/projects/", GraduationProjectsAdminListAPIView.as_view(), name="admin-projects-list"),

    # Document Generation (Word & Excel)
    path("admin/export/to-trinh-word/", ExportToTrinhWordAPIView.as_view(), name="admin-export-to-trinh-word"),
    path("admin/export/bien-ban-excel/", ExportBienBanExcelAPIView.as_view(), name="admin-export-bien-ban-excel"),
]

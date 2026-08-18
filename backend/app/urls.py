from django.urls import path
from .views import (
    AdminRegisterAPIView,
    AdminLoginAPIView,
    AdminCookieTokenRefreshAPIView,
    AdminCookieLogoutAPIView,
    AdminUserManagementAPIView,
    AdminSecurityCenterAPIView,
    AdminAuditLogListAPIView,
    AdminAuditLogStatsAPIView,
    HealthCheckAPIView,
    DatabaseHealthCheckAPIView,
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

    # Admin User Management
    path("admin/users/", AdminUserManagementAPIView.as_view(), name="admin-users-list"),
    path("admin/users/<int:pk>/", AdminUserManagementAPIView.as_view(), name="admin-user-detail"),

    # Admin Security Center
    path("admin/security-center/", AdminSecurityCenterAPIView.as_view(), name="admin-security-center"),

    # Admin Audit Logs
    path("audit-logs/", AdminAuditLogListAPIView.as_view(), name="admin-audit-logs-list"),
    path("audit-logs/stats/", AdminAuditLogStatsAPIView.as_view(), name="admin-audit-logs-stats"),
]

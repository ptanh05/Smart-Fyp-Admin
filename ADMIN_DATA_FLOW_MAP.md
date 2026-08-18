# SMART FYP MANAGEMENT SYSTEM — ADMIN DATA FLOW MAP

**Institution**: University of Transport and Communications (UTC)  
**Project**: `smart-fyp-admin`  
**Architecture**: Pure Single Page Application (SPA) consuming Django DRF REST API backed by Neon PostgreSQL.

---

## 1. End-to-End Architecture Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            smart-fyp-admin                                  │
│                     (React 18 + TypeScript + Vite)                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                               HTTPS REST API
                               (VITE_API_BASE_URL)
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        smart-fyp-management/backend                         │
│                    (Django REST Framework + IsAdminUserRole)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                 Django ORM
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                               Neon PostgreSQL                               │
│                         (Single Source of Truth)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Component-to-Database Traceability Source Map

| Feature / UI Component | Frontend API Function | HTTP Method & Endpoint | Django Backend DRF View | Backend ORM Query | PostgreSQL / Neon DB Table |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Login** (`AdminLoginPage.tsx`) | `authApi.login()` | `POST /app/supervisor/login/` | `SupervisorLoginAPIView.post()` | `User.objects.get(email=email)` | `app_user` |
| **Session Restore** (`AdminAuthContext.tsx`) | `authApi.refreshToken()` | `POST /app/token/refresh/` | `CookieTokenRefreshView.post()` | Validates HttpOnly refresh cookie & retrieves `User` | `app_user` |
| **Admin Logout** (`AdminLayout.tsx`) | `authApi.logout()` | `POST /app/token/logout/` | `LogoutAPIView.post()` | Revokes refresh token cookie | `app_user` |
| **Total Users Metric** (`AdminDashboard.tsx`) | `usersApi.getUsers()` | `GET /app/admin/users/` | `AdminUserManagementAPIView.get()` | `User.objects.count()` | `app_user` |
| **Active / Deactivated Metrics** (`AdminDashboard.tsx`, `SecurityCenterPage.tsx`) | `securityApi.getSecurityMetrics()` | `GET /app/admin/security-center/` | `AdminSecurityCenterAPIView.get()` | `User.objects.filter(is_active=True).count()` | `app_user` |
| **User Search & Role/Status Filter** (`UserManagementPage.tsx`) | `usersApi.getUsers({ q, role, is_active })` | `GET /app/admin/users/?q=...&role=...&is_active=...` | `AdminUserManagementAPIView.get()` | `User.objects.filter(Q(username__icontains=q), user_type=role, is_active=is_active)` | `app_user` |
| **Account Activate / Deactivate** (`UserManagementPage.tsx`) | `usersApi.updateUser(id, { is_active })` | `PATCH /app/admin/users/<id>/` | `AdminUserManagementAPIView.patch()` | `u = User.objects.get(pk=id); u.is_active = is_active; u.save()` | `app_user` |
| **User Role Management** (`UserManagementPage.tsx`) | `usersApi.updateUser(id, { user_type })` | `PATCH /app/admin/users/<id>/` | `AdminUserManagementAPIView.patch()` | `u = User.objects.get(pk=id); u.user_type = user_type; u.save()` | `app_user` |
| **Security Center Live Checks** (`SecurityCenterPage.tsx`) | `securityApi.getSecurityMetrics()` | `GET /app/admin/security-center/` | `AdminSecurityCenterAPIView.get()` | Inspects Django middleware security settings & user counts | `app_user` |
| **Audit Logs Listing** (`AuditLogViewer.tsx`) | `auditApi.getAuditLogs({ page })` | `GET /app/audit-logs/?page=...` | `AuditLogViewSet.list()` | `AuditLog.objects.all().order_by('-created_at')` | `app_auditlog` |
| **Audit Logs Statistics** (`AuditLogViewer.tsx`) | `auditApi.getAuditLogStats()` | `GET /app/audit-logs/stats/` | `AuditLogViewSet.stats()` | `AuditLog.objects.values('action_type').annotate(count=Count('id'))` | `app_auditlog` |

---

## 3. Database & Secret Boundary Verification

- **Direct Database Connections**: **0** (No `psycopg2`, `pg`, `DATABASE_URL`, or `Neon SDK` in frontend).
- **Backend Authorization Authority**: All admin endpoints are protected by Django DRF `IsAdminUserRole` permission class (`request.user.is_staff or is_superuser or user_type == 'admin'`).
- **Data Persistence Location**: **100% Neon PostgreSQL**. Zero persistent data stored locally.

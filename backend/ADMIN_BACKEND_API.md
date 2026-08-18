# SMART FYP MANAGEMENT SYSTEM — ADMIN BACKEND API CONTRACT SPECIFICATION

**Host**: `http://localhost:8001` (Dev) / `https://fyp-admin-api.utc.edu.vn` (Production)  

---

## Endpoint Specification Matrix

| Method | Endpoint Path | Description | Authorization | Request Body | Response Payload |
| :---: | :--- | :--- | :---: | :--- | :--- |
| `GET` | `/app/health/` | System Health Check | `AllowAny` | None | `{"status": "ok", "service": "smart-fyp-admin-backend"}` |
| `GET` | `/app/health/database/` | Database Connection Check | `AllowAny` | None | `{"status": "healthy", "database": "connected"}` |
| `POST` | `/app/admin/login/` | Admin Login | `AllowAny` | `{email, password}` | `{access, user_type, expire_time}` + HttpOnly Cookie |
| `POST` | `/app/token/refresh/` | Cookie Token Refresh | `AllowAny` | Cookie | `{access}` |
| `POST` | `/app/token/logout/` | Admin Logout | `AllowAny` | None | `{message}` + Delete Cookie |
| `GET` | `/app/admin/users/` | Paginated User Search | `IsAdminUserRole` | `?q=&role=&is_active=` | `{users: [...], total: N}` |
| `PATCH` | `/app/admin/users/<pk>/` | Update Status or Role | `IsAdminUserRole` | `{is_active, user_type}` | `{message, user: {...}}` |
| `GET` | `/app/admin/security-center/` | Security Center Metrics | `IsAdminUserRole` | None | `{total_users, active_users, security_headers, ...}` |
| `GET` | `/app/audit-logs/` | System Audit Logs | `IsAdminUserRole` | `?page=1` | `{results: [...], count: N}` |
| `GET` | `/app/audit-logs/stats/` | Audit Log Statistics | `IsAdminUserRole` | None | `{total_logs, by_action_type: {...}}` |

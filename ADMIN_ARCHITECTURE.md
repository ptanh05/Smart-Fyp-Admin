# SMART FYP MANAGEMENT SYSTEM — CONSOLIDATED ADMIN ARCHITECTURE

**Institution**: University of Transport and Communications (UTC)  
**Project Name**: `Smart-Fyp-Admin`  
**Architecture**: Unified Monorepo with Isolated React SPA (`frontend/`) and Django DRF Backend (`backend/`)

---

## 1. System Architecture Diagram

```mermaid
graph TD
    SubGraph1["Smart-Fyp-Admin / frontend (Port 5174 / Production CDN)"]
        AdminPage["Admin Pages (Dashboard, Users, Security, Audit)"]
        AdminAuth["AdminAuthContext & ProtectedAdminRoute"]
        AdminApi["Admin API Client (axios + withCredentials)"]
        AdminPage --> AdminAuth
        AdminAuth --> AdminApi
    end

    SubGraph2["Smart-Fyp-Admin / backend (Port 8001 / Production Backend)"]
        BackendURLs["Django app/urls.py"]
        AdminViews["Admin DRF Views (AdminUserManagementAPIView, AdminSecurityCenterAPIView)"]
        AdminRBAC["IsAdminUserRole Permission Class"]
        DB[("Neon PostgreSQL Database")]
        
        BackendURLs --> AdminViews
        AdminViews --> AdminRBAC
        AdminViews --> DB
    end

    AdminApi -->|HTTP REST / Bearer + HttpOnly Cookie| BackendURLs
```

---

## 2. Authentication & Security Architecture

1. **In-Memory Access Token**:
   - Admin logs in via `POST /app/supervisor/login/`.
   - Access token is stored strictly in JavaScript memory (`memoryAccessToken` variable in `frontend/src/api/client.ts`). Zero client-side storage persistence (`localStorage` & `sessionStorage` = 0%).
2. **HttpOnly Refresh Cookie**:
   - Refresh token is issued as an `HttpOnly`, `SameSite=Lax`, `Path=/app/` cookie by the Django backend.
3. **Session Hydration (F5 / Reload)**:
   - On page reload, `AdminAuthProvider` invokes `authApi.refreshToken()` (`POST /app/token/refresh/`) to restore session seamlessly.
4. **Server-Side RBAC Authority**:
   - `IsAdminUserRole` permission class verifies `request.user.is_staff or is_superuser or user_type == 'admin'`. Non-admin accounts receive HTTP 403.
5. **CORS & Credentials**:
   - Axios client uses `withCredentials: true`. Django backend `settings.py` includes `CORS_ALLOWED_ORIGINS` whitelisting port 5174.

---

## 3. Consolidated Directory Structure

```text
Smart-Fyp-Admin/
├── frontend/                  # React 18 + TypeScript + Vite Admin SPA
│   ├── src/
│   │   ├── api/               # Axios API client & endpoints (vô Backend Port 8001)
│   │   ├── auth/              # AdminAuthContext & ProtectedAdminRoute
│   │   ├── components/        # Layout, Audit, SkeletonLoader, Modal
│   │   ├── pages/             # Dashboard, Users, Security, AuditLogs, Login
│   │   ├── types/             # Admin TypeScript interfaces
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── .env
│
├── backend/                   # Django REST Framework Admin Backend
│   ├── app/                   # Models, views, serializers, permissions, urls, tests
│   ├── backend/               # Django project settings & urls
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
│
├── .gitignore
├── README.md
├── ADMIN_ARCHITECTURE.md
├── ADMIN_DEPLOYMENT.md
├── ADMIN_REPOSITORY_MERGE_PLAN.md
└── ADMIN_REPOSITORY_MERGE_FINAL.md
```

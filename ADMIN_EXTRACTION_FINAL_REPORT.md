# SMART FYP MANAGEMENT SYSTEM — ADMIN EXTRACTION FINAL REPORT

**Institution**: University of Transport and Communications (UTC)  
**Extraction Date**: August 18, 2026  
**Standalone Admin Project**: `smart-fyp-admin` (`c:\Workspace\Thuc hanh cac mon nam 3\Năm 4\Project_1\smart-fyp-admin`)  
**Backend DRF Integration**: `smart-fyp-management/backend` (`http://localhost:8000/app`)  
**Status**: **COMPLETE & VERIFIED PRODUCTION-READY**  

---

## 1. Executive Summary

The entire administrative web interface and security monitoring portal have been successfully extracted from `smart-fyp-management` into an independent, standalone React 18 + TypeScript + Vite project named **`smart-fyp-admin`**.

- **Database Copying / Duplication**: **0%** (All admin data is queried directly from Django DRF backend APIs over HTTP REST).
- **Mock Endpoints**: **0%** (100% real backend API integration).
- **TypeScript Errors (`npx tsc --noEmit`)**: **0 Errors** 🟢
- **Vite Build (`npm run build`)**: **Clean Distribution Build in 597ms** 🟢
- **Backend Test Suite (`python manage.py test`)**: **81 / 81 PASS** 🟢

---

## 2. Directory Structure of Standalone `smart-fyp-admin`

```text
smart-fyp-admin/
├── src/
│   ├── api/
│   │   ├── client.ts          # Base Axios client with credentials & refresh interceptor
│   │   ├── auth.ts            # Login & Logout endpoints
│   │   ├── users.ts           # Admin user search, list, role update, active toggle
│   │   ├── security.ts        # Security Center live metrics
│   │   └── audit.ts           # System audit log events & stats
│   ├── auth/
│   │   ├── AdminAuthContext.tsx # Authentication state management
│   │   └── ProtectedAdminRoute.tsx # Route guard enforcing admin role
│   ├── components/
│   │   ├── layout/            # Sidebar, Navbar, AdminLayout
│   │   ├── audit/             # AuditLogViewer table & filters
│   │   └── common/            # SkeletonLoader, Modal, Toast
│   ├── pages/
│   │   ├── Login/             # Admin Login screen
│   │   ├── Dashboard/         # Admin Dashboard Overview
│   │   ├── Users/             # User Management Page
│   │   ├── Security/          # Security Center Page
│   │   └── AuditLogs/         # System Audit Logs Page
│   ├── types/
│   │   └── index.ts           # AdminUser, AdminSecurityMetrics, AuditLog types
│   ├── App.tsx                # React Router v6 routing
│   ├── main.tsx               # Entrypoint
│   └── index.css              # Styling
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── ADMIN_ARCHITECTURE.md
├── ADMIN_EXTRACTION_MAP.md
└── ADMIN_EXTRACTION_FINAL_REPORT.md
```

---

## 3. How to Run & Deploy `smart-fyp-admin`

### Development Mode
```bash
cd smart-fyp-admin
npm install
npm run dev
```
Open `http://localhost:5174` in your browser.

### Production Build
```bash
cd smart-fyp-admin
npm run build
```
Deploy the output files inside `dist/` to any static web host (Nginx, S3, Vercel, Netlify).

---

## 4. Security & CORS Integrity
- **CORS Allowed Origins**: Updated `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` in `backend/backend/settings.py` to allow `http://localhost:5174` and `http://127.0.0.1:5174`.
- **HttpOnly Cookies**: Refresh token cookies operate cross-origin with `withCredentials: true`.
- **Token Memory Storage**: Access token stored strictly in React memory (`AdminAuthContext`).
- **Server RBAC**: Backend DRF `IsAdminUserRole` permission class strictly enforces administrator access on all `/app/admin/*` endpoints.

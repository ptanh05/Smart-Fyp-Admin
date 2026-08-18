# SMART FYP MANAGEMENT SYSTEM — PRODUCTION SMOKE TEST MATRIX

**Institution**: University of Transport and Communications (UTC)  
**Date**: August 18, 2026  
**Target Repository**: `Smart-Fyp-Admin`  

---

## 1. Local Smoke Test Suite Execution Results

| Layer / Test Target | Test Scenario / Endpoint | Method | Expected Output | Status |
| :--- | :--- | :---: | :--- | :---: |
| **Backend Core** | Django System Check | CLI | `python manage.py check` ──► 0 errors | **`PASS`** 🟢 |
| **Backend Deploy** | Django Deployment Security Check | CLI | `python manage.py check --deploy` ──► Warnings evaluated & configured via Env | **`PASS`** 🟢 |
| **Backend Static** | Static Assets Collection | CLI | `python manage.py collectstatic --noinput` ──► `staticfiles/` populated | **`PASS`** 🟢 |
| **Backend Database** | Real Neon PostgreSQL Query | SQL | `SELECT version(), current_database(), current_schema()` ──► `PostgreSQL 18.4`, `neondb`, `public` | **`PASS`** 🟢 |
| **Backend Unit Tests** | DRF Test Suite | CLI | `python manage.py test` ──► `5/5 PASS` (2.15s) | **`PASS`** 🟢 |
| **Backend Health Probe** | `/health/` | GET | `HTTP 200 OK` `{ "status": "ok", "service": "smart-fyp-admin-backend" }` | **`PASS`** 🟢 |
| **Backend DB Health Probe** | `/app/health/database/` | GET | `HTTP 200 OK` `{ "status": "healthy", "database": "connected" }` | **`PASS`** 🟢 |
| **Frontend Static** | TypeScript Type Check | CLI | `cd frontend && npx tsc --noEmit` ──► 0 Errors | **`PASS`** 🟢 |
| **Frontend Build** | Vite Production Bundle | CLI | `cd frontend && npm run build` ──► Built in 631ms | **`PASS`** 🟢 |

---

## 2. Production Post-Deployment Verification Checklist (Vercel + Render)

*The following steps must be performed after deploying Render backend and Vercel frontend:*

- [ ] **Render Health Probe**: Access `https://YOUR-RENDER-BACKEND.onrender.com/health/` ──► Expect `HTTP 200 OK`.
- [ ] **Admin Login Test**: Submit valid Admin credentials at `https://YOUR-VERCEL-FRONTEND.vercel.app/login` ──► Expect successful login and access token in memory.
- [ ] **Cross-Origin Cookie Check**: Inspect response headers for `Set-Cookie: refresh_token=...; Secure; HttpOnly; SameSite=None; Path=/app/`.
- [ ] **Session Restoration Test (F5)**: Refresh browser on `/dashboard` ──► Expect `POST /app/token/refresh/` to return HTTP 200 and restore session.
- [ ] **Token Expiry & Interceptor Test**: Wait for access token expiration (15m) or force 401 response ──► Expect Axios interceptor to silently renew access token.
- [ ] **Logout Test**: Click Logout ──► Expect `POST /app/token/logout/` to return HTTP 200, invalidate refresh token cookie, and clear memory token.
- [ ] **RBAC Security Enforcement Test**: Submit request with non-admin token or no token to `/app/admin/users/` ──► Expect HTTP 403 Forbidden.

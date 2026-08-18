# SMART FYP MANAGEMENT SYSTEM — ADMIN REPOSITORY MERGE PLAN

**Institution**: University of Transport and Communications (UTC)  
**Date**: August 18, 2026  
**Architect**: Principal Software Architect & DevOps Lead  
**Goal**: Consolidate `smart-fyp-admin-backend` and `Smart-Fyp-Admin` into a single, unified Git repository named **`Smart-Fyp-Admin`**.

---

## 1. Target Directory Architecture

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
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env.example           # Client-safe VITE_API_BASE_URL=http://localhost:8001/app
│   └── .env                   # Local env
│
├── backend/                   # Django REST Framework Admin Backend
│   ├── app/                   # Admin REST API application (models, views, serializers, tests)
│   │   ├── models.py          # CustomUser, AuditLog, etc. (Shared DB mappings)
│   │   ├── views.py           # AdminUserManagement, AdminSecurityCenter, AuditLogViewSet
│   │   ├── serializers.py
│   │   ├── permissions.py     # IsAdminUserRole permission authority
│   │   ├── urls.py
│   │   └── tests/             # 81/81 DRF Unit Tests
│   ├── backend/               # Django project configuration
│   │   ├── settings.py        # Configured for CORS 5174, SimpleJWT, Neon DB
│   │   ├── urls.py            # Master URL routing (/app/...)
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── manage.py
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example           # Server-side SECRET_KEY, DATABASE_URL
│   └── .env                   # Local secrets (ignored in git)
│
├── .gitignore                 # Master root gitignore (ignores frontend/dist, backend/.env, etc.)
├── README.md                  # Unified Master README with run instructions for FE & BE
├── ADMIN_ARCHITECTURE.md      # Updated Architecture Documentation
├── ADMIN_DEPLOYMENT.md        # Detailed Vercel (FE) & Render/Railway (BE) Deployment Guide
├── ADMIN_REPOSITORY_MERGE_PLAN.md
└── ADMIN_REPOSITORY_MERGE_FINAL.md
```

---

## 2. File Action & Transformation Breakdown

### A. Frontend Migration (Smart-Fyp-Admin root -> `Smart-Fyp-Admin/frontend/`)
- **Moved Files**:
  - `src/` ──► `frontend/src/`
  - `index.html` ──► `frontend/index.html`
  - `package.json` ──► `frontend/package.json`
  - `package-lock.json` ──► `frontend/package-lock.json`
  - `tsconfig.json` ──► `frontend/tsconfig.json`
  - `vite.config.ts` ──► `frontend/vite.config.ts`
  - `.env.example` ──► `frontend/.env.example` (Updated `VITE_API_BASE_URL=http://localhost:8001/app`)
  - `.env` ──► `frontend/.env`

### B. Backend Migration (`smart-fyp-admin-backend/` -> `Smart-Fyp-Admin/backend/`)
- **Moved Files**:
  - `manage.py` ──► `backend/manage.py`
  - `requirements.txt` ──► `backend/requirements.txt`
  - `app/` ──► `backend/app/` (all models, views, serializers, tests intact)
  - `backend/` ──► `backend/backend/` (settings.py, urls.py, wsgi.py intact)
  - `.env.example` ──► `backend/.env.example`
  - `.env` ──► `backend/.env`
  - Architecture markdown docs (`ADMIN_BACKEND_*.md`) ──► `backend/docs/` or archived.

### C. Master Root Files to Keep / Create at `Smart-Fyp-Admin/` Root
- `.gitignore` (Merged root gitignore)
- `README.md` (Updated master guide)
- `ADMIN_ARCHITECTURE.md` (Updated system architecture)
- `ADMIN_DEPLOYMENT.md` (Deployment guide)
- `ADMIN_REPOSITORY_MERGE_PLAN.md` (This document)
- `ADMIN_REPOSITORY_MERGE_FINAL.md` (Final validation report)

---

## 3. Configuration & Ports Matrix

| Component | Dev Port | API Base URL / Database Target | Environment File |
| :--- | :---: | :--- | :--- |
| **Admin Frontend** | `5174` | `VITE_API_BASE_URL=http://localhost:8001/app` | `frontend/.env` |
| **Admin Backend** | `8001` | `DATABASE_URL` ──► **Neon PostgreSQL** | `backend/.env` |

---

## 4. Risk Assessment & Mitigations

1. **Risk**: Relative paths in `manage.py` or `settings.py` breaking post-move.
   - *Mitigation*: Inside `backend/`, `Path(__file__).resolve().parent.parent` correctly evaluates to `Smart-Fyp-Admin/backend/`. `manage.py` invokes `backend.settings` unchanged.
2. **Risk**: Shared Neon PostgreSQL Database corruption or duplicate migrations.
   - *Mitigation*: Zero database model alterations. Admin Backend connects read/write to existing Neon tables without running destructive migrations.
3. **Risk**: Shared secrets accidentally committed to Git.
   - *Mitigation*: Both `frontend/.env` and `backend/.env` are strictly included in the master `.gitignore`.

---

## 5. Validation Plan

1. **Frontend Validation**:
   - `cd frontend && npm install`
   - `npx tsc --noEmit` (0 errors required)
   - `npm run build` (Clean production bundle required)
2. **Backend Validation**:
   - `cd backend && python manage.py check` (Django system checks pass)
   - `cd backend && python manage.py test` (81/81 unit tests pass)
3. **Full Integration & Handoff**:
   - Create `ADMIN_REPOSITORY_MERGE_FINAL.md`
   - Safely cleanup old sibling directory `smart-fyp-admin-backend/` outside workspace.

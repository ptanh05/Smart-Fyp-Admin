# SMART FYP MANAGEMENT SYSTEM — PRODUCTION CONFIGURATION PLAN

**Institution**: University of Transport and Communications (UTC)  
**Date**: August 18, 2026  
**Roles**: Senior Software Architect, DevOps Lead, Security Engineer  
**Target Repository**: `Smart-Fyp-Admin`  

---

## 1. Production Topology & Component Roles

```text
┌─────────────────────────────────────────┐
│        Smart-Fyp-Admin / frontend       │
│           (React 18 + Vite SPA)         │
│           Deployed to Vercel            │
└────────────────────┬────────────────────┘
                     │
              HTTPS REST API
                     │
┌────────────────────▼────────────────────┐
│        Smart-Fyp-Admin / backend        │
│        (Django REST Framework)          │
│           Deployed to Render            │
└────────────────────┬────────────────────┘
                     │
                Django ORM
                     │
┌────────────────────▼────────────────────┐
│            Neon PostgreSQL              │
│       (Existing Shared Database)        │
└─────────────────────────────────────────┘
```

---

## 2. Refactoring Plan & Modifications

### A. Backend (`backend/backend/settings.py`)
1. **Dynamic Environment Variable Parsing**:
   - `DEBUG`: Env boolean (`DEBUG=False` in production).
   - `SECRET_KEY`: Env string (required in production).
   - `ALLOWED_HOSTS`: Env list (`env.list('ALLOWED_HOSTS')`).
   - `CORS_ALLOWED_ORIGINS`: Env list (`env.list('CORS_ALLOWED_ORIGINS')`).
   - `CSRF_TRUSTED_ORIGINS`: Env list (`env.list('CSRF_TRUSTED_ORIGINS')`).
2. **Security Hardening**:
   - `SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=not DEBUG)`
   - `SESSION_COOKIE_SECURE = env.bool('SESSION_COOKIE_SECURE', default=not DEBUG)`
   - `CSRF_COOKIE_SECURE = env.bool('CSRF_COOKIE_SECURE', default=not DEBUG)`
   - `SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=31536000 if not DEBUG else 0)`
   - `STATIC_ROOT = BASE_DIR / 'staticfiles'` (Fixes `collectstatic`).
3. **Health Check Endpoint**:
   - Add `/health/` to `backend/backend/urls.py` for Render platform health checks.

### B. Cross-Domain Cookie Authentication (`backend/app/views.py`)
- In production (`DEBUG=False`), set `samesite="None"` and `secure=True` for `refresh_token` HttpOnly cookie so cross-origin requests from Vercel (`https://*.vercel.app`) to Render (`https://*.onrender.com`) send credentials securely.

### C. Render & Deployment Infrastructure (`backend/render.yaml`)
- Create `backend/render.yaml` with build (`pip install -r requirements.txt`) and start (`gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT`) commands.

### D. Documentation (`PRODUCTION_SMOKE_TEST.md`, `FINAL_PRODUCTION_DEPLOYMENT_AUDIT.md`)
- Create comprehensive smoke testing guide and production audit report.

---

## 3. Validation Matrix

- `python manage.py collectstatic --noinput` ──► `PASS`
- `python manage.py check --deploy` ──► Warnings evaluated & resolved via env flags
- `python manage.py test` ──► `5/5 PASS`
- `cd frontend && npx tsc --noEmit` ──► `0 Errors`
- `cd frontend && npm run build` ──► `PASS`

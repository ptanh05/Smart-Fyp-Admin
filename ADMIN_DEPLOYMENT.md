# SMART FYP MANAGEMENT SYSTEM — ADMIN DEPLOYMENT GUIDE

**Institution**: University of Transport and Communications (UTC)  
**Target Repository**: `Smart-Fyp-Admin`  

---

## 1. Deployment Topology Overview

The `Smart-Fyp-Admin` repository contains two decoupled application tiers:
- **Admin Frontend**: Static Single Page Application (`Smart-Fyp-Admin/frontend`) ──► Deployed to **Vercel** / **Netlify** / **Cloudflare Pages**
- **Admin Backend**: Django REST Framework Service (`Smart-Fyp-Admin/backend`) ──► Deployed to **Render** / **Railway** / **VPS Nginx+Gunicorn**
- **Database**: Managed Cloud Database ──► **Neon PostgreSQL**

> [!IMPORTANT]
> The Django REST Framework backend must be deployed as a standard Python WSGI/ASGI service (Render/Railway/VPS). Do NOT deploy the Django backend directly to Vercel static hosting.

---

## 2. Admin Frontend Deployment (Vercel)

### Step 1: Connect Repository
1. Import `Smart-Fyp-Admin` repository into Vercel.
2. Set **Root Directory**: `frontend`.

### Step 2: Configure Build Settings
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Step 3: Configure Environment Variables
In Vercel Project Settings ──► Environment Variables, set:
```env
VITE_API_BASE_URL=https://admin-api.yourdomain.com/app
```

---

## 3. Admin Backend Deployment (Render / Railway / VPS)

### Step 1: Service Configuration
- **Root Directory**: `backend`
- **Environment**: Python 3.12+
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT`

### Step 2: Environment Variables Configuration
Set the following production server environment variables:
```env
SECRET_KEY=your_production_secure_secret_key_min_64_characters
DEBUG=False
ALLOWED_HOSTS=admin-api.yourdomain.com,fyp-admin.utc.edu.vn
DATABASE_URL=postgres://user:password@ep-cool-host.neon.tech/smart_fyp?sslmode=require
CORS_ALLOWED_ORIGINS=https://admin.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://admin.yourdomain.com
```

---

## 4. Shared Database Safety Protocol (Neon PostgreSQL)

1. The Admin Backend connects directly to the shared Neon PostgreSQL instance via `DATABASE_URL`.
2. All Django models in `backend/app/models.py` map directly to existing database tables (`app_user`, `app_auditlog`, etc.).
3. **NEVER** run `python manage.py flush` or destructive migration drop scripts on production.

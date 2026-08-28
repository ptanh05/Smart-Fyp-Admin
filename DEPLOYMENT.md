# SMART FYP MANAGEMENT SYSTEM — ADMIN PORTAL DEPLOYMENT GUIDE

**Institution**: University of Transport and Communications (UTC)  
**Target Repository**: `Smart-Fyp-Admin`

---

## 1. Deployment Topology Overview

| Component | Platform | Technology Stack | Entrypoint / Build Output |
| :--- | :--- | :--- | :--- |
| **Admin Frontend** | **Vercel** | Vite 5 + React 18 + TypeScript | `frontend/dist` (Vite SPA) |
| **Admin Backend** | **Render** | Django 4.2/5.0 + DRF + WhiteNoise | `backend.wsgi:application` (Gunicorn) |
| **Database** | **Neon** | PostgreSQL 16 Managed Cloud DB | `DATABASE_URL` |

---

## 2. Frontend Deployment (Vercel)

### Step 1: Connect Repository to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** ➔ **Project** ➔ Import `Smart-Fyp-Admin`.
3. In **Root Directory**, set: `frontend` (or leave default `.` as root `vercel.json` will build automatically).
4. **Framework Preset**: `Vite`.

### Step 2: Build & Output Settings
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Configure Environment Variables (Vercel)
In Vercel **Project Settings** ➔ **Environment Variables**, add:

| Variable Name | Environment | Example / Value | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Production, Preview, Dev | `https://smart-fyp-admin-backend.onrender.com/app` | Live Render Backend API Base URL |

---

## 3. Backend Deployment (Render)

### Option A: Web Service via Render Dashboard (Manual)
1. In [Render Dashboard](https://dashboard.render.com), click **New +** ➔ **Web Service**.
2. Connect repository `Smart-Fyp-Admin`.
3. Fill in configuration settings:
   - **Name**: `smart-fyp-admin-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Region**: `Singapore` (or nearest to your database)
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command**: `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT`
   - **Health Check Path**: `/health/`

### Option B: Render Blueprint (Infrastructure as Code)
Use the included `render.yaml` at the root of the repository to deploy automatically via **Blueprints**.

### Backend Environment Variables (Render)

| Variable Name | Required | Example / Recommended Value | Description |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | Yes | `<64+ char random string>` | Django production secret key |
| `DEBUG` | Yes | `False` | Must be False in production |
| `ALLOWED_HOSTS` | Yes | `smart-fyp-admin-backend.onrender.com,localhost,127.0.0.1` | Allowed domain hosts |
| `DATABASE_URL` | Yes | `postgres://user:pass@ep-cool-host.neon.tech/smart_fyp?sslmode=require` | Neon PostgreSQL Connection URI |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://smart-fyp-admin.vercel.app` | Vercel frontend URL |
| `CSRF_TRUSTED_ORIGINS` | Yes | `https://smart-fyp-admin.vercel.app` | Vercel frontend URL |
| `ADMIN_REGISTRATION_SECRET` | Yes | `utc-smart-fyp-admin-secret-key-2026` | Key required for registering Admin accounts |
| `SECURE_SSL_REDIRECT` | Optional | `True` | Enforce HTTPS redirects |
| `SESSION_COOKIE_SECURE` | Optional | `True` | Secure session cookies over HTTPS |
| `CSRF_COOKIE_SECURE` | Optional | `True` | Secure CSRF cookies over HTTPS |

---

## 4. Local Development Verification

```bash
# Frontend
cd frontend
npm install
npm run dev # Runs on http://localhost:5174

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```

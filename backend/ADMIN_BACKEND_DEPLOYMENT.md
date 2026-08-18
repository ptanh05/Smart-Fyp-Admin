# SMART FYP MANAGEMENT SYSTEM — ADMIN BACKEND DEPLOYMENT GUIDE

**Target Environment**: Linux Production Server (Render / Railway / VPS / Docker)  
**Port**: `8001`  

---

## 1. Environment Variables Configuration (`.env`)

```env
SECRET_KEY=production_cryptographic_secret_key_64_characters_min
DEBUG=False
ALLOWED_HOSTS=fyp-admin-api.utc.edu.vn,127.0.0.1
DATABASE_URL=postgres://user:password@neon-db-host:5432/smart_fyp_db
CORS_ALLOWED_ORIGINS=https://fyp-admin.utc.edu.vn
CSRF_TRUSTED_ORIGINS=https://fyp-admin.utc.edu.vn
```

---

## 2. Production Service Commands

```bash
cd smart-fyp-admin-backend
pip install -r requirements.txt
python manage.py check
gunicorn backend.wsgi:application --bind 0.0.0.0:8001 --workers 4
```

# SMART FYP UTC — STANDALONE ADMIN BACKEND

Standalone Admin Backend Service for UTC Smart FYP Management System.

## Architecture
- Django 5 + Django REST Framework + SimpleJWT
- Connects to shared Neon PostgreSQL database (same DB as Main Backend)
- Enforces strict server-side `IsAdminUserRole` permission class
- Port 8001 (or configurable)

## Development Setup
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py test
python manage.py runserver 8001
```

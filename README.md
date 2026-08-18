# Smart FYP Admin

Independent Administrative Portal and REST API Backend for the UTC Smart FYP Management System.

---

## 1. System Architecture

- **Admin Frontend**: React 18 + TypeScript + Vite Single Page Application (`frontend/`)
- **Admin Backend**: Django 5 + Django REST Framework + SimpleJWT (`backend/`)
- **Database**: Neon PostgreSQL Shared Database (`DATABASE_URL`)

```text
┌────────────────────────┐                   ┌────────────────────────┐                   ┌────────────────────────┐
│     Admin Frontend     │  HTTPS REST API   │     Admin Backend      │    Django ORM     │    Neon PostgreSQL     │
│   Smart-Fyp-Admin/     │ ────────────────► │   Smart-Fyp-Admin/     │ ────────────────► │    (Shared Database)   │
│       frontend/        │     Port 8001     │        backend/        │   DATABASE_URL    │                        │
└────────────────────────┘                   └────────────────────────┘                   └────────────────────────┘
```

---

## 2. Local Development

### Terminal 1 — Start Admin Backend (Port 8001)
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python manage.py runserver 8001
```
The Django REST API runs on `http://localhost:8001/app/`.

### Terminal 2 — Start Admin Frontend (Port 5174)
```bash
cd frontend
npm install
npm run dev -- --port 5174
```
Open `http://localhost:5174` in your browser.

---

## 3. Environment Configurations

### `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:8001/app
```

### `backend/.env`
```env
SECRET_KEY=your_secure_django_secret_key
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
DATABASE_URL=postgres://user:password@neon_host/dbname
CORS_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
CSRF_TRUSTED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
```

---

## 4. Production Deployment Strategy

- **Frontend Deployment**: Deployed as static SPA to **Vercel** / **Netlify** / **Cloudflare Pages**.
- **Backend Deployment**: Deployed as WSGI/ASGI service to **Render** / **Railway** / **VPS Nginx + Gunicorn**.
- **Database Target**: **Neon PostgreSQL** (managed cloud database).

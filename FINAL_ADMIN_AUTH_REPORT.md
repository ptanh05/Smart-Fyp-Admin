# FINAL ADMIN AUTHENTICATION & RBAC REPORT

**Project**: Smart FYP Management System — Admin Portal  
**Scope**: Standalone Admin Portal Backend & Frontend  
**Database**: Shared Neon PostgreSQL Database (`neondb`)  
**Audit Date**: August 18, 2026  
**Status**: **PASSED & VERIFIED**

---

## 1. Overview & Repository Role Integrity

This repository is strictly the **ADMIN PORTAL ONLY**.
- **Role & Scope**: Administrative management of users (Students, Supervisors, Committee Members, External Examiners), system monitoring, security audits, and administrative workflows.
- **Strict Boundary**: No User Portal features, student/supervisor/committee dashboards, or end-user workflow engines are implemented in this repository. All managed accounts are provisioned into the shared Neon database for subsequent login through the separate User Portal.

---

## 2. Files Changed & Added

### Backend (`backend/`)
| File | Action | Purpose |
| :--- | :--- | :--- |
| `backend/backend/settings.py` | **Modified** | Configured `ADMIN_REGISTRATION_SECRET`, handled SQLite test runner environment cleanly for unit tests. |
| `backend/app/serializers.py` | **Modified** | Added `AdminRegisterSerializer`, `AdminCreateUserSerializer`, updated `AdminUserSerializer`. |
| `backend/app/views.py` | **Modified** | Added `AdminRegisterAPIView` (with secret key validation & enforced `admin` role assignment), added `POST` to `AdminUserManagementAPIView` for provisioning users, robust boolean parsing for status updates. |
| `backend/app/urls.py` | **Modified** | Registered route `admin/register/` for admin account registration. |
| `backend/app/tests/test_admin_backend.py` | **Modified** | Expanded test suite to 12 comprehensive unit tests covering registration, login, RBAC matrix, account provisioning, and audit logs. |

### Frontend (`frontend/`)
| File | Action | Purpose |
| :--- | :--- | :--- |
| `frontend/package.json` | **Modified** | Added test dependencies (`vitest`, `@testing-library/react`, `jsdom`, `@testing-library/jest-dom`) and `"test": "vitest run"` script. |
| `frontend/vite.config.ts` | **Modified** | Configured Vitest with jsdom environment and test setup. |
| `frontend/src/setupTests.ts` | **Added** | Added test setup importing `@testing-library/jest-dom`. |
| `frontend/src/api/auth.ts` | **Modified** | Added `register` API method with `AdminRegisterPayload` and `AdminRegisterResponse` types. |
| `frontend/src/api/users.ts` | **Modified** | Added `createUser` API method for provisioning student, supervisor, committee, examiner accounts. |
| `frontend/src/auth/AdminAuthContext.tsx` | **Modified** | Exposed `register` method through `useAdminAuth()`. |
| `frontend/src/pages/Login/AdminRegisterPage.tsx` | **Added** | Built dedicated Admin Registration page with Secret Key requirement and redirect. |
| `frontend/src/pages/Login/AdminLoginPage.tsx` | **Modified** | Added navigation link to `/register`. |
| `frontend/src/pages/Users/UserManagementPage.tsx` | **Modified** | Added "➕ Tạo Người Dùng Mới" modal allowing admins to provision accounts for all roles with validation. |
| `frontend/src/App.tsx` | **Modified** | Registered `/register` route. |
| `frontend/src/__tests__/auth.test.tsx` | **Added** | Unit tests for Admin Login, Register, validation, and secret key submission. |
| `frontend/src/__tests__/users.test.tsx` | **Added** | Integration tests for user list, create user modal, status toggle, and role change. |
| `frontend/src/__tests__/rbac.test.tsx` | **Added** | Unit tests for frontend RBAC route protection. |

---

## 3. Admin Authentication Flow

```
[ Unauthenticated User ]
       │
       ▼
[ POST /app/admin/register/ ] ──(Requires ADMIN_REGISTRATION_SECRET)
       │
       ├── Secret Invalid ──► 403 Forbidden (Rejects unauthorized public escalation)
       └── Secret Valid   ──► Backend enforces user_type='admin', is_staff=True
                              (Ignores any client/request role parameter)
                              Writes AuditLog event
                              Returns 201 Created
       │
       ▼
[ POST /app/admin/login/ ]
       │
       ├── Invalid Credentials / Deactivated ──► 401 / 403
       ├── Authenticated Non-Admin User (Student/Supervisor/etc) ──► 403 Forbidden
       └── Authenticated Admin (user_type='admin' / is_staff=True)
              │
              ├── Returns Access Token (15m lifetime)
              ├── Sets HttpOnly Refresh Cookie (7d lifetime)
              ├── Writes Login AuditLog event
              └── Redirects to Admin Dashboard
```

---

## 4. User Management & Provisioning Flow

```
[ Authenticated Admin on Admin Portal ]
       │
       ▼
[ POST /app/admin/users/ ]
       │
       ├── Validates username, email uniqueness, password strength (min 8 chars)
       ├── Whitelists role: STUDENT, SUPERVISOR, COMMITTEE_MEMBER, EXTERNAL_EXAMINER, ADMIN
       ├── Saves directly into shared `app_customuser` table in Neon PostgreSQL
       ├── Records action in `app_auditlog` table
       └── Account is immediately ready for user to login via separate USER PORTAL
```

---

## 5. RBAC Verification Matrix

| Endpoint | Unauthenticated | Student | Supervisor | Committee Member | External Examiner | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/app/admin/register/` | 403 (w/o key)<br>201 (w/ key) | N/A | N/A | N/A | N/A | N/A |
| `/app/admin/login/` | 401 | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `/app/admin/users/` (GET) | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `/app/admin/users/` (POST) | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **201 Created** |
| `/app/admin/users/<id>/` (PATCH) | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `/app/admin/security-center/` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `/app/audit-logs/` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `/app/audit-logs/stats/` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **200 OK** |

---

## 6. Database Verification

- **Shared Database Strategy**: Utilizes single source of truth in Neon PostgreSQL (`neondb`).
- **Models**:
  - `CustomUser` (`app_customuser`) — AbstractUser subclass with `user_type` choice field.
  - `AuditLog` (`app_auditlog`) — Complete audit trail for all administrative actions and security events.
- **Duplicate Entities**: 0 duplicate user models, 0 duplicate databases, 0 unnecessary migrations.

---

## 7. Test Results

### 1. Frontend Production Build (`npm run build`)
```bash
> smart-fyp-admin@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 109 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.76 kB │ gzip:  0.44 kB
dist/assets/index-Ct9HrZGN.css    4.58 kB │ gzip:  1.45 kB
dist/assets/index-XnGeMSJH.js   240.19 kB │ gzip: 78.65 kB
✓ built in 693ms
```

### 2. Frontend Vitest Suite (`npx vitest run`)
```bash
 RUN  v4.1.10 C:/Workspace/Thuc hanh cac mon nam 3/Năm 4/Project_1/Smart-Fyp-Admin/frontend

 ✓ src/__tests__/rbac.test.tsx (2 tests) 29ms
 ✓ src/__tests__/auth.test.tsx (4 tests) 180ms
 ✓ src/__tests__/users.test.tsx (3 tests) 380ms

 Test Files  3 passed (3)
      Tests  9 passed (9)
   Duration  1.50s
```

### 3. Backend Django Test Suite (`python manage.py test`)
```bash
Found 12 test(s).
Creating test database for alias 'default'...
System check identified no issues (0 silenced).
............
----------------------------------------------------------------------
Ran 12 tests in 15.682s

OK
Destroying test database for alias 'default'...
```

---

## 8. Remaining Issues

- **None**. All requested authentication endpoints, registration guardrails, managed user provisioning flows, RBAC matrix verifications, test suites, and build commands executed with 100% pass rate.

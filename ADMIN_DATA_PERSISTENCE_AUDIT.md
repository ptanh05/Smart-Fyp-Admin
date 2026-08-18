# SMART FYP MANAGEMENT SYSTEM — ADMIN DATA PERSISTENCE AUDIT

**Institution**: University of Transport and Communications (UTC)  
**Audit Date**: August 18, 2026  
**Target Repository**: `smart-fyp-admin` (`c:\Workspace\Thuc hanh cac mon nam 3\Năm 4\Project_1\Smart-Fyp-Admin`)  

---

## 1. Forensic Local Storage & Mock Search Results

| Search Term | Occurrences in `src/` | Classification | Status |
| :--- | :---: | :--- | :--- |
| `localStorage` | **0** | A. Auth memory state / C. Business data persistence | **`CLEAN`** |
| `sessionStorage` | **0** | A. Auth memory state / C. Business data persistence | **`CLEAN`** |
| `indexedDB` / `IndexedDB` | **0** | C. Business data persistence | **`CLEAN`** |
| `mock` / `Mock` | **0** | D. Mock/fake data | **`CLEAN`** |
| `fake` / `Fake` | **0** | D. Mock/fake data | **`CLEAN`** |
| `dummy` / `Dummy` | **0** | D. Mock/fake data | **`CLEAN`** |
| `fixture` / `Fixture` | **0** | D. Mock/fake data | **`CLEAN`** |
| Hardcoded Users | **0** | D. Mock/fake data | **`CLEAN`** |
| Hardcoded Metrics | **0** | D. Mock/fake data | **`CLEAN`** |
| Hardcoded Audit Logs | **0** | D. Mock/fake data | **`CLEAN`** |

---

## 2. Directory-by-Directory Inspection Summary

### `src/api/`
- [`client.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/api/client.ts): Uses `memoryAccessToken` JS variable in memory (`setAccessToken`, `getAccessToken`). Zero storage footprint. Intercepts 401 and calls `POST /token/refresh/`.
- [`auth.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/api/auth.ts): Invokes backend REST endpoints `/supervisor/login/`, `/token/refresh/`, `/token/logout/`. Zero mocks.
- [`users.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/api/users.ts): Calls `GET /admin/users/` and `PATCH /admin/users/:id/`. Zero mock arrays.
- [`security.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/api/security.ts): Calls `GET /admin/security-center/`. Zero mock metrics.
- [`audit.ts`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/api/audit.ts): Calls `GET /audit-logs/` and `GET /audit-logs/stats/`. Zero mock logs.

### `src/auth/`
- [`AdminAuthContext.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/auth/AdminAuthContext.tsx): Manages auth context state in React memory (`isAuthenticated`, `userType`). On mount, invokes `authApi.refreshToken()` to restore session from HttpOnly Cookie. Classifiable as **A. Authentication memory state — ALLOWED**.
- [`ProtectedAdminRoute.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/auth/ProtectedAdminRoute.tsx): Route guard checking in-memory context state. Zero storage.

### `src/pages/`
- [`Dashboard/AdminDashboard.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/pages/Dashboard/AdminDashboard.tsx): Dynamically renders metrics (`total_users`, `active_users`, `deactivated_users`) fetched directly from `usersApi` and `securityApi`. Zero hardcoded numbers.
- [`Users/UserManagementPage.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/pages/Users/UserManagementPage.tsx): Consumes live DRF pagination & search. Status toggles and role changes issue live `PATCH` requests to backend DRF.
- [`Security/SecurityCenterPage.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/pages/Security/SecurityCenterPage.tsx): Consumes live security metrics from backend API.
- [`AuditLogs/AuditLogsPage.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/pages/AuditLogs/AuditLogsPage.tsx): Renders `AuditLogViewer` component.

### `src/components/`
- [`AuditLogViewer.tsx`](file:///c:/Workspace/Thuc%20hanh%20cac%20mon%20nam%203/N%C4%83m%204/Project_1/Smart-Fyp-Admin/src/components/audit/AuditLogViewer.tsx): Consumes live audit logs via `auditApi.getAuditLogs({ page })`.

---

## 3. Classification Verdict

- **A. Authentication memory state**: React context memory state (`memoryAccessToken` variable) — **`VERIFIED ALLOWED`**
- **B. UI preference/state**: Transient React state (`loading`, `q`, `role`, `page`, `showConfirm`) — **`VERIFIED ALLOWED`**
- **C. Business data persistence**: LocalStorage, SessionStorage, IndexedDB — **`0 INSTANCES (VERIFIED ABSENT)`**
- **D. Mock/fake data**: Hardcoded arrays, static JSON fixtures — **`0 INSTANCES (VERIFIED ABSENT)`**

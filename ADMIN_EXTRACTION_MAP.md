# SMART FYP UTC — ADMIN EXTRACTION MIGRATION MAP

**Institution**: University of Transport and Communications (UTC)  
**Extraction Date**: August 18, 2026  
**Source Repository**: `smart-fyp-management` (`c:\Workspace\Thuc hanh cac mon nam 3\Năm 4\Project_1\smart-fyp-management`)  
**Target Project**: `smart-fyp-admin` (`c:\Workspace\Thuc hanh cac mon nam 3\Năm 4\Project_1\smart-fyp-admin`)  

---

## 1. Directory Structure Mapping

```text
smart-fyp-management/frontend/src/
├── pages/AdminDashboard.tsx              ──► smart-fyp-admin/src/pages/Dashboard/AdminDashboard.tsx
├── pages/AdminDashboard.css              ──► smart-fyp-admin/src/pages/Dashboard/AdminDashboard.css
├── components/AuditLogViewer.tsx          ──► smart-fyp-admin/src/components/audit/AuditLogViewer.tsx
├── components/AuditLogViewer.css          ──► smart-fyp-admin/src/components/audit/AuditLogViewer.css
├── components/SkeletonLoader.tsx         ──► smart-fyp-admin/src/components/common/SkeletonLoader.tsx
├── components/SkeletonLoader.css         ──► smart-fyp-admin/src/components/common/SkeletonLoader.css
├── components/Modal.css                  ──► smart-fyp-admin/src/components/common/Modal.css
├── services/api.ts (Admin subset)        ──► smart-fyp-admin/src/api/client.ts, users.ts, security.ts, audit.ts
└── types/index.ts (Admin subset)         ──► smart-fyp-admin/src/types/index.ts
```

---

## 2. Admin Component Extraction Matrix

| Original Component / Asset | New Standalone File Path | Extracted Responsibility | Dependencies |
| :--- | :--- | :--- | :--- |
| `AdminDashboard.tsx` | `smart-fyp-admin/src/pages/Dashboard/AdminDashboard.tsx` | Overview, User Management, Security Center, Audit Tabs | `api/users.ts`, `api/security.ts`, `AuditLogViewer.tsx` |
| `AdminDashboard.css` | `smart-fyp-admin/src/pages/Dashboard/AdminDashboard.css` | Styling for Admin Tab navigation, metrics cards, user tables | Vanilla CSS |
| `AuditLogViewer.tsx` | `smart-fyp-admin/src/components/audit/AuditLogViewer.tsx` | Log event table, pagination, event type filters | `api/audit.ts` |
| `AuditLogViewer.css` | `smart-fyp-admin/src/components/audit/AuditLogViewer.css` | Log table styling & status badge colors | Vanilla CSS |
| `services/api.ts` | `smart-fyp-admin/src/api/client.ts` | Axios instance with `withCredentials: true`, 401 interceptor | `axios` |
| `services/api.ts` | `smart-fyp-admin/src/api/users.ts` | `getAdminUsers()`, `updateAdminUser()` | `client.ts` |
| `services/api.ts` | `smart-fyp-admin/src/api/security.ts` | `getAdminSecurityCenter()` | `client.ts` |
| `services/api.ts` | `smart-fyp-admin/src/api/audit.ts` | `getAuditLogs()`, `getAuditLogStats()` | `client.ts` |
| `services/api.ts` | `smart-fyp-admin/src/api/auth.ts` | `login()`, `logout()`, `refresh()` | `client.ts` |
| `types/index.ts` | `smart-fyp-admin/src/types/index.ts` | `AdminUser`, `AdminSecurityMetrics`, `AuditLog`, `UserType` | TypeScript |
| NEW | `smart-fyp-admin/src/auth/AdminAuthContext.tsx` | Admin Auth Provider managing access token & user state | `api/auth.ts` |
| NEW | `smart-fyp-admin/src/auth/ProtectedAdminRoute.tsx` | Route guard verifying `user_type === 'admin'` | `AdminAuthContext` |
| NEW | `smart-fyp-admin/src/components/layout/AdminLayout.tsx` | Enterprise sidebar & navbar layout for standalone admin | React Router |
| NEW | `smart-fyp-admin/src/pages/Login/AdminLoginPage.tsx` | Isolated Admin Login screen | `AdminAuthContext` |

---

## 3. Exclusion List (DO NOT COPY)
The following frontend assets belong exclusively to Student/Supervisor/Committee/External Examiner workflows and are **EXCLUDED** from `smart-fyp-admin`:
- `StudentDashboard.tsx`, `SupervisorDashboard.tsx`, `CommitteeMemberDashboard.tsx`, `ExternalDashboard.tsx`
- `ChatRoom.tsx`, `CommentsSection.tsx`, `DocumentReview.tsx`, `DocumentsList.tsx`, `DocumentRequirementsManager.tsx`
- `EvaluationForm.tsx`, `ExternalEvaluationForm.tsx`, `UTCEvaluationSheetModal.tsx`
- `SupervisorAnalytics.tsx`, `CommitteeMemberAnalytics.tsx`, `ExternalManagement.tsx`
- Unrelated student/supervisor API methods in `api.ts`

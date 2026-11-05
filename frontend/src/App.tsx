import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './auth/AdminAuthContext';
import { ProtectedAdminRoute } from './auth/ProtectedAdminRoute';

// Route Code Splitting: Lazy-load admin pages for fast initial load & reduced bundle size
const AdminLoginPage = lazy(() => import('./pages/Login/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminRegisterPage = lazy(() => import('./pages/Login/AdminRegisterPage').then(m => ({ default: m.AdminRegisterPage })));
const AdminDashboard = lazy(() => import('./pages/Dashboard/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const BatchesPage = lazy(() => import('./pages/Batches/BatchesPage').then(m => ({ default: m.BatchesPage })));
const ArchivedBatchesPage = lazy(() => import('./pages/Batches/ArchivedBatchesPage').then(m => ({ default: m.ArchivedBatchesPage })));
const AllocationsPage = lazy(() => import('./pages/Allocations/AllocationsPage').then(m => ({ default: m.AllocationsPage })));
const TopicApprovalPage = lazy(() => import('./pages/Topics/TopicApprovalPage').then(m => ({ default: m.TopicApprovalPage })));
const OutlineManagementPage = lazy(() => import('./pages/Outline/OutlineManagementPage').then(m => ({ default: m.OutlineManagementPage })));
const EligibilityPage = lazy(() => import('./pages/Eligibility/EligibilityPage').then(m => ({ default: m.EligibilityPage })));
const ProgressMonitoringPage = lazy(() => import('./pages/Progress/ProgressMonitoringPage').then(m => ({ default: m.ProgressMonitoringPage })));
const CouncilsPage = lazy(() => import('./pages/Councils/CouncilsPage').then(m => ({ default: m.CouncilsPage })));
const DefenseManagementPage = lazy(() => import('./pages/Defense/DefenseManagementPage').then(m => ({ default: m.DefenseManagementPage })));
const UserManagementPage = lazy(() => import('./pages/Users/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const SupervisorsPage = lazy(() => import('./pages/Supervisors/SupervisorsPage').then(m => ({ default: m.SupervisorsPage })));
const SecurityCenterPage = lazy(() => import('./pages/Security/SecurityCenterPage').then(m => ({ default: m.SecurityCenterPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogs/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const AcademicStaffPage = lazy(() => import('./pages/AcademicStaff/AcademicStaffPage').then(m => ({ default: m.AcademicStaffPage })));

const AdminLoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
    <div
      style={{
        width: '36px',
        height: '36px',
        border: '3px solid #e2e8f0',
        borderTop: '3px solid #003366',
        borderRadius: '50%',
        animation: 'adminSpin 0.75s linear infinite',
      }}
    />
    <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 600 }}>Đang tải trang quản trị...</span>
  </div>
);

/**
 * Bọc route bằng quyền theo vai trò:
 *  - admin        : được vào TẤT CẢ nghiệp vụ
 *  - academic_staff (Giáo vụ Khoa): chỉ các nghiệp vụ thuộc Khoa
 * Truy cập trái quyền -> chuyển hướng về trang mặc định của vai trò.
 */
const RoleRoute: React.FC<{
  children: React.ReactNode;
  allow: Array<'admin' | 'academic_staff'>;
}> = ({ children, allow }) => {
  const { userType } = useAdminAuth();
  const role: 'admin' | 'academic_staff' =
    userType === 'academic_staff' ? 'academic_staff' : 'admin';

  if (!allow.includes(role)) {
    return <Navigate to={role === 'academic_staff' ? '/academic-staff' : '/dashboard'} replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Router>
      <AdminAuthProvider>
        <Suspense fallback={<AdminLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<AdminLoginPage />} />
            <Route path="/register" element={<AdminRegisterPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <AdminDashboard />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/batches"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <BatchesPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/archived-batches"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <ArchivedBatchesPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/allocations"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <AllocationsPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/topics"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <TopicApprovalPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/outlines"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <OutlineManagementPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/eligibility"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <EligibilityPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/progress"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <ProgressMonitoringPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/councils"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <CouncilsPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/defense"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin', 'academic_staff']}>
                    <DefenseManagementPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            {/* --- Chỉ Admin --- */}
            <Route
              path="/users"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin']}>
                    <UserManagementPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/supervisors"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin']}>
                    <SupervisorsPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/security"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin']}>
                    <SecurityCenterPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/audit-logs"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['admin']}>
                    <AuditLogsPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            {/* --- Chỉ Giáo vụ Khoa --- */}
            <Route
              path="/academic-staff"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['academic_staff']}>
                    <AcademicStaffPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/giao-vu"
              element={
                <ProtectedAdminRoute>
                  <RoleRoute allow={['academic_staff']}>
                    <AcademicStaffPage />
                  </RoleRoute>
                </ProtectedAdminRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AdminAuthProvider>
    </Router>
  );
};

export default App;

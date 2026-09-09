import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './auth/AdminAuthContext';
import { ProtectedAdminRoute } from './auth/ProtectedAdminRoute';

// Route Code Splitting: Lazy-load admin pages for fast initial load & reduced bundle size
const AdminLoginPage = lazy(() => import('./pages/Login/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminRegisterPage = lazy(() => import('./pages/Login/AdminRegisterPage').then(m => ({ default: m.AdminRegisterPage })));
const AdminDashboard = lazy(() => import('./pages/Dashboard/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const BatchesPage = lazy(() => import('./pages/Batches/BatchesPage').then(m => ({ default: m.BatchesPage })));
const AllocationsPage = lazy(() => import('./pages/Allocations/AllocationsPage').then(m => ({ default: m.AllocationsPage })));
const CouncilsPage = lazy(() => import('./pages/Councils/CouncilsPage').then(m => ({ default: m.CouncilsPage })));
const OutlineManagementPage = lazy(() => import('./pages/Outline/OutlineManagementPage').then(m => ({ default: m.OutlineManagementPage })));
const DefenseManagementPage = lazy(() => import('./pages/Defense/DefenseManagementPage').then(m => ({ default: m.DefenseManagementPage })));
const UserManagementPage = lazy(() => import('./pages/Users/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const SecurityCenterPage = lazy(() => import('./pages/Security/SecurityCenterPage').then(m => ({ default: m.SecurityCenterPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogs/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));

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
                  <AdminDashboard />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/batches"
              element={
                <ProtectedAdminRoute>
                  <BatchesPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/allocations"
              element={
                <ProtectedAdminRoute>
                  <AllocationsPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/councils"
              element={
                <ProtectedAdminRoute>
                  <CouncilsPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/outlines"
              element={
                <ProtectedAdminRoute>
                  <OutlineManagementPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/defense"
              element={
                <ProtectedAdminRoute>
                  <DefenseManagementPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedAdminRoute>
                  <UserManagementPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/security"
              element={
                <ProtectedAdminRoute>
                  <SecurityCenterPage />
                </ProtectedAdminRoute>
              }
            />

            <Route
              path="/audit-logs"
              element={
                <ProtectedAdminRoute>
                  <AuditLogsPage />
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

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './auth/AdminAuthContext';
import { ProtectedAdminRoute } from './auth/ProtectedAdminRoute';
import { AdminLoginPage } from './pages/Login/AdminLoginPage';
import { AdminRegisterPage } from './pages/Login/AdminRegisterPage';
import { AdminDashboard } from './pages/Dashboard/AdminDashboard';
import { BatchesPage } from './pages/Batches/BatchesPage';
import { AllocationsPage } from './pages/Allocations/AllocationsPage';
import { CouncilsPage } from './pages/Councils/CouncilsPage';
import { DefenseManagementPage } from './pages/Defense/DefenseManagementPage';
import { UserManagementPage } from './pages/Users/UserManagementPage';
import { SecurityCenterPage } from './pages/Security/SecurityCenterPage';
import { AuditLogsPage } from './pages/AuditLogs/AuditLogsPage';

export const App: React.FC = () => {
  return (
    <Router>
      <AdminAuthProvider>
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
      </AdminAuthProvider>
    </Router>
  );
};

export default App;

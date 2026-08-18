import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';

export const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userType, loading } = useAdminAuth();

  if (loading) {
    return <div className="utc-admin-loading">Đang xác thực quyền truy cập Admin...</div>;
  }

  if (!isAuthenticated || userType !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

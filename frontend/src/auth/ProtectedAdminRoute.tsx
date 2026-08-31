import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';

export const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userType, loading } = useAdminAuth();
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setShowSlowNotice(true);
      }, 3500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#f8fafc',
          color: '#1e293b',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #0284c7',
            borderRadius: '50%',
            animation: 'adminSpin 0.9s linear infinite',
            marginBottom: '1.25rem',
          }}
        />
        <style>{`@keyframes adminSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '1.1rem', color: '#0f172a' }}>
          Đang xác thực quyền truy cập Admin...
        </h3>
        {showSlowNotice && (
          <div style={{ marginTop: '1rem', maxWidth: '420px', fontSize: '0.875rem', color: '#64748b' }}>
            <p style={{ margin: '0 0 0.75rem 0' }}>
              Kết nối máy chủ đang mất nhiều thời gian (nếu máy chủ Render vừa được đánh thức từ chế độ ngủ).
            </p>
            <Link
              to="/login"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#0284c7',
                color: '#ffffff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Chuyển đến trang Đăng nhập
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated || userType !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

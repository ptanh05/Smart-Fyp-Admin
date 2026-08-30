import React, { useState, useEffect } from 'react';
import { securityApi } from '../../api/security';
import type { AdminSecurityMetrics } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { SkeletonTable } from '../../components/common/SkeletonLoader';

export const SecurityCenterPage: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminSecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await securityApi.getSecurityMetrics();
        setMetrics(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const totalUsers = metrics?.metrics?.total_users ?? metrics?.total_users ?? 0;
  const activeUsers = metrics?.metrics?.active_users ?? metrics?.active_users ?? 0;
  const deactivatedUsers = metrics?.metrics?.deactivated_users ?? metrics?.deactivated_users ?? 0;
  const adminCount = metrics?.metrics?.admin_count ?? 0;

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <div className="utc-dashboard-header">
          <div className="utc-header-text">
            <h2>🛡️ Trung Tâm Bảo Mật & Giám Sát Hệ Thống UTC</h2>
            <p>Kiểm soát cấu hình giao tiếp an toàn, bảo vệ dữ liệu đồ án tốt nghiệp và phân quyền người dùng</p>
          </div>
          <div className="utc-status-pill">
            <span className="utc-pulse-dot"></span>
            <span>Phòng Thủ Đa Tầng (Active)</span>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} columns={3} />
        ) : metrics ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#fff', padding: '1.75rem', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
                ⚙️ Cấu Hình Header & Giao Thức Bảo Mật
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontWeight: 600, color: '#166534' }}>HttpOnly Refresh Token Cookie</span>
                  <span style={{ fontSize: '0.78rem', background: '#16a34a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>BẬT (Lax)</span>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontWeight: 600, color: '#166534' }}>Content Security Policy (CSP)</span>
                  <span style={{ fontSize: '0.78rem', background: '#16a34a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>BẬT</span>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontWeight: 600, color: '#166534' }}>HSTS (31.5M seconds)</span>
                  <span style={{ fontSize: '0.78rem', background: '#16a34a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>BẬT</span>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontWeight: 600, color: '#166534' }}>CORS Strict Origin & Credentials Check</span>
                  <span style={{ fontSize: '0.78rem', background: '#16a34a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>BẬT</span>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontWeight: 600, color: '#166534' }}>WebSocket Single-Use Ticket</span>
                  <span style={{ fontSize: '0.78rem', background: '#16a34a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>BẬT</span>
                </li>
              </ul>
            </div>

            <div style={{ background: '#fff', padding: '1.75rem', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
                📊 Thống Kê Tài Khoản & Phân Quyền An Toàn
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Tổng Tài Khoản Đăng Ký:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{totalUsers}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Tài Khoản Đang Hoạt Động:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#15803d' }}>{activeUsers}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Tài Khoản Đã Vô Hiệu Hóa:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}>{deactivatedUsers}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Quản Trị Viên (Admin Root):</span>
                  <strong style={{ fontSize: '1.1rem', color: '#0284c7' }}>{adminCount}</strong>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p>Không thể tải dữ liệu bảo mật.</p>
        )}
      </div>
    </AdminLayout>
  );
};

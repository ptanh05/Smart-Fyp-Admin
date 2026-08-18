import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api/users';
import { securityApi } from '../../api/security';
import type { AdminSecurityMetrics } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import './AdminDashboard.css';

export const AdminDashboard: React.FC = () => {
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [metrics, setMetrics] = useState<AdminSecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      try {
        const userData = await usersApi.getUsers();
        setTotalUsers(userData.total || 0);

        const secData = await securityApi.getSecurityMetrics();
        setMetrics(secData);
      } catch (err) {
        console.error('Overview fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>📊 Tong Quan He Thong UTC Admin</h2>
        
        {loading ? (
          <SkeletonTable rows={3} columns={4} />
        ) : (
          <>
            <div className="utc-metrics-grid">
              <div className="utc-metric-card">
                <span className="utc-metric-icon">👥</span>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Tong So Nguoi Dung</span>
                  <span className="utc-metric-value">{totalUsers}</span>
                </div>
              </div>

              <div className="utc-metric-card">
                <span className="utc-metric-icon">🟢</span>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Tai Khoan Dang Hoat Dong</span>
                  <span className="utc-metric-value">{metrics?.active_users || totalUsers}</span>
                </div>
              </div>

              <div className="utc-metric-card">
                <span className="utc-metric-icon">⚠️</span>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Tai Khoan Vo Hieu Hoa</span>
                  <span className="utc-metric-value">{metrics?.deactivated_users ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="utc-admin-card" style={{ marginTop: '1.5rem' }}>
              <h3>Bao Mat & Anti-Attack Core UTC</h3>
              <p style={{ color: '#64748b', lineHeight: 1.6 }}>
                Project Standalone Admin dang giao tiep voi Django Backend thong qua REST API secure credential check: HttpOnly Cookie Refresh Tokens, 15-phut Access Token, single-use WebSocket tickets, CSP, HSTS va audit logs.
              </p>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

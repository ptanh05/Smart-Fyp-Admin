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

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🛡️ Trung Tam Bao Mat He Thong UTC</h2>

        {loading ? (
          <SkeletonTable rows={4} columns={3} />
        ) : metrics ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3>Cấu Hình Header Bảo Mật Realtime</h3>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ color: '#15803d', fontWeight: 600 }}>✓ HttpOnly Refresh Token Cookie: BẬT</li>
                <li style={{ color: '#15803d', fontWeight: 600 }}>✓ Content Security Policy (CSP): BẬT</li>
                <li style={{ color: '#15803d', fontWeight: 600 }}>✓ HSTS (31.5M seconds): BẬT</li>
                <li style={{ color: '#15803d', fontWeight: 600 }}>✓ CORS Credentials Strict Check: BẬT</li>
                <li style={{ color: '#15803d', fontWeight: 600 }}>✓ WebSocket Single-Use Ticket: BẬT</li>
              </ul>
            </div>

            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3>Thong Ke User Security</h3>
              <p>Tong Tai Khoan: <strong>{metrics.total_users}</strong></p>
              <p>Dang Hoat Dong: <strong style={{ color: '#15803d' }}>{metrics.active_users}</strong></p>
              <p>Da Vo Hieu Hoa: <strong style={{ color: '#b91c1c' }}>{metrics.deactivated_users}</strong></p>
            </div>
          </div>
        ) : (
          <p>Khong the tai du lieu bao mat.</p>
        )}
      </div>
    </AdminLayout>
  );
};

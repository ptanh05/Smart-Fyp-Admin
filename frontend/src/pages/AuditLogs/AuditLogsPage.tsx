import React from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import AuditLogViewer from '../../components/audit/AuditLogViewer';

export const AuditLogsPage: React.FC = () => {
  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>📜 Nhật Ký Hệ Thống UTC Audit Logs</h2>
        <AuditLogViewer />
      </div>
    </AdminLayout>
  );
};

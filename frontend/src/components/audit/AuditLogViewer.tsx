import React, { useState, useEffect } from 'react';
import { auditApi } from '../../api/audit';
import type { AuditLog } from '../../types';
import { SkeletonTable } from '../common/SkeletonLoader';
import './AuditLogViewer.css';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await auditApi.getAuditLogs({ page });
        setLogs(data.results || []);
        setTotalCount(data.count || 0);
      } catch (err: any) {
        setError('Không thể tải nhật ký hệ thống.');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [page]);

  if (loading) return <SkeletonTable rows={6} columns={5} />;
  if (error) return <div className="utc-error-alert">{error}</div>;

  return (
    <div className="audit-log-viewer">
      <div className="audit-table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Loại Thao Tác</th>
              <th>Người Thực Hiện</th>
              <th>Thời Gian</th>
              <th>Chi Tiết</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>#{log.id}</td>
                <td><span className="utc-badge primary">{log.action_type}</span></td>
                <td>{log.user_name || 'System'}</td>
                <td>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                <td>{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="utc-pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang Trước</button>
        <span>Trang {page} ({totalCount} sự kiện)</span>
        <button disabled={logs.length < 15} onClick={() => setPage(page + 1)}>Trang Sau</button>
      </div>
    </div>
  );
};
export default AuditLogViewer;

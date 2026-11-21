import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { FeatureAuditLogResponse, FeatureAuditLog } from '../../types';

const ACTION_LABEL: Record<string, string> = {
  admin_rubric_create: 'Tao rubric',
  admin_rubric_update: 'Cap nhat rubric',
  admin_rubric_delete: 'Xoa rubric',
  admin_rubric_deactivate: 'Vo hieu hoa rubric',
  admin_rubric_activate: 'Kich hoat rubric',
  admin_archive_embargo_set: 'Dat embargo',
  admin_archive_embargo_lift: 'Go embargo',
  admin_data_retention_apply: 'Ap dung luu giu du lieu',
  admin_criterion_create: 'Tao tieu chi',
  admin_criterion_update: 'Cap nhat tieu chi',
  admin_criterion_delete: 'Xoa tieu chi',
};

const ACTION_COLOR: Record<string, string> = {
  admin_rubric_delete: '#dc2626',
  admin_rubric_deactivate: '#d97706',
  admin_archive_embargo_set: '#7c3aed',
  admin_archive_embargo_lift: '#059669',
  admin_data_retention_apply: '#dc2626',
  admin_criterion_delete: '#dc2626',
};

const LogRow: React.FC<{ log: FeatureAuditLog }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const color = ACTION_COLOR[log.action_type] || '#003366';
  return (
    <>
      <tr
        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
          {new Date(log.created_at).toLocaleString('vi-VN')}
        </td>
        <td style={{ padding: '9px 12px' }}>
          <span style={{
            background: `${color}18`, color, borderRadius: 20,
            padding: '2px 10px', fontSize: '0.76rem', fontWeight: 700,
          }}>
            {ACTION_LABEL[log.action_type] ?? log.action_type}
          </span>
        </td>
        <td style={{ padding: '9px 12px', fontSize: '0.84rem', color: '#1e293b', maxWidth: 360 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}</div>
        </td>
        <td style={{ padding: '9px 12px', fontSize: '0.82rem', color: '#475569' }}>{log.user_name ?? '—'}</td>
        <td style={{ padding: '9px 12px', fontSize: '0.78rem', color: '#94a3b8' }}>{log.ip_address ?? '—'}</td>
        <td style={{ padding: '9px 12px', fontSize: '0.76rem', color: '#94a3b8' }}>
          {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: '#f8fafc' }}>
          <td colSpan={6} style={{ padding: '10px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.82rem' }}>
              {log.field_name && (
                <div><strong style={{ color: '#64748b' }}>Truong:</strong> {log.field_name}</div>
              )}
              {log.old_value && (
                <div><strong style={{ color: '#64748b' }}>Gia tri cu:</strong> <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 4 }}>{log.old_value}</code></div>
              )}
              {log.new_value && (
                <div><strong style={{ color: '#64748b' }}>Gia tri moi:</strong> <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 4 }}>{log.new_value}</code></div>
              )}
              <div><strong style={{ color: '#64748b' }}>Mo ta day du:</strong> {log.description}</div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const FeatureAuditLogsPage: React.FC = () => {
  const [logData, setLogData] = useState<FeatureAuditLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await featuresApi.getFeatureAuditLogs({
        page,
        action_type: filterAction || undefined,
      });
      setLogData(data);
    } catch {
      setError('Loi tai nhat ky hanh dong.');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = logData ? Math.ceil(logData.count / (logData.page_size || 30)) : 1;

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            Nhat Ky Hanh Dong Quan Tri (Feature Audit)
          </h2>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{ background: '#003366', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            {loading ? 'Dang tai...' : 'Lam moi'}
          </button>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
          >
            <option value="">-- Tat ca hanh dong --</option>
            {logData?.action_types?.map((at) => (
              <option key={at} value={at}>{ACTION_LABEL[at] ?? at}</option>
            ))}
          </select>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}

        {loading && <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Dang tai...</div>}

        {logData && (
          <>
            <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 10 }}>
              {logData.count} ban ghi &bull; Trang {page}/{totalPages}
            </div>

            {logData.results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Chua co nhat ky nao.</div>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Thoi gian', 'Hanh dong', 'Mo ta', 'Nguoi thuc hien', 'IP', ''].map((h) => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logData.results.map((log) => <LogRow key={log.id} log={log} />)}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', background: page <= 1 ? '#f8fafc' : '#fff' }}
                >
                  Truoc
                </button>
                <span style={{ padding: '5px 14px', fontSize: '0.85rem', color: '#475569' }}>{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', background: page >= totalPages ? '#f8fafc' : '#fff' }}
                >
                  Tiep
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

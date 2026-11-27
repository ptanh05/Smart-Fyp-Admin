import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { FeatureAuditLogResponse, FeatureAuditLog } from '../../types';
import './FeatureAuditLogsPage.css';

const ACTION_LABEL: Record<string, string> = {
  admin_rubric_create: 'Tạo rubric',
  admin_rubric_update: 'Cập nhật rubric',
  admin_rubric_delete: 'Xóa rubric',
  admin_rubric_deactivate: 'Vô hiệu hóa rubric',
  admin_rubric_activate: 'Kích hoạt rubric',
  admin_archive_embargo_set: 'Đặt hạn chế công bố (Embargo)',
  admin_archive_embargo_lift: 'Gỡ hạn chế công bố (Embargo)',
  admin_data_retention_apply: 'Áp dụng chính sách lưu giữ dữ liệu',
  admin_criterion_create: 'Tạo tiêu chí',
  admin_criterion_update: 'Cập nhật tiêu chí',
  admin_criterion_delete: 'Xóa tiêu chí',
};

const ACTION_TONE: Record<string, 'danger' | 'warning' | 'purple' | 'success' | 'default'> = {
  admin_rubric_delete: 'danger',
  admin_rubric_deactivate: 'warning',
  admin_archive_embargo_set: 'purple',
  admin_archive_embargo_lift: 'success',
  admin_rubric_activate: 'success',
  admin_data_retention_apply: 'danger',
  admin_criterion_delete: 'danger',
};

const LogRow: React.FC<{ log: FeatureAuditLog }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const tone = ACTION_TONE[log.action_type] ?? 'default';
  const badgeClass = tone === 'default' ? 'fal-badge' : `fal-badge fal-badge--${tone}`;

  return (
    <>
      <tr className="fal-row" onClick={() => setExpanded((v) => !v)}>
        <td className="fal-td-time">
          {new Date(log.created_at).toLocaleString('vi-VN')}
        </td>
        <td>
          <span className={badgeClass}>
            {ACTION_LABEL[log.action_type] ?? log.action_type}
          </span>
        </td>
        <td className="fal-td-desc">
          <div className="fal-desc-truncate" title={log.description}>
            {log.description}
          </div>
        </td>
        <td className="fal-td-user">{log.user_name ?? '—'}</td>
        <td className="fal-td-ip">{log.ip_address ?? '—'}</td>
        <td className="fal-td-chevron">{expanded ? '▲' : '▼'}</td>
      </tr>
      {expanded && (
        <tr className="fal-detail-row">
          <td colSpan={6} className="fal-detail-cell">
            <div className="fal-detail-grid">
              {log.field_name && (
                <div>
                  <span className="fal-detail-label">Trường:</span>
                  {log.field_name}
                </div>
              )}
              {log.old_value && (
                <div>
                  <span className="fal-detail-label">Giá trị cũ:</span>
                  <code className="fal-detail-code">{log.old_value}</code>
                </div>
              )}
              {log.new_value && (
                <div>
                  <span className="fal-detail-label">Giá trị mới:</span>
                  <code className="fal-detail-code">{log.new_value}</code>
                </div>
              )}
              <div>
                <span className="fal-detail-label">Mô tả đầy đủ:</span>
                {log.description}
              </div>
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
      setError('Lỗi tải nhật ký hành động.');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = logData ? Math.max(1, Math.ceil(logData.count / (logData.page_size || 30))) : 1;

  return (
    <AdminLayout>
      <div className="fal-page">
        <div className="fal-header">
          <div className="fal-header-text">
            <h2>Nhật Ký Hành Động Quản Trị</h2>
            <p>
              Theo dõi chi tiết các thao tác cấu hình rubric, hạn chế công bố lưu trữ và áp dụng chính sách dữ liệu
            </p>
          </div>
          <button onClick={fetchLogs} disabled={loading} className="fal-refresh-btn">
            {loading ? <><span className="m-spinner" aria-hidden="true" /> Đang tải...</> : 'Làm mới'}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="fal-filter-bar">
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            className="fal-select"
            aria-label="Lọc theo loại hành động"
          >
            <option value="">-- Tất cả hành động --</option>
            {logData?.action_types?.map((at) => (
              <option key={at} value={at}>
                {ACTION_LABEL[at] ?? at}
              </option>
            ))}
          </select>
          {logData && (
            <div className="fal-meta">
              {logData.count} bản ghi &bull; Trang {page}/{totalPages}
            </div>
          )}
        </div>

        {error && <div className="fal-alert-error">{error}</div>}

        {loading && !logData && <div className="fal-loading">Đang tải...</div>}

        {logData && (
          <>
            {logData.results.length === 0 ? (
              <div className="fal-empty">Chưa có nhật ký nào.</div>
            ) : (
              <div className="fal-table-card">
                <table className="m-stagger fal-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hành động</th>
                      <th>Mô tả</th>
                      <th>Người thực hiện</th>
                      <th>Địa chỉ IP</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {logData.results.map((log) => (
                      <LogRow key={log.id} log={log} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="fal-pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="fal-page-btn"
                >
                  Trước
                </button>
                <span className="fal-page-info">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="fal-page-btn"
                >
                  Tiếp
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

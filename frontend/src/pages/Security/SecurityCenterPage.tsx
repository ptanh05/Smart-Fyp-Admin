import React, { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../api/security';
import type { AdminSecurityMetrics, AdminSecurityHeaders } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import './SecurityCenterPage.css';

interface SecurityProtocolItem {
  key: keyof AdminSecurityHeaders;
  label: string;
  description: string;
}

const SECURITY_PROTOCOLS: SecurityProtocolItem[] = [
  {
    key: 'httponly_cookies',
    label: 'Cookie làm mới HttpOnly',
    description: 'Ngăn JavaScript truy cập mã thông báo làm mới, bảo vệ trước tấn công XSS',
  },
  {
    key: 'content_security_policy',
    label: 'Chính sách bảo mật nội dung (CSP)',
    description: 'Kiểm soát nguồn tài nguyên được phép tải và thực thi trên trình duyệt',
  },
  {
    key: 'hsts_production',
    label: 'Bắt buộc HTTPS (HSTS)',
    description: 'Ép buộc sử dụng kết nối mã hóa HTTPS trong môi trường vận hành thực tế',
  },
  {
    key: 'cors_credentials',
    label: 'Kiểm tra nguồn gốc CORS',
    description: 'Chỉ cho phép các tên miền hợp lệ gửi yêu cầu kèm thông tin xác thực',
  },
  {
    key: 'magic_bytes_file_inspection',
    label: 'Kiểm tra chữ ký tệp (Magic Bytes)',
    description: 'Xác thực định dạng thật của tệp tải lên thông qua chữ ký nhị phân',
  },
  {
    key: 'websocket_one_time_tickets',
    label: 'Vé WebSocket dùng một lần',
    description: 'Xác thực kết nối thời gian thực bằng vé tạm thời chỉ dùng một lần',
  },
  {
    key: 'rate_limiting_active',
    label: 'Giới hạn tốc độ truy cập (Rate Limit)',
    description: 'Ngăn chặn lạm dụng API và các cuộc tấn công dò mật khẩu tự động',
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  student: 'Sinh viên',
  supervisor: 'Giảng viên',
  committee_member: 'Hội đồng',
  external_examiner: 'Phản biện ngoài',
  academic_staff: 'Giáo vụ',
};

export const SecurityCenterPage: React.FC = () => {
  const [data, setData] = useState<AdminSecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await securityApi.getSecurityMetrics();
      setData(response);
    } catch {
      setError('Không thể tải dữ liệu trung tâm bảo mật. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const counts = data?.metrics;
  const headers = data?.security_headers;
  const recentAudits = data?.recent_audits ?? [];

  const activeProtocolCount = headers
    ? SECURITY_PROTOCOLS.filter((p) => headers[p.key] === true).length
    : 0;
  const allProtocolsActive = headers !== undefined && activeProtocolCount === SECURITY_PROTOCOLS.length;

  const kpiItems = [
    {
      label: 'Tổng tài khoản',
      value: counts?.total_users ?? data?.total_users ?? 0,
      tone: 'navy',
    },
    {
      label: 'Đang hoạt động',
      value: counts?.active_users ?? data?.active_users ?? 0,
      tone: 'success',
    },
    {
      label: 'Đã vô hiệu hóa',
      value: counts?.deactivated_users ?? data?.deactivated_users ?? 0,
      tone: 'danger',
    },
    {
      label: 'Quản trị viên',
      value: counts?.admin_count ?? 0,
      tone: 'primary',
    },
    {
      label: 'Sinh viên',
      value: counts?.student_count ?? 0,
      tone: 'default',
    },
    {
      label: 'Giảng viên hướng dẫn',
      value: counts?.supervisor_count ?? 0,
      tone: 'default',
    },
    {
      label: 'Đợt đồ án',
      value: counts?.batches_count ?? 0,
      tone: 'navy',
    },
    {
      label: 'Đồ án tốt nghiệp',
      value: counts?.projects_count ?? 0,
      tone: 'primary',
    },
    {
      label: 'Hội đồng bảo vệ',
      value: counts?.councils_count ?? 0,
      tone: 'default',
    },
  ];

  return (
    <AdminLayout>
      <div className="sec-page">
        {/* Dark Navy Gradient Banner Header */}
        <div className="sec-banner">
          <div className="sec-banner-text">
            <h2>Trung Tâm Bảo Mật &amp; Giám Sát Hệ Thống UTC</h2>
            <p>
              Kiểm soát cấu hình giao tiếp an toàn, bảo vệ dữ liệu đồ án tốt nghiệp và giám sát nhật ký truy cập
            </p>
          </div>
          <div className="sec-banner-actions">
            <div
              className={
                !headers || allProtocolsActive
                  ? 'sec-status-pill'
                  : 'sec-status-pill sec-status-pill--warn'
              }
            >
              <span
                className={
                  !headers || allProtocolsActive
                    ? 'sec-pulse-dot'
                    : 'sec-pulse-dot sec-pulse-dot--warn'
                }
              />
              <span>
                {headers
                  ? `Phòng thủ đa tầng (${activeProtocolCount}/${SECURITY_PROTOCOLS.length})`
                  : 'Phòng thủ đa tầng'}
              </span>
            </div>
            <button onClick={fetchMetrics} disabled={loading} className="sec-refresh-btn">
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        {error && (
          <div className="sec-error-box">
            <span>{error}</span>
            <button onClick={fetchMetrics} className="sec-retry-btn">
              Thử lại
            </button>
          </div>
        )}

        {loading && !data ? (
          <SkeletonTable rows={5} columns={4} />
        ) : data ? (
          <>
            {/* KPI Metric Grid (All 9 counts) */}
            <div className="sec-card">
              <div className="sec-card-header">
                <h3 className="sec-card-title">Thống Kê Tài Khoản &amp; Tài Nguyên Hệ Thống</h3>
                <span className="sec-card-subtitle">Số liệu tổng hợp trực tiếp từ máy chủ</span>
              </div>
              <div className="sec-kpi-grid">
                {kpiItems.map((item) => (
                  <div key={item.label} className="sec-kpi-card">
                    <span className="sec-kpi-label">{item.label}</span>
                    <strong
                      className={
                        item.tone === 'default'
                          ? 'sec-kpi-value'
                          : `sec-kpi-value sec-kpi-value--${item.tone}`
                      }
                    >
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Protocol Cards */}
            <div className="sec-card">
              <div className="sec-card-header">
                <h3 className="sec-card-title">Cấu Hình Giao Thức &amp; Lớp Bảo Vệ</h3>
                <span className="sec-card-subtitle">
                  Trạng thái thực tế từ cấu hình bảo mật hệ thống
                </span>
              </div>
              <div className="sec-protocol-grid">
                {SECURITY_PROTOCOLS.map((proto) => {
                  const val = headers?.[proto.key];
                  const isOn = val === true;
                  const isOff = val === false;
                  const itemClass = isOn
                    ? 'sec-protocol-item sec-protocol-item--on'
                    : isOff
                      ? 'sec-protocol-item sec-protocol-item--off'
                      : 'sec-protocol-item';
                  const badgeClass = isOn
                    ? 'sec-badge sec-badge--on'
                    : isOff
                      ? 'sec-badge sec-badge--off'
                      : 'sec-badge sec-badge--unknown';
                  const badgeText = isOn ? 'BẬT' : isOff ? 'TẮT' : 'Chưa rõ';

                  return (
                    <div key={proto.key} className={itemClass}>
                      <div className="sec-protocol-info">
                        <span className="sec-protocol-name">{proto.label}</span>
                        <span className="sec-protocol-desc">{proto.description}</span>
                      </div>
                      <span className={badgeClass}>{badgeText}</span>
                    </div>
                  );
                })}

                {headers?.jwt_access_expiry_minutes !== undefined && (
                  <div className="sec-protocol-item sec-protocol-item--info">
                    <div className="sec-protocol-info">
                      <span className="sec-protocol-name">Thời hạn phiên truy cập JWT</span>
                      <span className="sec-protocol-desc">
                        Thời gian hiệu lực tối đa của mỗi mã truy cập trước khi cần làm mới
                      </span>
                    </div>
                    <span className="sec-badge sec-badge--info">
                      {headers.jwt_access_expiry_minutes} phút
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Audit Logs Table */}
            <div className="sec-card">
              <div className="sec-card-header">
                <h3 className="sec-card-title">
                  Nhật Ký Kiểm Toán Gần Đây ({recentAudits.length})
                </h3>
                <span className="sec-card-subtitle">Các sự kiện bảo mật và thao tác mới nhất</span>
              </div>
              {recentAudits.length === 0 ? (
                <div className="sec-empty">Chưa có nhật ký kiểm toán gần đây.</div>
              ) : (
                <div className="sec-table-wrap">
                  <table className="sec-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Hành động</th>
                        <th>Mô tả</th>
                        <th>Người thực hiện</th>
                        <th>Vai trò</th>
                        <th>Địa chỉ IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAudits.map((log) => (
                        <tr key={log.id}>
                          <td className="sec-td-time">
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td>
                            <span className="sec-action-chip">{log.action_type}</span>
                          </td>
                          <td className="sec-desc-cell">{log.description || '—'}</td>
                          <td>{log.user_name || 'Hệ thống'}</td>
                          <td>
                            {log.user_role
                              ? (ROLE_LABELS[log.user_role] ?? log.user_role)
                              : '—'}
                          </td>
                          <td className="sec-td-ip">{log.ip_address || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
};

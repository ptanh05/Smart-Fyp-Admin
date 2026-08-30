import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../../api/users';
import { securityApi } from '../../api/security';
import { batchesApi, type AcademicBatch } from '../../api/batches';
import type { AdminSecurityMetrics, AuditLog, UserCounts } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import './AdminDashboard.css';

export const AdminDashboard: React.FC = () => {
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [userCounts, setUserCounts] = useState<UserCounts | null>(null);
  const [metrics, setMetrics] = useState<AdminSecurityMetrics | null>(null);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, secData, batchesData] = await Promise.allSettled([
        usersApi.getUsers(),
        securityApi.getSecurityMetrics(),
        batchesApi.getBatches(),
      ]);

      if (userData.status === 'fulfilled') {
        setTotalUsers(userData.value.total || 0);
        setUserCounts(userData.value.counts || null);
      }

      if (secData.status === 'fulfilled') {
        setMetrics(secData.value);
      }

      if (batchesData.status === 'fulfilled') {
        setBatches(batchesData.value || []);
      }

      setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.error('Overview fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const activeStudents = userCounts?.students ?? metrics?.metrics?.student_count ?? 0;
  const activeSupervisors = userCounts?.supervisors ?? metrics?.metrics?.supervisor_count ?? 0;
  const totalProjects = metrics?.metrics?.projects_count ?? (Array.isArray(batches) ? batches.reduce((acc, b) => acc + (b.project_count || 0), 0) : 0);
  const totalBatches = metrics?.metrics?.batches_count ?? (Array.isArray(batches) ? batches.length : 0);
  const recentAudits: AuditLog[] = metrics?.recent_audits || [];

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        {/* Top Header Banner */}
        <div className="utc-dashboard-header">
          <div className="utc-header-text">
            <h2>🎓 Tổng Quan Hệ Thống Quản Trị ĐATN UTC</h2>
            <p>Khoa Công Nghệ Thông Tin — Trường Đại học Giao thông Vận tải</p>
          </div>
          <div className="utc-header-actions">
            <div className="utc-status-pill">
              <span className="utc-pulse-dot"></span>
              <span>Hệ Thống & API Sẵn Sàng</span>
            </div>
            <button className="utc-refresh-btn" onClick={fetchOverview} title="Tải lại dữ liệu">
              🔄 {lastRefreshed ? `Cập nhật: ${lastRefreshed}` : 'Làm mới'}
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : (
          <>
            {/* Key Metrics KPI Cards */}
            <div className="utc-metrics-grid">
              <div className="utc-metric-card">
                <div className="utc-metric-icon blue">👥</div>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Tổng Số Người Dùng</span>
                  <span className="utc-metric-value">{totalUsers || metrics?.metrics?.total_users || 0}</span>
                  <span className="utc-metric-subtext">
                    Đang hoạt động: <strong>{metrics?.metrics?.active_users ?? totalUsers}</strong> tài khoản
                  </span>
                </div>
              </div>

              <div className="utc-metric-card">
                <div className="utc-metric-icon green">🎓</div>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Sinh Viên Làm Đồ Án</span>
                  <span className="utc-metric-value">{activeStudents}</span>
                  <span className="utc-metric-subtext">
                    CNTT: <strong>{userCounts?.cntt_students ?? '-'}</strong> | KHMT: <strong>{userCounts?.khmt_students ?? '-'}</strong>
                  </span>
                </div>
              </div>

              <div className="utc-metric-card">
                <div className="utc-metric-icon purple">👨‍🏫</div>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Giảng Viên & Hội Đồng</span>
                  <span className="utc-metric-value">{activeSupervisors}</span>
                  <span className="utc-metric-subtext">
                    Hội đồng bảo vệ: <strong>{metrics?.metrics?.councils_count ?? 0}</strong> hội đồng
                  </span>
                </div>
              </div>

              <div className="utc-metric-card">
                <div className="utc-metric-icon amber">📁</div>
                <div className="utc-metric-info">
                  <span className="utc-metric-label">Đợt ĐATN & Đề Tài</span>
                  <span className="utc-metric-value">{totalProjects}</span>
                  <span className="utc-metric-subtext">
                    Trong <strong>{totalBatches}</strong> đợt học phần đang quản lý
                  </span>
                </div>
              </div>
            </div>

            {/* Redesigned Security & Anti-Attack Core UTC */}
            <div className="utc-security-section">
              <div className="utc-section-header">
                <div className="utc-section-title-group">
                  <h3>🛡️ Trung Tâm Bảo Mật & Phòng Thủ Hệ Thống UTC (Security & Anti-Attack Core)</h3>
                  <p>
                    Kiến trúc phân tầng bảo vệ dữ liệu độc lập giữa Standalone Admin Portal và Django REST Backend với cơ chế xác thực đa lớp.
                  </p>
                </div>
                <div className="utc-security-badge-shield">
                  🔒 CẤP ĐỘ BẢO MẬT CAO (ENTERPRISE)
                </div>
              </div>

              <div className="utc-security-grid">
                <div className="utc-security-card">
                  <div className="utc-sec-card-head">
                    <div className="utc-sec-card-icon">🍪</div>
                    <span className="utc-sec-status-tag active">✓ Đang Bật</span>
                  </div>
                  <div className="utc-sec-card-body">
                    <h4>HttpOnly Cookie Refresh Tokens</h4>
                    <p>Refresh token được lưu trong Cookie HttpOnly với cờ SameSite=Lax, ngăn chặn toàn bộ nguy cơ tấn công XSS đánh cắp phiên.</p>
                  </div>
                </div>

                <div className="utc-security-card">
                  <div className="utc-sec-card-head">
                    <div className="utc-sec-card-icon">⏱️</div>
                    <span className="utc-sec-status-tag active">✓ 15 Phút Expiry</span>
                  </div>
                  <div className="utc-sec-card-body">
                    <h4>Short-Lived JWT Access Token</h4>
                    <p>Access Token giới hạn hiệu lực 15 phút, tự động nạp ngầm qua cơ chế Silent Token Rotation đảm bảo phiên người dùng an toàn.</p>
                  </div>
                </div>

                <div className="utc-security-card">
                  <div className="utc-sec-card-head">
                    <div className="utc-sec-card-icon">🎫</div>
                    <span className="utc-sec-status-tag active">✓ Single-Use</span>
                  </div>
                  <div className="utc-sec-card-body">
                    <h4>WebSocket Ticket Authentication</h4>
                    <p>Vé định danh một lần (Single-use ticket) dùng cho kết nối thời gian thực thông báo điểm và trạng thái hội đồng bảo vệ.</p>
                  </div>
                </div>

                <div className="utc-security-card">
                  <div className="utc-sec-card-head">
                    <div className="utc-sec-card-icon">🌐</div>
                    <span className="utc-sec-status-tag active">✓ HSTS & CSP</span>
                  </div>
                  <div className="utc-sec-card-body">
                    <h4>Chính Sách CSP & HSTS Chuẩn Quốc Tế</h4>
                    <p>Ép buộc HTTPS thông qua HSTS (31.5M giây) và Content Security Policy ngăn ngừa MIME-sniffing, Clickjacking và giả mạo nguồn.</p>
                  </div>
                </div>

                <div className="utc-security-card">
                  <div className="utc-sec-card-head">
                    <div className="utc-sec-card-icon">📄</div>
                    <span className="utc-sec-status-tag notice">✓ Magic-Bytes Guard</span>
                  </div>
                  <div className="utc-sec-card-body">
                    <h4>Kiểm Soát Tải File & Import Excel</h4>
                    <p>Quét chữ ký nhị phân (Magic Bytes) và MIME-Type của toàn bộ file Excel/Word/PDF tải lên, loại bỏ nguy cơ tải mã độc nhúng.</p>
                  </div>
                </div>

                <div className="utc-security-card">
                  <div className="utc-sec-card-head">
                    <div className="utc-sec-card-icon">📜</div>
                    <span className="utc-sec-status-tag active">✓ Real-time Audit</span>
                  </div>
                  <div className="utc-sec-card-body">
                    <h4>Audit Logging & IP Tracking</h4>
                    <p>Lưu vết đầy đủ địa chỉ IP, tài khoản thực hiện, thời gian và thay đổi dữ liệu nhạy cảm phục vụ công tác giám sát định kỳ.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="utc-quick-actions-section">
              <div className="utc-section-title-group">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#0f172a' }}>
                  ⚡ Lối Tắt Nghiệp Vụ Quản Trị ĐATN
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                  Truy cập nhanh các phân hệ nghiệp vụ cốt lõi của hội đồng và phòng đào tạo.
                </p>
              </div>

              <div className="utc-actions-grid">
                <Link to="/users" className="utc-action-card">
                  <div className="utc-action-icon">👥</div>
                  <div className="utc-action-info">
                    <span className="utc-action-title">Quản Lý Người Dùng</span>
                    <span className="utc-action-desc">Tạo tài khoản, phân quyền, import Excel danh sách SV & GVHD</span>
                  </div>
                </Link>

                <Link to="/batches" className="utc-action-card">
                  <div className="utc-action-icon">📅</div>
                  <div className="utc-action-info">
                    <span className="utc-action-title">Kỳ Học & Lớp Học Phần</span>
                    <span className="utc-action-desc">Quản lý đợt bảo vệ tốt nghiệp K60, K61, K62, K63</span>
                  </div>
                </Link>

                <Link to="/allocations" className="utc-action-card">
                  <div className="utc-action-icon">🤝</div>
                  <div className="utc-action-info">
                    <span className="utc-action-title">Phân Công GVHD Tự Động</span>
                    <span className="utc-action-desc">Thuật toán ghép cặp Min-Cost Max-Flow tối ưu nguyện vọng</span>
                  </div>
                </Link>

                <Link to="/councils" className="utc-action-card">
                  <div className="utc-action-icon">⚖️</div>
                  <div className="utc-action-info">
                    <span className="utc-action-title">Hội Đồng & Phản Biện</span>
                    <span className="utc-action-desc">Thành lập hội đồng, gán phản biện chéo và lịch bảo vệ</span>
                  </div>
                </Link>

                <Link to="/defense" className="utc-action-card">
                  <div className="utc-action-icon">📝</div>
                  <div className="utc-action-info">
                    <span className="utc-action-title">Điểm & Biên Bản ĐATN</span>
                    <span className="utc-action-desc">Xuất biên bản chấm điểm Excel và tờ trình Word chính thức</span>
                  </div>
                </Link>

                <Link to="/security" className="utc-action-card">
                  <div className="utc-action-icon">🛡️</div>
                  <div className="utc-action-info">
                    <span className="utc-action-title">Trung Tâm Giám Sát An Ninh</span>
                    <span className="utc-action-desc">Kiểm tra thông số bảo mật, phiên làm việc và header realtime</span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Recent Audit Activity Table */}
            {recentAudits.length > 0 && (
              <div className="utc-audits-section">
                <div className="utc-section-header" style={{ marginBottom: '0.5rem' }}>
                  <div className="utc-section-title-group">
                    <h3>📜 Nhật Ký Hoạt Động & Thao Tác Gần Đây</h3>
                    <p>Các hành động quản trị, cập nhật điểm và điều chỉnh hệ thống mới nhất.</p>
                  </div>
                  <Link to="/audit-logs" className="utc-view-all-link">
                    Xem toàn bộ nhật ký →
                  </Link>
                </div>

                <div className="utc-table-container">
                  <table className="utc-audit-table">
                    <thead>
                      <tr>
                        <th>Thời Gian</th>
                        <th>Người Thực Hiện</th>
                        <th>Hành Động</th>
                        <th>Mô Tả Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAudits.slice(0, 5).map((log, index) => (
                        <tr key={log.id || index}>
                          <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
                            {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '-'}
                          </td>
                          <td>
                            <strong>{log.user_name || 'Hệ thống'}</strong>{' '}
                            {log.user_role && <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>({log.user_role})</span>}
                          </td>
                          <td>
                            <span className="utc-badge-action">{log.action_type || 'system_event'}</span>
                          </td>
                          <td style={{ maxWidth: '400px', lineHeight: 1.4 }}>
                            {log.description || 'Không có mô tả chi tiết'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

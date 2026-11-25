import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { securityApi, SecurityPolicyItem, SecuritySessionItem } from '../../api/security';
import { AdminSecurityMetrics } from '../../types';

export const SecurityCenterPage: React.FC = () => {
  const [data, setData] = useState<(AdminSecurityMetrics & {
    policies?: SecurityPolicyItem[];
    active_sessions?: SecuritySessionItem[];
    rbac_matrix?: Array<{ role: string; label: string; scopes: string[] }>;
  }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'policies' | 'rbac'>('overview');
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, string>>({});
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await securityApi.getSecurityMetrics();
      setData(res);
      const drafts: Record<string, string> = {};
      (res.policies || []).forEach((p) => {
        drafts[p.policy_key] = p.policy_value;
      });
      setPolicyDrafts(drafts);
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err.response?.data?.detail || 'Không thể tải dữ liệu Trung tâm Bảo mật (Yêu cầu SuperAdmin).',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevokeSession = async (session: SecuritySessionItem, revokeAll = false) => {
    const label = revokeAll
      ? `Thu hồi TẤT CẢ phiên đang hoạt động của '${session.username}'?`
      : `Thu hồi phiên đăng nhập #${session.id} của '${session.username}' (${session.portal})?`;
    if (!confirm(label)) return;
    try {
      setRevokingId(session.id);
      setNotice(null);
      const res = await securityApi.revokeSession(session.id, 'Thu hồi từ Security Center', revokeAll);
      setNotice({ type: 'success', text: res?.message || 'Đã thu hồi phiên thành công!' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.detail || 'Lỗi thu hồi phiên.' });
    } finally {
      setRevokingId(null);
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPolicies(true);
      setNotice(null);
      const list = Object.entries(policyDrafts).map(([policy_key, policy_value]) => ({
        policy_key,
        policy_value,
      }));
      await securityApi.updatePolicies(list);
      setNotice({ type: 'success', text: 'Đã cập nhật chính sách bảo mật động và áp dụng ngay lập tức!' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.detail || 'Không thể lưu chính sách.' });
    } finally {
      setSavingPolicies(false);
    }
  };

  const metrics: Record<string, any> = (data?.metrics || {}) as Record<string, any>;
  const headers: Record<string, any> = (data?.security_headers || {}) as Record<string, any>;
  const sessions = data?.active_sessions || [];
  const policies = data?.policies || [];
  const audits = data?.recent_audits || [];
  const rbacMatrix = data?.rbac_matrix || [];

  const securityFlagRows = [
    { label: 'HttpOnly Refresh Cookies', value: headers.httponly_cookies, okText: 'Bật (Chống XSS đọc cookie)' },
    { label: 'HSTS (Strict-Transport-Security)', value: headers.hsts_production, okText: `Bật (${headers.hsts_seconds || 0}s)` },
    { label: 'Content-Security-Policy (CSP)', value: headers.content_security_policy, okText: 'Cấu hình Middleware/Header' },
    { label: 'X-Content-Type-Options (nosniff)', value: headers.nosniff_enabled, okText: 'Bật (Chặn MIME sniffing)' },
    { label: 'Rate Limiting / Brute-Force Throttle', value: headers.rate_limiting_active, okText: 'Bật DRF Throttle + Account Lockout' },
    { label: 'Bot Protection Middleware', value: headers.bot_protection_active, okText: 'Đang hoạt động' },
    { label: 'Chế độ Production (DEBUG=False)', value: headers.debug_mode === false, okText: 'Production Safe' },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.45rem' }}>🛡️ Trung Tâm Bảo Mật & Phiên Đăng Nhập</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Giám sát phiên JWT trực tiếp liên cổng, thu hồi phiên từ xa, cấu hình chính sách khóa tài khoản động và ma trận RBAC.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            🔄 {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>

        {notice && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            background: notice.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${notice.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
            color: notice.type === 'success' ? '#065f46' : '#991b1b',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}>
            {notice.type === 'success' ? '✅' : '⚠️'} {notice.text}
          </div>
        )}

        <div className="utc-subnav-tabs" style={{ marginBottom: '1.25rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'overview', label: '📊 Tổng Quan & Cờ Bảo Mật' },
            { id: 'sessions', label: `🔑 Phiên Đăng Nhập (${sessions.filter((s) => s.is_active).length} active)` },
            { id: 'policies', label: '⚙️ Chính Sách Khóa Động' },
            { id: 'rbac', label: '🪪 Ma Trận Phân Quyền RBAC' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: activeTab === tab.id ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                background: activeTab === tab.id ? '#1d4ed8' : '#ffffff',
                color: activeTab === tab.id ? '#ffffff' : '#334155',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Tổng tài khoản', val: metrics.total_users ?? 0, color: '#0f172a' },
                { label: 'Tài khoản hoạt động', val: metrics.active_users ?? 0, color: '#059669' },
                { label: 'Phiên đang hoạt động', val: metrics.active_sessions_count ?? 0, color: '#1d4ed8' },
                { label: 'Tài khoản bị khóa', val: metrics.deactivated_users ?? 0, color: '#dc2626' },
                { label: 'Sinh viên / GVHD', val: `${metrics.student_count ?? 0} / ${metrics.supervisor_count ?? 0}`, color: '#4338ca' },
              ].map((kpi) => (
                <div key={kpi.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{kpi.label}</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: kpi.color, marginTop: '4px' }}>{kpi.val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>Trạng thái cấu hình bảo mật thực tế (Django Runtime)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {securityFlagRows.map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{row.label}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      background: row.value ? '#dcfce7' : '#fef3c7',
                      color: row.value ? '#166534' : '#92400e',
                    }}>
                      {row.value ? `✓ ${row.okText}` : '⚠️ Tắt / Dev Mode'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                X-Frame-Options: <b>{headers.x_frame_options || 'DENY'}</b> • JWT Access Expiry: <b>{headers.jwt_access_expiry_minutes ?? 15} phút</b>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>Nhật ký kiểm toán gần đây</h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="utc-custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Tài khoản</th>
                      <th>Loại sự kiện</th>
                      <th>Mô tả chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>Chưa có bản ghi AuditLog.</td></tr>
                    ) : audits.map((log: any) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                        <td style={{ fontWeight: 600 }}>{log.user_name || 'System'}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '6px', background: log.action_type === 'SECURITY_ALERT' ? '#fee2e2' : '#f1f5f9', color: log.action_type === 'SECURITY_ALERT' ? '#b91c1c' : '#334155', fontSize: '0.75rem', fontWeight: 700 }}>{log.action_type}</span></td>
                        <td style={{ fontSize: '0.84rem' }}>{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>Phiên đăng nhập JWT được theo dõi trên toàn hệ thống</h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="utc-custom-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Vai trò / Cổng</th>
                    <th>IP Address</th>
                    <th>Hoạt động cuối</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Chưa có phiên đăng nhập nào được ghi nhận.</td></tr>
                  ) : sessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>@{s.username}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{s.user_type}</span>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>portal: {s.portal}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{s.ip_address || 'N/A'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString('vi-VN') : '—'}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: s.is_active ? '#dcfce7' : '#fee2e2',
                          color: s.is_active ? '#166534' : '#991b1b',
                        }}>
                          {s.is_active ? '🟢 Đang hoạt động' : '🔴 Đã thu hồi'}
                        </span>
                        {s.revoke_reason && !s.is_active && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{s.revoke_reason}</div>
                        )}
                      </td>
                      <td>
                        {s.is_active && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              disabled={revokingId === s.id}
                              onClick={() => handleRevokeSession(s, false)}
                              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              🚫 Thu hồi phiên
                            </button>
                            <button
                              type="button"
                              disabled={revokingId === s.id}
                              onClick={() => handleRevokeSession(s, true)}
                              style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Thu hồi tất cả
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'policies' && (
          <form onSubmit={handleSavePolicies} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', maxWidth: '820px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Cấu hình chính sách bảo mật động</h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Thay đổi tại đây được lưu trong CSDL dùng chung và áp dụng ngay cho luồng đăng nhập của Cổng Quản trị lẫn Cổng Sinh viên / Giảng viên.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {policies.map((p) => (
                <div key={p.policy_key} style={{ padding: '0.85rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 180px', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>{p.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{p.description}</div>
                    <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#94a3b8', marginTop: '2px' }}>{p.policy_key}</div>
                  </div>
                  <input
                    type="text"
                    value={policyDrafts[p.policy_key] ?? p.policy_value}
                    onChange={(e) => setPolicyDrafts((prev) => ({ ...prev, [p.policy_key]: e.target.value }))}
                    className="utc-input"
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingPolicies}
                style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                {savingPolicies ? 'Đang lưu...' : '💾 Lưu Chính Sách Bảo Mật'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'rbac' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.15rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>Ma trận Phân Quyền Hệ Thống (RBAC)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {rbacMatrix.map((item) => (
                <div key={item.role} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.95rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b', marginBottom: '0.5rem' }}>role={item.role}</div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.84rem', color: '#334155', lineHeight: 1.55 }}>
                    {item.scopes.map((sc) => <li key={sc}>{sc}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

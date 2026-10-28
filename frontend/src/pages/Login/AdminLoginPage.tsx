import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../../auth/AdminAuthContext';
import './AdminLoginPage.css';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithSso } = useAdminAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filledMsg, setFilledMsg] = useState<string | null>(null);

  // UTC SSO States
  const [showSsoModal, setShowSsoModal] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);

  const handleSsoSubmit = async (emailToUse?: string) => {
    const emailVal = emailToUse || ssoEmail;
    if (!emailVal.trim()) {
      setSsoError('Vui lòng nhập địa chỉ email cán bộ @utc.edu.vn');
      return;
    }
    setSsoLoading(true);
    setSsoError(null);
    try {
      await loginWithSso(undefined, emailVal.trim());
      setShowSsoModal(false);
      navigate('/dashboard');
    } catch (err: any) {
      setSsoError(err.response?.data?.detail || err.message || 'Xác thực UTC SSO thất bại.');
    } finally {
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Đăng nhập Admin thất bại. Vui lòng kiểm tra lại tài khoản.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (usernameToFill: string, autoSubmit = false, customPass = 'Admin@123456') => {
    setIdentifier(usernameToFill);
    setPassword(customPass);
    setError(null);
    setFilledMsg(`✓ Đã điền: ${usernameToFill} • Mật khẩu: ${customPass}`);
    setTimeout(() => setFilledMsg(null), 4000);

    if (autoSubmit) {
      setLoading(true);
      login(usernameToFill, customPass)
        .then(() => navigate(usernameToFill === 'giao_vu' ? '/academic-staff' : '/dashboard'))
        .catch((err: any) => {
          const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Đăng nhập thất bại.';
          setError(msg);
        })
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span style={{ fontSize: '3rem' }}>🎓</span>
          <h1>UTC ADMIN PORTAL</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Quản trị hệ thống Đồ án Tốt nghiệp & Giáo vụ Khoa CNTT</p>
        </div>

        {/* Quick Demo Fill Box */}
        <div className="admin-demo-box">
          <div className="admin-demo-title">
            <span>⚡ ĐIỀN MẪU TEST NHANH</span>
            <span className="admin-demo-hint">Click 1 chạm để tự điền</span>
          </div>
          <div className="admin-demo-buttons">
            <button
              type="button"
              className="admin-demo-chip primary"
              onClick={() => handleFillDemo('admin')}
              title="Điền username: admin | Mật khẩu: Admin@123456"
            >
              🔑 Điền: <strong>admin</strong>
            </button>
            <button
              type="button"
              className="admin-demo-chip"
              onClick={() => handleFillDemo('giao_vu', false, 'Giaovu@123456')}
              style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}
              title="Điền tài khoản Giáo vụ: giao_vu | Mật khẩu: Giaovu@123456"
            >
              💼 Điền: <strong>giao_vu</strong>
            </button>
            <button
              type="button"
              className="admin-demo-chip instant"
              onClick={() => handleFillDemo('giao_vu', true, 'Giaovu@123456')}
              style={{ background: '#16a34a' }}
              title="Tự điền và Đăng nhập ngay lập tức với quyền Giáo vụ"
            >
              🚀 <strong>Giáo vụ (1-Click)</strong>
            </button>
            <button
              type="button"
              className="admin-demo-chip instant"
              onClick={() => handleFillDemo('admin', true)}
              title="Tự điền và Đăng nhập ngay lập tức vào Admin Dashboard"
            >
              ⚡ <strong>Admin (1-Click)</strong>
            </button>
          </div>
          {filledMsg && <div className="admin-demo-success">{filledMsg}</div>}
        </div>

        {error && <div className="utc-error-alert" style={{ marginBottom: '1rem', color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 8 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Tài khoản hoặc Email Admin</label>
            <input
              type="text"
              required
              placeholder="admin hoặc admin@utc.edu.vn"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label>Mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button type="submit" className="admin-login-submit" disabled={loading}>
            {loading ? 'Đang xác thực...' : 'Đăng Nhập Quản Trị'}
          </button>

          <div style={{ margin: '1rem 0', textAlign: 'center', position: 'relative' }}>
            <span style={{ background: '#ffffff', padding: '0 10px', color: '#94a3b8', fontSize: '0.8rem', position: 'relative', zIndex: 1 }}>
              hoặc đăng nhập cán bộ
            </span>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#e2e8f0', zIndex: 0 }}></div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSsoModal(true);
              setSsoError(null);
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#1e293b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🎓</span> Đăng nhập với Email UTC (@utc.edu.vn)
          </button>
        </form>

        {/* UTC SSO Modal */}
        {showSsoModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              textAlign: 'left',
            }}>
              <button
                type="button"
                onClick={() => setShowSsoModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '2rem' }}>🎓</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>UTC SSO — Quản trị viên</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#0284c7' }}>Xác thực email cán bộ @utc.edu.vn</p>
                </div>
              </div>

              {ssoError && (
                <div style={{ padding: '10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', fontSize: '0.8rem', marginBottom: '16px' }}>
                  ⚠️ {ssoError}
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                  ⚡ Chọn nhanh tài khoản cán bộ mẫu:
                </span>
                <button
                  type="button"
                  disabled={ssoLoading}
                  onClick={() => handleSsoSubmit('admin@utc.edu.vn')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    marginBottom: '6px',
                  }}
                >
                  <span>🔑 <strong>admin@utc.edu.vn</strong> (Admin)</span>
                  <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>1-Click</span>
                </button>
                <button
                  type="button"
                  disabled={ssoLoading}
                  onClick={() => handleSsoSubmit('giaovu@utc.edu.vn')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                  }}
                >
                  <span>📋 <strong>giaovu@utc.edu.vn</strong> (Giáo vụ)</span>
                  <span style={{ color: '#0284c7', fontSize: '0.75rem', fontWeight: 600 }}>1-Click</span>
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Hoặc nhập Email cán bộ UTC:
                </label>
                <input
                  type="email"
                  value={ssoEmail}
                  onChange={(e) => setSsoEmail(e.target.value)}
                  placeholder="admin@utc.edu.vn"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowSsoModal(false)}
                  style={{
                    width: '35%',
                    padding: '9px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={ssoLoading}
                  onClick={() => handleSsoSubmit()}
                  style={{
                    width: '65%',
                    padding: '9px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {ssoLoading ? 'Đang xác thực...' : '🚀 Xác thực & Đăng nhập'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Chưa có tài khoản Quản trị?{' '}
            <Link to="/register" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
              Đăng ký Admin
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

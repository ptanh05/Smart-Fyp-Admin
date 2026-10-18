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
  const { login } = useAdminAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filledMsg, setFilledMsg] = useState<string | null>(null);

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
        </form>

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

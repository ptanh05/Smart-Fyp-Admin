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

export const AdminRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    if (!adminSecret.trim()) {
      setError('Vui lòng nhập Mã bí mật Quản trị (Admin Secret Key).');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password, adminSecret);
      setSuccess('Đăng ký tài khoản Admin thành công! Đang chuyển hướng về trang đăng nhập...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.username?.[0] || err.response?.data?.email?.[0] || err.message || 'Đăng ký Admin thất bại. Vui lòng kiểm tra lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span style={{ fontSize: '3rem' }}>🛡️</span>
          <h1>ĐĂNG KÝ ADMIN</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Hệ thống Quản trị Đồ án UTC</p>
        </div>

        {error && <div className="utc-error-alert" style={{ marginBottom: '1rem', color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 8 }}>{error}</div>}
        {success && <div className="utc-success-alert" style={{ marginBottom: '1rem', color: '#15803d', background: '#dcfce7', padding: '0.75rem', borderRadius: 8 }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Tên đăng nhập (Username)</label>
            <input
              type="text"
              required
              placeholder="admin_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label>Email Admin</label>
            <input
              type="email"
              required
              placeholder="admin@utc.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label>Mật khẩu (Tối thiểu 8 ký tự)</label>
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

          <div className="admin-form-group">
            <label>Xác nhận mật khẩu</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="admin-form-group">
            <label>Mã bí mật Quản trị (Admin Secret Key)</label>
            <div className="password-input-wrapper">
              <input
                type={showAdminSecret ? 'text' : 'password'}
                required
                placeholder="Nhập khóa bảo mật Backend Admin"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowAdminSecret(!showAdminSecret)}
                title={showAdminSecret ? 'Ẩn mã bí mật' : 'Xem mã bí mật'}
                aria-label="Toggle admin secret visibility"
              >
                {showAdminSecret ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <small style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
              * Yêu cầu khóa bảo mật được cấp bởi Quản trị viên hệ thống UTC
            </small>
          </div>

          <button type="submit" className="admin-login-submit" disabled={loading}>
            {loading ? 'Đang xác thực...' : 'Tạo Tài Khoản Admin'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Đã có tài khoản Admin?{' '}
            <Link to="/login" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

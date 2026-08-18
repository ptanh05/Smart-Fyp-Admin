import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../../auth/AdminAuthContext';
import './AdminLoginPage.css';

export const AdminRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
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
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label>Xác nhận mật khẩu</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label>Mã bí mật Quản trị (Admin Secret Key)</label>
            <input
              type="password"
              required
              placeholder="Nhập khóa bảo mật Backend Admin"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
            />
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

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../../auth/AdminAuthContext';
import './AdminLoginPage.css';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập Admin thất bại. Vui lòng kiểm tra lại tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span style={{ fontSize: '3rem' }}>🎓</span>
          <h1>UTC ADMIN PORTAL</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Quản trị hệ thống Đồ án Tốt nghiệp</p>
        </div>

        {error && <div className="utc-error-alert" style={{ marginBottom: '1rem', color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 8 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
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
            <label>Mật khẩu</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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


import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../auth/AdminAuthContext';
import './AdminLayout.css';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="admin-seal">🎓</span>
          <div>
            <div className="admin-title-main">SMART FYP UTC</div>
            <div className="admin-title-sub">ADMIN PORTAL</div>
          </div>
        </div>

        <nav className="admin-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>📊</span> Tổng Quan Dashboard
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>👥</span> Quản Lý Tài Khoản
          </NavLink>
          <NavLink to="/batches" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>📅</span> Kỳ Học & Lớp HP
          </NavLink>
          <NavLink to="/allocations" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>🤝</span> Phân Công GVHD
          </NavLink>
          <NavLink to="/councils" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>⚖️</span> Hội Đồng & Phản Biện
          </NavLink>
          <NavLink to="/defense" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>📝</span> Điểm & Biên Bản
          </NavLink>
          <NavLink to="/security" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>🛡️</span> Trung Tâm Bảo Mật
          </NavLink>
          <NavLink to="/audit-logs" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>📜</span> Nhật Ký Hệ Thống
          </NavLink>
        </nav>
      </aside>

      <main className="admin-main-content">
        <header className="admin-header">
          <div className="admin-header-title">Hệ Thống Quản Trị Dữ Liệu Đồ Án Tốt Nghiệp UTC</div>
          <div className="admin-header-user">
            <span>🛡️ Administrator</span>
            <button className="admin-logout-btn" onClick={handleLogout}>Đăng Xuất</button>
          </div>
        </header>

        <div className="admin-page-container">
          {children}
        </div>
      </main>
    </div>
  );
};

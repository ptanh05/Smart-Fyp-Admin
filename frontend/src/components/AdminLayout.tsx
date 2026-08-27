import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../auth/AdminAuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const { userType, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Tổng quan (Dashboard)', path: '/dashboard', icon: '📊' },
    { label: 'Đợt ĐATN & Import Excel', path: '/batches', icon: '📁' },
    { label: 'Phân GVHD (MCMF Matching)', path: '/allocations', icon: '🎯' },
    { label: 'Hội đồng & Phản biện', path: '/councils', icon: '⚖️' },
    { label: 'Bảo vệ & Bảng điểm (Xuất Word/Excel)', path: '/defense', icon: '📜' },
    { label: 'Quản lý Người dùng', path: '/users', icon: '👥' },
    { label: 'Bảo mật & Giám sát', path: '/security', icon: '🛡️' },
    { label: 'Nhật ký Hệ thống (Audit)', path: '/audit-logs', icon: '📝' },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg text-white">
            UTC
          </div>
          <div>
            <h1 className="font-bold text-sm text-blue-400">SMART-FYP ADMIN</h1>
            <p className="text-xs text-slate-400">Khoa CNTT - ĐH GTVT</p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="truncate">
            <p className="text-xs text-slate-400">Đang đăng nhập:</p>
            <p className="text-sm font-medium text-slate-200 truncate">{userType ? 'Administrator' : 'Admin'}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Đăng xuất"
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between px-6 backdrop-blur">
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Neon PostgreSQL Sync (Active)
            </span>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900/90">
          {children}
        </main>
      </div>
    </div>
  );
};

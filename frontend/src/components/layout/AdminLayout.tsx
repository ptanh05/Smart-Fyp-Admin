import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../auth/AdminAuthContext';
import './AdminLayout.css';

/**
 * Menu theo vai trò:
 *  - admin        : toàn bộ nghiệp vụ quản trị (kể cả bảo mật / nhật ký / tài khoản)
 *  - academic_staff (Giáo vụ Khoa): chỉ các nghiệp vụ thuộc Khoa
 */
interface NavItem {
  to: string;
  icon: string;
  label: string;
  roles: Array<'admin' | 'academic_staff'>;
  highlight?: boolean;
  group: 'overview' | 'people' | 'batches' | 'workflow' | 'system';
}

const NAV_GROUPS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'people', label: 'Tài khoản & Nhân sự' },
  { key: 'batches', label: 'Thiết lập Đợt ĐATN' },
  { key: 'workflow', label: 'Quy trình Nghiệp vụ' },
  { key: 'system', label: 'Hệ thống & Bảo mật' },
] as const;

const COLLAPSED_GROUPS_STORAGE_KEY = 'smart_fyp_admin_collapsed_nav_groups';

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    icon: '📊',
    label: 'Tổng Quan Dashboard',
    roles: ['admin', 'academic_staff'],
    group: 'overview',
  },
  {
    to: '/academic-staff',
    icon: '💼',
    label: 'Phân Hệ Giáo Vụ (Mới)',
    roles: ['academic_staff'],
    highlight: true,
    group: 'overview',
  },
  {
    to: '/users',
    icon: '👥',
    label: 'Quản Lý Tài Khoản',
    roles: ['admin'],
    group: 'people',
  },
  {
    to: '/supervisors',
    icon: '👨‍🏫',
    label: 'Quản Lý Giảng Viên',
    roles: ['admin'],
    group: 'people',
  },
  {
    to: '/batches',
    icon: '📅',
    label: 'GĐ1: Đợt & Bộ Môn',
    roles: ['admin', 'academic_staff'],
    group: 'batches',
  },
  {
    to: '/archived-batches',
    icon: '🗄️',
    label: 'Lưu Trữ Đợt ĐATN',
    roles: ['admin', 'academic_staff'],
    group: 'batches',
  },
  {
    to: '/allocations',
    icon: '🤝',
    label: 'GĐ2: Phân Công GVHD',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/topics',
    icon: '📑',
    label: 'GĐ3: Duyệt Đề Tài',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/eligibility',
    icon: '⚖️',
    label: 'GĐ4: Xét ĐK & Force Approve',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/progress',
    icon: '📈',
    label: 'GĐ5: Giám Sát Tiến Độ',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/outlines',
    icon: '📋',
    label: 'Duyệt Đề Cương',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/councils',
    icon: '🏛️',
    label: 'GĐ6: Hội Đồng & Lịch BV',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/defense',
    icon: '📝',
    label: 'Điểm, Bảo Lưu & Chốt',
    roles: ['admin', 'academic_staff'],
    group: 'workflow',
  },
  {
    to: '/security',
    icon: '🛡️',
    label: 'Trung Tâm Bảo Mật',
    roles: ['admin'],
    group: 'system',
  },
  {
    to: '/audit-logs',
    icon: '📜',
    label: 'Nhật Ký Hệ Thống',
    roles: ['admin'],
    group: 'system',
  },
];

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout, userType, currentUser } = useAdminAuth();
  const navigate = useNavigate();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
      const values = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(values) ? values : []);
    } catch {
      return new Set();
    }
  });

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = currentUser?.full_name || currentUser?.username || 'Administrator';
  const displayUsername = currentUser?.username ? `@${currentUser.username}` : '';

  const effectiveRole: 'admin' | 'academic_staff' =
    userType === 'academic_staff' ? 'academic_staff' : 'admin';
  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(effectiveRole));

  return (
    <div className="admin-layout-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="admin-seal">🎓</span>
          <div>
            <div className="admin-title-main">SMART FYP UTC</div>
            <div className="admin-title-sub">
              {effectiveRole === 'academic_staff' ? 'GIAO VỤ KHOA PORTAL' : 'ADMIN PORTAL'}
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          {NAV_GROUPS.map((group) => {
            const items = visibleNavItems.filter((item) => item.group === group.key);
            if (items.length === 0) return null;
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <section className={`admin-nav-group ${isCollapsed ? 'collapsed' : ''}`} key={group.key}>
                <button
                  type="button"
                  className="admin-nav-group-title"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                >
                  <span>{group.label}</span>
                  <span className="admin-nav-group-chevron">{isCollapsed ? '▸' : '▾'}</span>
                </button>
                {!isCollapsed && <div className="admin-nav-group-items">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="admin-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>}
              </section>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main-content">
        <header className="admin-header">
          <div className="admin-header-title">Hệ Thống Quản Trị Dữ Liệu Đồ Án Tốt Nghiệp UTC</div>
          <div className="admin-header-user">
            <span
              className="admin-user-badge"
              title={currentUser?.email ? `Email: ${currentUser.email}` : undefined}
            >
              {effectiveRole === 'academic_staff'
                ? '💼 Giáo vụ Khoa CNTT'
                : `🛡️ ${displayName}`}{' '}
              {displayUsername && (
                <span style={{ opacity: 0.85, fontSize: '0.9em', marginLeft: 4 }}>({displayUsername})</span>
              )}
            </span>
            <button className="admin-logout-btn" onClick={handleLogout}>
              Đăng Xuất
            </button>
          </div>
        </header>

        <div className="admin-page-container">
          {children}
        </div>
      </main>
    </div>
  );
};

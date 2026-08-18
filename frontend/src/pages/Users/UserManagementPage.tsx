import React, { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../../api/users';
import type { AdminUser, UserType } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import '../../components/common/Modal.css';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');

  // Status/Role confirmation modal state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<'activate' | 'deactivate' | 'role'>('deactivate');
  const [newRole, setNewRole] = useState<UserType>('student');

  // Create User modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createUserType, setCreateUserType] = useState<UserType>('student');
  const [createIsActive, setCreateIsActive] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getUsers({ q, role, is_active: isActive });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [q, role, isActive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = (u: AdminUser) => {
    setSelectedUser(u);
    setActionType(u.is_active ? 'deactivate' : 'activate');
    setShowConfirm(true);
  };

  const handleRoleChange = (u: AdminUser, targetRole: UserType) => {
    setSelectedUser(u);
    setNewRole(targetRole);
    setActionType('role');
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    if (!selectedUser) return;
    try {
      if (actionType === 'activate' || actionType === 'deactivate') {
        await usersApi.updateUser(selectedUser.id, { is_active: actionType === 'activate' });
      } else if (actionType === 'role') {
        await usersApi.updateUser(selectedUser.id, { user_type: newRole });
      }
      setShowConfirm(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (createPassword.length < 8) {
      setCreateError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    setCreateLoading(true);
    try {
      await usersApi.createUser({
        username: createUsername.trim(),
        email: createEmail.trim(),
        password: createPassword,
        user_type: createUserType,
        is_active: createIsActive,
      });

      setShowCreateModal(false);
      setCreateUsername('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateUserType('student');
      setCreateIsActive(true);
      fetchUsers();
    } catch (err: any) {
      const msg =
        err.response?.data?.username?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Tạo người dùng thất bại. Vui lòng kiểm tra lại thông tin.';
      setCreateError(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>👥 Quản Lý Người Dùng ({total})</h2>
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            style={{
              padding: '0.6rem 1.25rem',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 4px rgba(2,132,199,0.2)'
            }}
          >
            <span>➕</span> Tạo Người Dùng Mới
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Tìm kiếm username hoặc email..."
            style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #cbd5e1', width: 280 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <option value="">-- Tất cả vai trò --</option>
            <option value="student">Sinh viên</option>
            <option value="supervisor">GV hướng dẫn</option>
            <option value="committee_member">Hội đồng</option>
            <option value="external_examiner">Cán bộ ngoài</option>
            <option value="admin">Admin</option>
          </select>

          <select value={isActive} onChange={(e) => setIsActive(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <option value="">-- Tất cả trạng thái --</option>
            <option value="true">Hoạt động</option>
            <option value="false">Vô hiệu hóa</option>
          </select>

          <button onClick={fetchUsers} style={{ padding: '0.5rem 1.2rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            Lọc Data
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={5} columns={6} />
        ) : (
          <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', marginTop: '1rem', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 12 }}>ID</th>
                <th style={{ padding: 12 }}>Username</th>
                <th style={{ padding: 12 }}>Email</th>
                <th style={{ padding: 12 }}>Vai Trò</th>
                <th style={{ padding: 12 }}>Trạng Thái</th>
                <th style={{ padding: 12 }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    Không tìm thấy người dùng nào phù hợp.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12 }}>#{u.id}</td>
                    <td style={{ padding: 12, fontWeight: 600 }}>{u.username}</td>
                    <td style={{ padding: 12 }}>{u.email}</td>
                    <td style={{ padding: 12 }}>
                      <select
                        value={u.user_type}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserType)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="student">Sinh viên</option>
                        <option value="supervisor">GV hướng dẫn</option>
                        <option value="committee_member">Hội đồng</option>
                        <option value="external_examiner">Cán bộ ngoài</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: u.is_active ? '#dcfce7' : '#fee2e2', color: u.is_active ? '#15803d' : '#b91c1c' }}>
                        {u.is_active ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: u.is_active ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        {u.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Confirmation Modal */}
        {showConfirm && selectedUser && (
          <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Xác Nhận Thao Tác Quản Trị</h2>
                <button className="close-button" onClick={() => setShowConfirm(false)}>✕</button>
              </div>
              <div className="modal-content">
                <p>Bạn có chắc chắn muốn {actionType === 'activate' ? 'kích hoạt' : actionType === 'deactivate' ? 'vô hiệu hóa' : `đổi vai trò thành ${newRole}`} cho tài khoản <strong>{selectedUser.username}</strong>?</p>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowConfirm(false)}>Hủy</button>
                <button onClick={confirmAction} style={{ background: '#0284c7', color: '#fff', padding: '6px 14px', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Xác Nhận</button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-container" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Tạo Tài Khoản Người Dùng Mới</h2>
                <button className="close-button" onClick={() => setShowCreateModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateUser}>
                <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {createError && (
                    <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 6, fontSize: '0.9rem' }}>
                      {createError}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Tên đăng nhập (Username)</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: student_2026"
                      value={createUsername}
                      onChange={(e) => setCreateUsername(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Email</label>
                    <input
                      type="email"
                      required
                      placeholder="vd: user@utc.edu.vn"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Mật khẩu (Tối thiểu 8 ký tự)</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Vai trò người dùng</label>
                    <select
                      value={createUserType}
                      onChange={(e) => setCreateUserType(e.target.value as UserType)}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                      <option value="student">Sinh viên (Student)</option>
                      <option value="supervisor">Giảng viên hướng dẫn (Supervisor)</option>
                      <option value="committee_member">Ủy viên hội đồng (Committee Member)</option>
                      <option value="external_examiner">Cán bộ chấm ngoài (External Examiner)</option>
                      <option value="admin">Quản trị viên (Admin)</option>
                    </select>
                    <small style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
                      * Người dùng sẽ đăng nhập vào hệ thống tương ứng (Cổng Sinh viên / Cổng Giảng viên)
                    </small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input
                      type="checkbox"
                      id="createIsActive"
                      checked={createIsActive}
                      onChange={(e) => setCreateIsActive(e.target.checked)}
                    />
                    <label htmlFor="createIsActive" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                      Kích hoạt tài khoản ngay khi tạo
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={() => setShowCreateModal(false)}>
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      padding: '6px 14px',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {createLoading ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};


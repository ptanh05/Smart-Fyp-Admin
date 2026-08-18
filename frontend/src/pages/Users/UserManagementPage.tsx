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

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<'activate' | 'deactivate' | 'role'>('deactivate');
  const [newRole, setNewRole] = useState<UserType>('student');

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

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>👥 Quan Ly Nguoi Dung ({total})</h2>

        <div style={{ display: 'flex', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Tim kiem theo username hoac email..."
            style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #cbd5e1', width: 280 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6 }}>
            <option value="">-- Tat ca vai tro --</option>
            <option value="student">Sinh vien</option>
            <option value="supervisor">GV huong dan</option>
            <option value="committee_member">Hoi dong</option>
            <option value="external_examiner">Can bo ngoai</option>
            <option value="admin">Admin</option>
          </select>

          <select value={isActive} onChange={(e) => setIsActive(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6 }}>
            <option value="">-- Tat ca trang thai --</option>
            <option value="true">Hoat dong</option>
            <option value="false">Vo hieu hoa</option>
          </select>

          <button onClick={fetchUsers} style={{ padding: '0.5rem 1.2rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            Loc Data
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={5} columns={6} />
        ) : (
          <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', marginTop: '1rem', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 12 }}>ID</th>
                <th style={{ padding: 12 }}>Username</th>
                <th style={{ padding: 12 }}>Email</th>
                <th style={{ padding: 12 }}>Vai Tro</th>
                <th style={{ padding: 12 }}>Trang Thai</th>
                <th style={{ padding: 12 }}>Thao Tac</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 12 }}>#{u.id}</td>
                  <td style={{ padding: 12, fontWeight: 600 }}>{u.username}</td>
                  <td style={{ padding: 12 }}>{u.email}</td>
                  <td style={{ padding: 12 }}>
                    <select value={u.user_type} onChange={(e) => handleRoleChange(u, e.target.value as UserType)}>
                      <option value="student">Sinh vien</option>
                      <option value="supervisor">GV huong dan</option>
                      <option value="committee_member">Hoi dong</option>
                      <option value="external_examiner">Can bo ngoai</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: 12 }}>
                    <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: u.is_active ? '#dcfce7' : '#fee2e2', color: u.is_active ? '#15803d' : '#b91c1c' }}>
                      {u.is_active ? 'Hoat dong' : 'Vo hieu'}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: u.is_active ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {u.is_active ? 'Vo hieu hóa' : 'Kich hoat'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showConfirm && selectedUser && (
          <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Xac Nhan Thao Tac Admin</h2>
                <button className="close-button" onClick={() => setShowConfirm(false)}>✕</button>
              </div>
              <div className="modal-content">
                <p>Ban co thuc su muon {actionType} tai khoan <strong>{selectedUser.username}</strong>?</p>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowConfirm(false)}>Huy</button>
                <button onClick={confirmAction} style={{ background: '#0284c7', color: '#fff', padding: '6px 12px', border: 'none', borderRadius: 6 }}>Xac Nhan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

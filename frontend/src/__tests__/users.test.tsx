import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { UserManagementPage } from '../pages/Users/UserManagementPage';

import { usersApi } from '../api/users';
import type { AdminUser } from '../types';

vi.mock('../api/users', () => ({
  usersApi: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock('../auth/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAuthenticated: true,
    userType: 'admin',
    logout: vi.fn(),
  }),
}));

const mockUsers: AdminUser[] = [
  {
    id: 1,
    username: 'admin_root',
    email: 'admin@utc.edu.vn',
    user_type: 'admin',
    is_active: true,
    is_staff: true,
    last_login: '2026-08-18T10:00:00Z',
  },
  {
    id: 2,
    username: 'student_john',
    email: 'john@utc.edu.vn',
    user_type: 'student',
    is_active: true,
    is_staff: false,
    last_login: null,
  },
  {
    id: 3,
    username: 'supervisor_dr_lee',
    email: 'lee@utc.edu.vn',
    user_type: 'supervisor',
    is_active: false,
    is_staff: false,
    last_login: null,
  },
];

describe('User Management Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usersApi.getUsers as any).mockResolvedValue({
      users: mockUsers,
      total: mockUsers.length,
    });
  });

  it('renders user list and action buttons properly', async () => {
    render(
      <BrowserRouter>
        <UserManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Quản Lý Người Dùng/i })).toBeInTheDocument();
      expect(screen.getByText(/admin_root/i)).toBeInTheDocument();
      expect(screen.getByText(/student_john/i)).toBeInTheDocument();
      expect(screen.getByText(/supervisor_dr_lee/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tạo Người Dùng Mới/i })).toBeInTheDocument();
    });
  });

  it('opens create user modal and submits successfully', async () => {
    (usersApi.createUser as any).mockResolvedValueOnce({
      message: "User 'new_student' created successfully.",
      user: {
        id: 4,
        username: 'new_student',
        email: 'new_student@utc.edu.vn',
        user_type: 'student',
        is_active: true,
      }
    });

    render(
      <BrowserRouter>
        <UserManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/admin_root/i)).toBeInTheDocument();
    });

    // Click Open Modal
    fireEvent.click(screen.getByRole('button', { name: /Tạo Người Dùng Mới/i }));

    expect(screen.getByText(/Tạo Tài Khoản Người Dùng Mới/i)).toBeInTheDocument();

    // Fill Form
    fireEvent.change(screen.getByPlaceholderText(/vd: student_2026/i), { target: { value: 'new_student' } });
    fireEvent.change(screen.getByPlaceholderText(/vd: user@utc.edu.vn/i), { target: { value: 'new_student@utc.edu.vn' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'SecurePass123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Tạo Tài Khoản/i }));

    await waitFor(() => {
      expect(usersApi.createUser).toHaveBeenCalledWith({
        username: 'new_student',
        email: 'new_student@utc.edu.vn',
        password: 'SecurePass123',
        user_type: 'student',
        is_active: true,
      });
      expect(usersApi.getUsers).toHaveBeenCalledTimes(2); // Initial fetch + refresh
    });
  });

  it('handles user deactivation confirmation', async () => {
    (usersApi.updateUser as any).mockResolvedValueOnce({
      message: 'User updated successfully.',
      user: { ...mockUsers[1], is_active: false }
    });

    render(
      <BrowserRouter>
        <UserManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/student_john/i)).toBeInTheDocument();
    });

    // Click deactivate button for active user
    const deactivateButtons = screen.getAllByRole('button', { name: /Vô hiệu hóa/i });
    fireEvent.click(deactivateButtons[0]);

    // Modal appears
    expect(screen.getByText(/Xác Nhận Thao Tác Quản Trị/i)).toBeInTheDocument();

    // Click Confirm
    fireEvent.click(screen.getByRole('button', { name: /Xác Nhận/i }));

    await waitFor(() => {
      expect(usersApi.updateUser).toHaveBeenCalledWith(mockUsers[0].id, { is_active: false });
    });
  });
});

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

vi.mock('../api/batches', () => ({
  batchesApi: {
    getBatches: vi.fn().mockResolvedValue([]),
    getCourseClasses: vi.fn().mockResolvedValue([]),
  },
}));

const mockUsers: AdminUser[] = [
  {
    id: 1,
    username: 'admin_root',
    full_name: 'Admin Root User',
    email: 'admin@utc.edu.vn',
    user_type: 'admin',
    is_active: true,
    is_staff: true,
    last_login: '2026-08-18T10:00:00Z',
  },
  {
    id: 2,
    username: 'student_john',
    full_name: 'John Student Doe',
    email: 'john@utc.edu.vn',
    user_type: 'student',
    is_active: true,
    is_staff: false,
    last_login: null,
    student_profile: {
      id: 2,
      registration_no: 'student_john',
      department: 'CNTT 1',
      class_code: 'CNTT1',
      class_name: 'CNTT 1 K61',
      program_type: 'DAI_TRA',
      batch_name: 'K61',
      supervisor_name: 'TS. Nguyễn Văn A',
      topic_title: 'Hệ thống Quản trị ĐATN',
      major: 'CNTT',
      semester: '2025-2026',
      batch_no: 'K61',
      phone_number: '0987654321',
      course_class: 1,
      academic_batch: 1,
      supervisor_id: 1,
    },
  },
  {
    id: 3,
    username: 'supervisor_dr_lee',
    full_name: 'TS. Lee Supervisor',
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
      counts: {
        total: 3,
        students: 1,
        supervisors: 1,
        committee: 0,
        external: 0,
        admins: 1,
        cntt_students: 1,
        khmt_students: 0,
      },
    });
  });

  it('renders user list and action buttons properly', async () => {
    render(
      <BrowserRouter>
        <UserManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Quản Trị Định Danh & Cấp Phát Tài Khoản UTC/i })).toBeInTheDocument();
      expect(screen.getByText(/student_john/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tạo Tài Khoản Mới/i })).toBeInTheDocument();
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
      },
    });

    render(
      <BrowserRouter>
        <UserManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/student_john/i)).toBeInTheDocument();
    });

    // Click Open Modal
    fireEvent.click(screen.getByRole('button', { name: /Tạo Tài Khoản Mới/i }));

    expect(screen.getByText(/Tạo Tài Khoản Người Dùng Mới/i)).toBeInTheDocument();

    // Fill Form
    fireEvent.change(screen.getByPlaceholderText(/vd: 201200123/i), { target: { value: 'new_student' } });
    fireEvent.change(screen.getByPlaceholderText(/vd: An/i), { target: { value: 'Student' } });
    fireEvent.change(screen.getByPlaceholderText(/vd: student@lms.utc.edu.vn/i), { target: { value: 'new_student@utc.edu.vn' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Tạo Tài Khoản Ngay/i }));

    await waitFor(() => {
      expect(usersApi.createUser).toHaveBeenCalled();
      expect(usersApi.getUsers).toHaveBeenCalledTimes(2); // Initial fetch + refresh
    });
  });

  it('handles user deactivation confirmation', async () => {
    (usersApi.updateUser as any).mockResolvedValueOnce({
      message: 'User updated successfully.',
      user: { ...mockUsers[0], is_active: false },
    });

    render(
      <BrowserRouter>
        <UserManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/student_john/i)).toBeInTheDocument();
    });

    // Click lock/deactivate button for active user
    const lockButtons = screen.getAllByTitle(/Khóa tài khoản/i);
    fireEvent.click(lockButtons[0]);

    // Modal appears
    expect(screen.getByText(/Xác Nhận Thao Tác/i)).toBeInTheDocument();

    // Click Confirm
    fireEvent.click(screen.getByRole('button', { name: /Xác Nhận/i }));

    await waitFor(() => {
      expect(usersApi.updateUser).toHaveBeenCalledWith(mockUsers[0].id, { is_active: false });
    });
  });
});

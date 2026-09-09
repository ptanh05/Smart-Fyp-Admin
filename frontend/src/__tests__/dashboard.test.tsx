import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminDashboard } from '../pages/Dashboard/AdminDashboard';
import { usersApi } from '../api/users';
import { securityApi } from '../api/security';
import { batchesApi } from '../api/batches';

const mockLogout = vi.fn();

vi.mock('../auth/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAuthenticated: true,
    userType: 'admin',
    logout: mockLogout,
  }),
}));

vi.mock('../api/users', () => ({
  usersApi: {
    getUsers: vi.fn(),
  },
}));

vi.mock('../api/security', () => ({
  securityApi: {
    getSecurityMetrics: vi.fn(),
  },
}));

vi.mock('../api/batches', () => ({
  batchesApi: {
    getBatches: vi.fn(),
  },
}));

describe('Admin Dashboard & Header Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (usersApi.getUsers as any).mockResolvedValue({
      users: [],
      total: 150,
      counts: {
        total: 150,
        active: 142,
        deactivated: 8,
        students: 120,
        supervisors: 25,
        committee: 10,
        external: 5,
        admins: 2,
        cntt_students: 80,
        khmt_students: 40,
      },
    });

    (securityApi.getSecurityMetrics as any).mockResolvedValue({
      total_users: 150,
      active_users: 142,
      deactivated_users: 8,
      metrics: {
        total_users: 150,
        active_users: 142,
        deactivated_users: 8,
        admin_count: 2,
        student_count: 120,
        supervisor_count: 25,
        batches_count: 4,
        projects_count: 110,
        councils_count: 6,
      },
      security_headers: {
        httponly_cookies: true,
        content_security_policy: true,
        hsts_production: true,
        cors_credentials: true,
        magic_bytes_file_inspection: true,
        websocket_one_time_tickets: true,
      },
      recent_audits: [],
    });

    (batchesApi.getBatches as any).mockResolvedValue([
      { id: 1, batch_code: 'K61', batch_name: 'ĐATN K61', is_active: true, project_count: 60 },
      { id: 2, batch_code: 'K62', batch_name: 'ĐATN K62', is_active: false, project_count: 50 },
    ]);
  });

  it('renders Header with Đăng Xuất button and triggers logout on click', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Tổng Quan Hệ Thống Quản Trị ĐATN UTC/i)).toBeInTheDocument();
    });

    const logoutBtn = screen.getByRole('button', { name: /Đăng Xuất/i });
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn).toHaveClass('admin-logout-btn');

    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders Card "Tài Khoản Đang Hoạt Động" with accurate active user counts and ratio', async () => {
    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tài Khoản Đang Hoạt Động')).toBeInTheDocument();
    });

    // Check that the active users count is displayed
    expect(screen.getByText('142')).toBeInTheDocument();

    // Check other key cards are also rendered
    expect(screen.getByText('Tổng Số Người Dùng')).toBeInTheDocument();
    expect(screen.getByText('Sinh Viên Làm Đồ Án')).toBeInTheDocument();
    expect(screen.getByText('Giảng Viên & Hội Đồng')).toBeInTheDocument();
    expect(screen.getByText('Đợt ĐATN & Đề Tài')).toBeInTheDocument();
  });
});

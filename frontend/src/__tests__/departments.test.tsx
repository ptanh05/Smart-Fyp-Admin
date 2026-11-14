import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BatchesPage } from '../pages/Batches/BatchesPage';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../auth/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAuthenticated: true,
    userType: 'admin',
    logout: vi.fn(),
  }),
}));

const mockDepartments = [
  {
    id: 1,
    code: 'CNPM',
    name: 'Bo mon Cong nghe phan mem',
    description: 'Chuyên ngành kỹ thuật phần mềm',
    supervisor_count: 2,
    supervisors: [
      {
        id: 101,
        supervisor_id: 'UTC001',
        academic_title: 'TS',
        user_full_name: 'Trần Thị Ngân',
        username: 'gv_tran_thi_ngan',
        email: 'ngan.tt@utc.edu.vn',
        phone_number: '0912345678',
        academic_rank_multiplier: 1.2,
        research_interest: 'Trí tuệ nhân tạo, Công nghệ tri thức',
      },
      {
        id: 102,
        supervisor_id: 'UTC002',
        academic_title: 'PGS.TS',
        user_full_name: 'Nguyễn Văn Long',
        username: 'gv_nguyen_van_long',
        email: 'long.nv@utc.edu.vn',
        phone_number: '0987654321',
        academic_rank_multiplier: 1.5,
        research_interest: 'Kiến trúc phần mềm phân tán',
      },
    ],
  },
  {
    id: 2,
    code: 'HTTT',
    name: 'Bo mon He thong thong tin',
    description: 'Chuyên ngành hệ thống thông tin',
    supervisor_count: 0,
    supervisors: [],
  },
];

describe('BatchesPage - Danh Mục Bộ Môn Khoa CNTT & Xem Giảng Viên', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/admin/departments/')) {
        return Promise.resolve({ data: mockDepartments });
      }
      if (url.includes('/admin/batches/')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/users/?user_type=supervisor')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              username: 'gv_tran_thi_ngan',
              full_name: 'Trần Thị Ngân',
              email: 'ngan.tt@utc.edu.vn',
              supervisor_profile: mockDepartments[0].supervisors[0],
            },
            {
              id: 2,
              username: 'gv_nguyen_van_long',
              full_name: 'Nguyễn Văn Long',
              email: 'long.nv@utc.edu.vn',
              supervisor_profile: mockDepartments[0].supervisors[1],
            },
          ],
        });
      }
      if (url.includes('/admin/topic-areas/')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders Department tab with KPI overview and department cards', async () => {
    render(
      <BrowserRouter>
        <BatchesPage />
      </BrowserRouter>
    );

    // Switch to Departments Tab
    const deptTab = screen.getByText(/Danh Mục Bộ Môn Khoa CNTT/i);
    fireEvent.click(deptTab);

    // Verify Title & KPIs
    await waitFor(() => {
      expect(screen.getByText(/Thiết Lập Quan Hệ Khoa – Bộ Môn – Giảng Viên/i)).toBeInTheDocument();
      expect(screen.getByText(/Tổng Số Bộ Môn/i)).toBeInTheDocument();
      expect(screen.getByText('CNPM')).toBeInTheDocument();
      expect(screen.getByText('HTTT')).toBeInTheDocument();
      expect(screen.getByText(/Bộ môn Công nghệ Phần mềm/i)).toBeInTheDocument();
      expect(screen.getByText(/Bộ môn Hệ thống Thông tin/i)).toBeInTheDocument();
    });
  });

  it('opens supervisor modal when clicking "Xem Danh Sách Giảng Viên"', async () => {
    render(
      <BrowserRouter>
        <BatchesPage />
      </BrowserRouter>
    );

    const deptTab = screen.getByText(/Danh Mục Bộ Môn Khoa CNTT/i);
    fireEvent.click(deptTab);

    await waitFor(() => {
      expect(screen.getByText('CNPM')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText(/Xem Danh Sách Giảng Viên/i);
    expect(viewButtons.length).toBeGreaterThan(0);
    fireEvent.click(viewButtons[0]);

    // Verify Modal Header and Lecturers
    await waitFor(() => {
      expect(screen.getByText(/Danh Sách Giảng Viên — Bộ môn Công nghệ Phần mềm/i)).toBeInTheDocument();
      expect(screen.getByText('Trần Thị Ngân')).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Văn Long')).toBeInTheDocument();
      expect(screen.getByText(/UTC001/)).toBeInTheDocument();
      expect(screen.getByText(/UTC002/)).toBeInTheDocument();
    });

    // Close Modal
    const closeBtn = screen.getByTitle('Đóng');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Danh Sách Giảng Viên — Bộ môn Công nghệ Phần mềm/i)).not.toBeInTheDocument();
    });
  });

  it('shows helpful empty state when viewing department with 0 lecturers', async () => {
    render(
      <BrowserRouter>
        <BatchesPage />
      </BrowserRouter>
    );

    const deptTab = screen.getByText(/Danh Mục Bộ Môn Khoa CNTT/i);
    fireEvent.click(deptTab);

    await waitFor(() => {
      expect(screen.getByText('HTTT')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByText(/Xem Danh Sách Giảng Viên/i);
    // HTTT is the second department card
    fireEvent.click(viewButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/Bộ môn "Bộ môn Hệ thống Thông tin" hiện chưa có giảng viên nào/i)).toBeInTheDocument();
      expect(screen.getByText(/Gán Giảng Viên Vào Bộ Môn Ngay/i)).toBeInTheDocument();
    });
  });
});

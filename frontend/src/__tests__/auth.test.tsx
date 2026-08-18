import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminLoginPage } from '../pages/Login/AdminLoginPage';
import { AdminRegisterPage } from '../pages/Login/AdminRegisterPage';

const mockLogin = vi.fn();

const mockRegister = vi.fn();

vi.mock('../auth/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAuthenticated: false,
    userType: null,
    loading: false,
    login: mockLogin,
    register: mockRegister,
    logout: vi.fn(),
  }),
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Admin Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Admin Login page correctly', () => {
    render(
      <BrowserRouter>
        <AdminLoginPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/UTC ADMIN PORTAL/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@utc.edu.vn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng Nhập Quản Trị/i })).toBeInTheDocument();
    expect(screen.getByText(/Đăng ký Admin/i)).toBeInTheDocument();
  });

  it('renders Admin Register page with secret key input', () => {
    render(
      <BrowserRouter>
        <AdminRegisterPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/ĐĂNG KÝ ADMIN/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin_username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập khóa bảo mật Backend Admin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo Tài Khoản Admin/i })).toBeInTheDocument();
  });

  it('validates password mismatch on Admin Register page', async () => {
    render(
      <BrowserRouter>
        <AdminRegisterPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/admin_username/i), { target: { value: 'admin_demo' } });
    fireEvent.change(screen.getByPlaceholderText(/admin@utc.edu.vn/i), { target: { value: 'admin_demo@utc.edu.vn' } });
    
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(passwordInputs[0], { target: { value: 'Password123!' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'MismatchPassword!' } });
    fireEvent.change(screen.getByPlaceholderText(/Nhập khóa bảo mật Backend Admin/i), { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /Tạo Tài Khoản Admin/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mật khẩu xác nhận không khớp/i)).toBeInTheDocument();
    });
  });

  it('submits registration successfully when inputs are valid', async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    render(
      <BrowserRouter>
        <AdminRegisterPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/admin_username/i), { target: { value: 'admin_valid' } });
    fireEvent.change(screen.getByPlaceholderText(/admin@utc.edu.vn/i), { target: { value: 'admin_valid@utc.edu.vn' } });
    
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(passwordInputs[0], { target: { value: 'SecureAdminPassword123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'SecureAdminPassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/Nhập khóa bảo mật Backend Admin/i), { target: { value: 'utc-smart-fyp-admin-secret-key-2026' } });

    fireEvent.click(screen.getByRole('button', { name: /Tạo Tài Khoản Admin/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'admin_valid',
        'admin_valid@utc.edu.vn',
        'SecureAdminPassword123',
        'utc-smart-fyp-admin-secret-key-2026'
      );
      expect(screen.getByText(/Đăng ký tài khoản Admin thành công/i)).toBeInTheDocument();
    });
  });
});


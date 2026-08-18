import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedAdminRoute } from '../auth/ProtectedAdminRoute';


const mockUseAdminAuth = vi.fn();

vi.mock('../auth/AdminAuthContext', () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

describe('Admin RBAC Frontend Protection', () => {
  it('redirects to /login if user is unauthenticated', () => {
    mockUseAdminAuth.mockReturnValue({
      isAuthenticated: false,
      userType: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin-secret-page']}>
        <Routes>
          <Route path="/login" element={<div>Login Page Redirect Target</div>} />
          <Route
            path="/admin-secret-page"
            element={
              <ProtectedAdminRoute>
                <div>Admin Secret Content</div>
              </ProtectedAdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Redirect Target')).toBeInTheDocument();
    expect(screen.queryByText('Admin Secret Content')).not.toBeInTheDocument();
  });

  it('renders admin content when user is authenticated with admin role', () => {
    mockUseAdminAuth.mockReturnValue({
      isAuthenticated: true,
      userType: 'admin',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin-secret-page']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/admin-secret-page"
            element={
              <ProtectedAdminRoute>
                <div>Admin Secret Content</div>
              </ProtectedAdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Secret Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { setAccessToken } from '../api/client';
import type { UserType, AdminUser } from '../types';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  currentUser: AdminUser | null;
  userType: UserType | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, adminSecret: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const refreshPromise = authApi.refreshToken();
        const timeoutPromise = new Promise<{ access: string; user?: AdminUser }>((_, reject) =>
          setTimeout(() => reject(new Error('Auth init timeout')), 8000)
        );
        const res = await Promise.race([refreshPromise, timeoutPromise]);
        if (isMounted && res && res.access) {
          setAccessToken(res.access);
          setIsAuthenticated(true);
          const role = (res as any).user_type || (res as any).user?.user_type || 'admin';
          setUserType(role as UserType);
        } else if (isMounted) {
          setAccessToken(null);
          setIsAuthenticated(false);
          setUserType(null);
          setCurrentUser(null);
          localStorage.removeItem('admin_user');
        }
      } catch (err) {
        if (isMounted) {
          setAccessToken(null);
          setIsAuthenticated(false);
          setUserType(null);
          setCurrentUser(null);
          localStorage.removeItem('admin_user');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (res.user_type !== 'admin' && res.user_type !== 'academic_staff') {
      await authApi.logout();
      throw new Error('Truy cập bị từ chối: Tài khoản không có quyền Quản trị hoặc Giáo vụ.');
    }
    setAccessToken(res.access);
    setIsAuthenticated(true);
    setUserType((res.user_type || 'admin') as UserType);
  };

  const register = async (username: string, email: string, password: string, adminSecret: string) => {
    await authApi.register({
      username,
      email,
      password,
      admin_secret: adminSecret,
    });
  };

  const logout = async () => {
    await authApi.logout();
    setAccessToken(null);
    setIsAuthenticated(false);
    setUserType(null);
    setCurrentUser(null);
    localStorage.removeItem('admin_user');
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, currentUser, userType, loading, login, register, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};



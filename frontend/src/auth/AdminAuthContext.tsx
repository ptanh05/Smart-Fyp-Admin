import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { setAccessToken } from '../api/client';
import type { UserType } from '../types';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  userType: UserType | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const refreshPromise = authApi.refreshToken();
        const timeoutPromise = new Promise<{ access: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Auth init timeout')), 8000)
        );
        const res = await Promise.race([refreshPromise, timeoutPromise]);
        if (isMounted && res && res.access) {
          setAccessToken(res.access);
          setIsAuthenticated(true);
          setUserType('admin');
        } else if (isMounted) {
          setAccessToken(null);
          setIsAuthenticated(false);
          setUserType(null);
        }
      } catch (err) {
        if (isMounted) {
          setAccessToken(null);
          setIsAuthenticated(false);
          setUserType(null);
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
    if (res.user_type !== 'admin') {
      await authApi.logout();
      throw new Error('Truy cập bị từ chối: Tài khoản không có quyền Admin.');
    }
    setAccessToken(res.access);
    setIsAuthenticated(true);
    setUserType('admin');
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
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, userType, loading, login, register, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};



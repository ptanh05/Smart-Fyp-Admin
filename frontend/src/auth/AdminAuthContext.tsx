import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { setAccessToken } from '../api/client';
import type { UserType } from '../types';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  userType: UserType | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
    const initAuth = async () => {
      try {
        const res = await authApi.refreshToken();
        if (res && res.access) {
          setAccessToken(res.access);
          setIsAuthenticated(true);
          setUserType('admin');
        } else {
          setAccessToken(null);
          setIsAuthenticated(false);
          setUserType(null);
        }
      } catch (err) {
        setAccessToken(null);
        setIsAuthenticated(false);
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
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

  const logout = async () => {
    await authApi.logout();
    setAccessToken(null);
    setIsAuthenticated(false);
    setUserType(null);
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, userType, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};


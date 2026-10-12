import { apiClient, setAccessToken } from './client';
import type { AdminUser } from '../types';

export interface AdminLoginResponse {
  access: string;
  expire_time?: string;
  user_type: string;
  user?: AdminUser;
  message?: string;
}

export interface AdminRegisterPayload {
  username: string;
  email: string;
  password: string;
  admin_secret: string;
}

export interface AdminRegisterResponse {
  message: string;
  access?: string;
  user: AdminUser;
}

export const authApi = {
  async login(identifier: string, password: string): Promise<AdminLoginResponse> {
    const response = await apiClient.post<AdminLoginResponse>('/admin/login/', {
      username: identifier,
      email: identifier,
      password,
    });
    return response.data;
  },

  async register(data: AdminRegisterPayload): Promise<AdminRegisterResponse> {
    const response = await apiClient.post<AdminRegisterResponse>('/admin/register/', data);
    return response.data;
  },

  async refreshToken(): Promise<{ access: string; user?: AdminUser }> {
    const response = await apiClient.post<{ access: string; user?: AdminUser }>('/token/refresh/', {});
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/token/logout/', {});
    } catch (e) {
      // Ignore network errors during logout
    } finally {
      setAccessToken(null);
    }
  },
};



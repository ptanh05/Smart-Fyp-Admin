import { apiClient, setAccessToken } from './client';

export interface AdminLoginResponse {
  access: string;
  expire_time: string;
  user_type: string;
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
  user: {
    id: number;
    username: string;
    email: string;
    user_type: string;
    is_active: boolean;
  };
}

export const authApi = {
  async login(email: string, password: string): Promise<AdminLoginResponse> {
    const response = await apiClient.post<AdminLoginResponse>('/admin/login/', {
      email,
      password,
    });
    return response.data;
  },

  async register(data: AdminRegisterPayload): Promise<AdminRegisterResponse> {
    const response = await apiClient.post<AdminRegisterResponse>('/admin/register/', data);
    return response.data;
  },

  async refreshToken(): Promise<{ access: string }> {
    const response = await apiClient.post<{ access: string }>('/token/refresh/', {});
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



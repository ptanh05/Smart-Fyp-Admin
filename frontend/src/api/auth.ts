import { apiClient, setAccessToken } from './client';

export interface AdminLoginResponse {
  access: string;
  expire_time: string;
  user_type: string;
}

export const authApi = {
  async login(email: string, password: string): Promise<AdminLoginResponse> {
    const response = await apiClient.post<AdminLoginResponse>('/supervisor/login/', {
      email,
      password,
    });
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


import { apiClient } from './client';
import type { AdminUser, UserType } from '../types';

export const usersApi = {
  async getUsers(params?: {
    q?: string;
    role?: string;
    is_active?: string;
  }): Promise<{ users: AdminUser[]; total: number }> {
    const response = await apiClient.get<{ users: AdminUser[]; total: number }>('/admin/users/', { params });
    return response.data;
  },

  async updateUser(
    id: number,
    data: { is_active?: boolean; user_type?: UserType }
  ): Promise<{ message: string; user: AdminUser }> {
    const response = await apiClient.patch<{ message: string; user: AdminUser }>(`/admin/users/${id}/`, data);
    return response.data;
  },
};

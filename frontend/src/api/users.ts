import { apiClient } from './client';
import type {
  AdminUser,
  UserType,
  MajorType,
  ProgramType,
  PasswordStrategy,
  UserCounts,
  ImportResult
} from '../types';

export interface CreateUserPayload {
  username: string;
  email?: string;
  password?: string;
  user_type: UserType;
  is_active?: boolean;

  // Profile details
  first_name?: string;
  last_name?: string;
  phone_number?: string;

  // Student specific
  registration_no?: string;
  major?: MajorType;
  program_type?: ProgramType;
  class_name?: string;
  course_class_id?: number | null;
  academic_batch_id?: number | null;
  password_strategy?: PasswordStrategy;
  custom_password?: string;

  // Supervisor specific
  supervisor_id?: string;
  academic_title?: string;
  department_name?: string;
  is_external?: boolean;
  max_total_quota?: number;
  viet_anh_quota?: number;
  general_cntt_quota?: number;

  // Council member
  external_institution?: string;
}

export interface GetUsersParams {
  q?: string;
  search?: string;
  role?: string;
  user_type?: string;
  major?: string;
  program_type?: string;
  class_id?: string | number;
  batch_id?: string | number;
  supervisor_id?: string | number;
  has_supervisor?: string | boolean;
  is_active?: string;
}

export const usersApi = {
  async getUsers(params?: GetUsersParams): Promise<{ users: AdminUser[]; total: number; counts: UserCounts }> {
    const response = await apiClient.get<{ users: AdminUser[]; total: number; counts: UserCounts }>('/admin/users/', { params });
    return response.data;
  },

  async createUser(data: CreateUserPayload): Promise<{ message: string; user: AdminUser; plain_password?: string }> {
    const response = await apiClient.post<{ message: string; user: AdminUser; plain_password?: string }>('/admin/users/', data);
    return response.data;
  },

  async updateUser(
    id: number,
    data: Partial<CreateUserPayload> & { is_active?: boolean; user_type?: UserType }
  ): Promise<{ message: string; user: AdminUser }> {
    const response = await apiClient.patch<{ message: string; user: AdminUser }>(`/admin/users/${id}/`, data);
    return response.data;
  },

  async deleteUser(id: number): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/admin/users/${id}/`);
    return response.data;
  },

  async resetPassword(
    id: number,
    data: { password_strategy: PasswordStrategy; custom_password?: string }
  ): Promise<{ message: string; username: string; new_password: string }> {
    const response = await apiClient.post<{ message: string; username: string; new_password: string }>(
      `/admin/users/${id}/reset-password/`,
      data
    );
    return response.data;
  },

  async importUsersExcel(formData: FormData): Promise<ImportResult> {
    const response = await apiClient.post<ImportResult>('/admin/users/import-excel/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async downloadTemplate(type: 'student' | 'supervisor' = 'student'): Promise<Blob> {
    const response = await apiClient.get('/admin/users/template/', {
      params: { type },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportUsersExcel(params?: GetUsersParams): Promise<Blob> {
    const response = await apiClient.get('/admin/users/export/', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};



import { apiClient } from './client';

export interface CourseClass {
  id: number;
  batch: number;
  class_code: string;
  class_name: string;
  program_type: 'VIET_ANH' | 'DAI_TRA' | 'KHMT' | 'KHOA_CU';
  class_group: string | null;
  student_count: number;
}

export interface AcademicBatch {
  id: number;
  batch_code: string;
  batch_name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  classes: CourseClass[];
  student_count: number;
  project_count: number;
}

export const batchesApi = {
  async getBatches(): Promise<AcademicBatch[]> {
    const response = await apiClient.get<any>('/admin/batches/');
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  },

  async createBatch(data: Partial<AcademicBatch>): Promise<AcademicBatch> {
    const response = await apiClient.post<AcademicBatch>('/admin/batches/', data);
    return response.data;
  },

  async updateBatch(id: number, data: Partial<AcademicBatch>): Promise<AcademicBatch> {
    const response = await apiClient.patch<AcademicBatch>(`/admin/batches/${id}/`, data);
    return response.data;
  },
};

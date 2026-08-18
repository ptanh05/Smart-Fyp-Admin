import { apiClient } from './client';
import type { AdminSecurityMetrics } from '../types';

export const securityApi = {
  async getSecurityMetrics(): Promise<AdminSecurityMetrics> {
    const response = await apiClient.get<AdminSecurityMetrics>('/admin/security-center/');
    return response.data;
  },
};

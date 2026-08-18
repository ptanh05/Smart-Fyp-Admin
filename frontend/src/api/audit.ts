import { apiClient } from './client';
import type { AuditLog, AuditLogStats } from '../types';

export const auditApi = {
  async getAuditLogs(params?: {
    page?: number;
    evaluation_type?: string;
    action_type?: string;
    group?: number;
    user?: number;
  }): Promise<{ results: AuditLog[]; count: number }> {
    const response = await apiClient.get<{ results: AuditLog[]; count: number }>('/audit-logs/', { params });
    return response.data;
  },

  async getAuditLogStats(): Promise<AuditLogStats> {
    const response = await apiClient.get<AuditLogStats>('/audit-logs/stats/');
    return response.data;
  },
};

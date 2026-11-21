import { apiClient } from './client';
import type {
  FacultyAnalyticsData,
  ScoreDiscrepancyResponse,
  Rubric,
  RubricCriterion,
  ThesisArchiveRecord,
  ThesisArchiveListResponse,
  DataRetentionPreview,
  DataRetentionApplyResult,
  FeatureAuditLogResponse,
} from '../types';

export const featuresApi = {
  // -------------------------------------------------------------------------
  // Faculty Analytics
  // -------------------------------------------------------------------------
  async getFacultyAnalytics(params?: {
    batch_id?: string | number;
    supervisor_id?: string | number;
    department?: string;
  }): Promise<FacultyAnalyticsData> {
    const resp = await apiClient.get<FacultyAnalyticsData>('/admin/analytics/faculty/', { params });
    return resp.data;
  },

  // -------------------------------------------------------------------------
  // Score Discrepancy
  // -------------------------------------------------------------------------
  async getScoreDiscrepancy(params?: {
    batch_id?: string | number;
    threshold?: number;
  }): Promise<ScoreDiscrepancyResponse> {
    const resp = await apiClient.get<ScoreDiscrepancyResponse>('/admin/analytics/score-discrepancy/', { params });
    return resp.data;
  },

  // -------------------------------------------------------------------------
  // Rubric Management
  // -------------------------------------------------------------------------
  async listRubrics(params?: {
    batch_id?: string | number;
    role?: string;
    active?: boolean;
  }): Promise<Rubric[]> {
    const resp = await apiClient.get<Rubric[]>('/admin/rubrics/', { params });
    return resp.data;
  },

  async getRubric(id: number): Promise<Rubric> {
    const resp = await apiClient.get<Rubric>(`/admin/rubrics/${id}/`);
    return resp.data;
  },

  async createRubric(data: Partial<Rubric>): Promise<Rubric> {
    const resp = await apiClient.post<Rubric>('/admin/rubrics/', data);
    return resp.data;
  },

  async updateRubric(id: number, data: Partial<Rubric>): Promise<Rubric> {
    const resp = await apiClient.patch<Rubric>(`/admin/rubrics/${id}/`, data);
    return resp.data;
  },

  async deleteRubric(id: number): Promise<{ deactivated?: boolean; detail?: string }> {
    const resp = await apiClient.delete<{ deactivated?: boolean; detail?: string }>(`/admin/rubrics/${id}/`);
    return resp.data ?? {};
  },

  async activateRubric(id: number): Promise<Rubric> {
    const resp = await apiClient.post<Rubric>(`/admin/rubrics/${id}/activate/`);
    return resp.data;
  },

  async listCriteria(rubricId: number): Promise<RubricCriterion[]> {
    const resp = await apiClient.get<RubricCriterion[]>(`/admin/rubrics/${rubricId}/criteria/`);
    return resp.data;
  },

  async createCriterion(rubricId: number, data: Partial<RubricCriterion>): Promise<RubricCriterion> {
    const resp = await apiClient.post<RubricCriterion>(`/admin/rubrics/${rubricId}/criteria/`, data);
    return resp.data;
  },

  async updateCriterion(rubricId: number, id: number, data: Partial<RubricCriterion>): Promise<RubricCriterion> {
    const resp = await apiClient.patch<RubricCriterion>(`/admin/rubrics/${rubricId}/criteria/${id}/`, data);
    return resp.data;
  },

  async deleteCriterion(rubricId: number, id: number): Promise<void> {
    await apiClient.delete(`/admin/rubrics/${rubricId}/criteria/${id}/`);
  },

  // -------------------------------------------------------------------------
  // Thesis Archive
  // -------------------------------------------------------------------------
  async listArchive(params?: {
    batch_id?: string | number;
    visibility?: string;
    embargo_active?: boolean;
    keyword?: string;
    page?: number;
  }): Promise<ThesisArchiveListResponse> {
    const resp = await apiClient.get<ThesisArchiveListResponse>('/admin/archive/', { params });
    return resp.data;
  },

  async setEmbargo(
    id: number,
    data: { embargo_reason: string; embargo_until?: string; max_years?: number }
  ): Promise<ThesisArchiveRecord> {
    const resp = await apiClient.post<ThesisArchiveRecord>(`/admin/archive/${id}/embargo/`, data);
    return resp.data;
  },

  async liftEmbargo(id: number): Promise<ThesisArchiveRecord> {
    const resp = await apiClient.delete<ThesisArchiveRecord>(`/admin/archive/${id}/embargo/`);
    return resp.data;
  },

  // -------------------------------------------------------------------------
  // Data Retention
  // -------------------------------------------------------------------------
  async getRetentionPreview(years?: number): Promise<DataRetentionPreview> {
    const resp = await apiClient.get<DataRetentionPreview>('/admin/data-retention/preview/', {
      params: years ? { years } : undefined,
    });
    return resp.data;
  },

  async applyRetention(years: number): Promise<DataRetentionApplyResult> {
    const resp = await apiClient.post<DataRetentionApplyResult>('/admin/data-retention/apply/', {
      years,
      confirm: 'CONFIRM_DELETE',
    });
    return resp.data;
  },

  // -------------------------------------------------------------------------
  // Feature Audit Logs
  // -------------------------------------------------------------------------
  async getFeatureAuditLogs(params?: {
    page?: number;
    action_type?: string;
  }): Promise<FeatureAuditLogResponse> {
    const resp = await apiClient.get<FeatureAuditLogResponse>('/admin/audit-logs/features/', { params });
    return resp.data;
  },
};

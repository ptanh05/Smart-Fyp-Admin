import { apiClient } from './client';
import type { AdminSecurityMetrics } from '../types';

export interface SecuritySessionItem {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  user_type: string;
  portal: string;
  ip_address: string | null;
  user_agent: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
  revoke_reason: string;
}

export interface SecurityPolicyItem {
  id: number;
  policy_key: string;
  label: string;
  policy_value: string;
  description: string;
  updated_at: string;
}

export const securityApi = {
  async getSecurityMetrics(): Promise<AdminSecurityMetrics & {
    policies?: SecurityPolicyItem[];
    active_sessions?: SecuritySessionItem[];
    rbac_matrix?: Array<{ role: string; label: string; scopes: string[] }>;
  }> {
    const response = await apiClient.get('/admin/security-center/');
    return response.data;
  },

  async revokeSession(sessionId: number, reason = '', revokeAllForUser = false): Promise<any> {
    const response = await apiClient.post(`/admin/security-center/sessions/${sessionId}/revoke/`, {
      reason,
      revoke_all_for_user: revokeAllForUser,
    });
    return response.data;
  },

  async getPolicies(): Promise<SecurityPolicyItem[]> {
    const response = await apiClient.get('/admin/security-center/policies/');
    return Array.isArray(response.data) ? response.data : [];
  },

  async updatePolicies(policies: Array<{ policy_key: string; policy_value: string }>): Promise<SecurityPolicyItem[]> {
    const response = await apiClient.put('/admin/security-center/policies/', { policies });
    return Array.isArray(response.data) ? response.data : [];
  },
};

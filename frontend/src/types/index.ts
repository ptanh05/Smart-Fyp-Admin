export type UserType = 'student' | 'supervisor' | 'committee_member' | 'external_examiner' | 'admin';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  user_type: UserType;
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
}

export interface AdminSecurityEvent {
  id: number;
  action: string;
  actor: string;
  created_at: string;
  details: string;
}

export interface AdminSecurityMetrics {
  total_users: number;
  active_users: number;
  deactivated_users: number;
  security_headers: {
    httponly_cookies: boolean;
    content_security_policy: boolean;
    hsts_production: boolean;
    cors_credentials: boolean;
    magic_bytes_file_inspection: boolean;
    websocket_one_time_tickets: boolean;
  };
  recent_audit_events: AdminSecurityEvent[];
}

export interface AuditLog {
  id: number;
  evaluation_type: string;
  action_type: string;
  description: string;
  created_at: string;
  user?: number | null;
  user_name?: string | null;
  user_role?: string | null;
  supervisor_group?: number | null;
  group_name?: string | null;
  ip_address?: string | null;
}

export interface AuditLogStats {
  total_logs: number;
  evaluation_logs: number;
  action_logs: number;
  by_evaluation_type: Record<string, number>;
  by_action_type: Record<string, number>;
}

export type UserType = 'student' | 'supervisor' | 'committee_member' | 'external_examiner' | 'admin';
export type MajorType = 'CNTT' | 'KHMT';
export type ProgramType = 'VIET_ANH' | 'DAI_TRA' | 'KHMT' | 'KHOA_CU';
export type PasswordStrategy = 'MSSV' | 'FIXED' | 'RANDOM' | 'CUSTOM';

export interface StudentProfileDetail {
  id: number;
  registration_no: string;
  department: string | null;
  semester: string | null;
  batch_no: string | null;
  phone_number: string | null;
  course_class: number | null;
  class_code: string;
  class_name: string;
  program_type: ProgramType | string;
  academic_batch: number | null;
  batch_name: string;
  supervisor_id: number | null;
  supervisor_name: string;
  topic_title: string;
  major: MajorType;
}

export interface SupervisorProfileDetail {
  id: number;
  supervisor_id: string;
  academic_title: string | null;
  department_name: string | null;
  phone_number: string | null;
  research_interest: string | null;
  academic_background: string | null;
  is_external: boolean;
  quota_info?: {
    viet_anh_quota: number;
    general_cntt_quota: number;
    max_total_quota: number;
    current_assigned: number;
  };
}

export interface CouncilRoleDetail {
  id: number;
  council: number;
  council_name: string;
  council_number: number;
  role: string;
  external_institution: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  user_type: UserType;
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
  date_joined?: string;
  student_profile?: StudentProfileDetail | null;
  supervisor_profile?: SupervisorProfileDetail | null;
  council_roles?: CouncilRoleDetail[];
}

export interface UserCounts {
  total: number;
  students: number;
  supervisors: number;
  committee: number;
  external: number;
  admins: number;
  cntt_students: number;
  khmt_students: number;
}

export interface ImportResultAccount {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  major: string;
  program_type: string;
  class_name: string;
  plain_password: string;
  status: 'created' | 'updated';
}

export interface ImportResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  created_accounts: ImportResultAccount[];
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

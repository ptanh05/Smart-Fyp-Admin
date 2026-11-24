// Hiển thị giai đoạn đồ án theo contract `workflow` do backend tính
// (backend/app/services/workflow_stages.py — giống hệt bản ở Cổng Người dùng).
// Admin KHÔNG tự suy luận giai đoạn từ trạng thái thô để luôn thấy cùng số GĐ
// với Sinh viên và GVHD.

export type WorkflowStageStatus = 'completed' | 'active' | 'locked';

export interface ProjectWorkflowStage {
  number: number;
  key: string;
  label: string;
  status: WorkflowStageStatus;
  accessible: boolean;
  editable: boolean;
  reason: string | null;
}

export interface ProjectWorkflow {
  contract_version?: string;
  current_stage_number: number;
  current_stage_key: string;
  current_stage_label: string;
  current_step_key?: string;
  current_step_label?: string | null;
  overall_percent: number;
  project_status: string | null;
  batch_status: string | null;
  batch_closed?: boolean;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  block_kind?: string | null;
  is_finished?: boolean;
  defense_eligible?: boolean;
  stages: ProjectWorkflowStage[];
}

export interface WorkflowCarrier {
  status?: string;
  workflow?: ProjectWorkflow | null;
  workflow_stage_number?: number | null;
  is_eligible_for_defense?: boolean;
}

export const STAGE_SHORT_LABELS: Record<number, string> = {
  1: 'Đề tài & GVHD',
  2: 'Khảo sát nguyện vọng',
  3: 'Đề cương & ký số',
  4: 'Nộp bản nháp đồ án',
  5: 'Thực hiện đồ án & báo cáo tiến độ',
  6: 'Đánh giá & bảo vệ',
};

export function getWorkflowStageNumber(project: WorkflowCarrier | null | undefined): number | null {
  if (!project) return null;
  const raw = project.workflow?.current_stage_number ?? project.workflow_stage_number;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 1) return null;
  return Math.min(6, Math.trunc(num));
}

export function formatWorkflowStage(project: WorkflowCarrier | null | undefined): string {
  const num = getWorkflowStageNumber(project);
  if (num === null) return project?.status || '—';
  return `GĐ${num}: ${STAGE_SHORT_LABELS[num]}`;
}

export function getWorkflowStepLabel(project: WorkflowCarrier | null | undefined): string | null {
  const wf = project?.workflow;
  if (!wf) return null;
  return wf.blocked_reason || wf.current_step_label || null;
}

export function isDefenseEligible(project: WorkflowCarrier): boolean {
  if (project.workflow) return Boolean(project.workflow.defense_eligible);
  return project.status === 'DEFENSE_READY' || Boolean(project.is_eligible_for_defense);
}

export function isDeferred(project: WorkflowCarrier): boolean {
  if (project.workflow) return project.workflow.block_kind === 'deferred';
  return project.status === 'DEFERRED';
}

/** Đang triển khai = GĐ4 (bản nháp) hoặc GĐ5 (thực hiện & báo cáo), không bị dừng. */
export function isInExecution(project: WorkflowCarrier): boolean {
  if (project.workflow) {
    const n = project.workflow.current_stage_number;
    return (n === 4 || n === 5) && !project.workflow.is_blocked;
  }
  return project.status === 'IN_PROGRESS' || project.status === 'OUTLINE_APPROVED';
}

import { describe, expect, it } from 'vitest';
import {
  formatWorkflowStage,
  getWorkflowStageNumber,
  getWorkflowStepLabel,
  isDefenseEligible,
  isDeferred,
  isInExecution,
  type ProjectWorkflow,
} from '../utils/workflowStage';

const wf = (n: number, extra: Partial<ProjectWorkflow> = {}): ProjectWorkflow => ({
  current_stage_number: n,
  current_stage_key: 'x',
  current_stage_label: `GĐ ${n}`,
  overall_percent: 0,
  project_status: null,
  batch_status: null,
  stages: [],
  ...extra,
});

describe('Admin – hiển thị giai đoạn theo workflow backend (kịch bản 15)', () => {
  it('ưu tiên workflow thay vì trạng thái thô', () => {
    // Trạng thái thô OUTLINE_PENDING (GVHD đã duyệt) nhưng chưa được Khoa duyệt -> GĐ3.
    const p = { status: 'OUTLINE_PENDING', workflow: wf(3, { current_step_label: 'GVHD đã duyệt, đề cương đang chờ Khoa phê duyệt.' }) };
    expect(getWorkflowStageNumber(p)).toBe(3);
    expect(formatWorkflowStage(p)).toBe('GĐ3: Đề cương & ký số');
    expect(getWorkflowStepLabel(p)).toContain('chờ Khoa');
  });

  it('dùng workflow_stage_number khi không có object workflow, rồi mới tới status', () => {
    expect(formatWorkflowStage({ status: 'IN_PROGRESS', workflow_stage_number: 5 })).toBe('GĐ5: Task board & nhật ký');
    expect(formatWorkflowStage({ status: 'IN_PROGRESS' })).toBe('IN_PROGRESS');
  });

  it('thống kê dựa trên workflow: hoãn, đủ điều kiện bảo vệ, đang triển khai', () => {
    const deferred = { status: 'IN_PROGRESS', workflow: wf(4, { is_blocked: true, block_kind: 'deferred' }) };
    expect(isDeferred(deferred)).toBe(true);
    expect(isInExecution(deferred)).toBe(false);

    const notEligible = { status: 'DEFENSE_READY', is_eligible_for_defense: true, workflow: wf(6, { defense_eligible: false }) };
    expect(isDefenseEligible(notEligible)).toBe(false);

    expect(isInExecution({ status: 'OUTLINE_APPROVED', workflow: wf(5) })).toBe(true);
    expect(isInExecution({ status: 'OUTLINE_PENDING', workflow: wf(3) })).toBe(false);
  });
});

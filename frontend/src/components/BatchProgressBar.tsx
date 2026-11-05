/**
 * Thanh tiến trình đợt đồ án (6 giai đoạn) — hiển thị ở đầu trang
 * để người dùng theo dõi đợt đồ án đang ở giai đoạn nào.
 *
 * Dùng chung cho:
 *  - Admin Portal (Smart-Fyp-Admin)
 *  - Cổng Sinh viên / Cổng Giảng viên (smart-fyp-management)
 */
import React, { useState } from 'react';
import './BatchProgressBar.css';

export interface BatchStage {
  number: number;
  key: string;
  code?: string;
  label: string;
  short_label: string;
  icon: string;
  description: string;
  role_hint?: string;
  status: 'done' | 'active' | 'pending' | 'locked';
  percent: number;
  stats?: Record<string, string | number>;
  action_hint?: string;
}

export interface BatchProgressData {
  batch?: {
    id: number;
    batch_code: string;
    batch_name: string;
    program_type: string;
    current_stage: string;
    is_active: boolean;
    is_closed: boolean;
    start_date?: string | null;
    end_date?: string | null;
  };
  is_open: boolean;
  current_stage_number: number;
  current_stage?: BatchStage;
  overall_percent: number;
  stages: BatchStage[];
  next_actions?: string[];
  summary?: Record<string, number>;
  my_project?: {
    has_project: boolean;
    status?: string;
    topic_title?: string;
    supervisor_name?: string;
  };
}

interface Props {
  data: BatchProgressData | null;
  loading?: boolean;
  /** Hiển thị chi tiết chỉ số của từng giai đoạn (mặc định: có) */
  showStats?: boolean;
  /** Cho phép bấm vào giai đoạn để điều hướng */
  onStageClick?: (stage: BatchStage) => void;
  /** Gọi lại khi người dùng bấm nút làm mới */
  onRefresh?: () => void;
  /** Tiêu đề hiển thị */
  title?: string;
  variant?: 'admin' | 'portal';
}

const STATUS_LABEL: Record<BatchStage['status'], string> = {
  done: 'Đã hoàn thành',
  active: 'Đang thực hiện',
  pending: 'Chưa bắt đầu',
  locked: 'Đang khóa',
};

export const BatchProgressBar: React.FC<Props> = ({
  data,
  loading = false,
  showStats = true,
  onStageClick,
  onRefresh,
  title,
  variant = 'portal',
}) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (loading) {
    return (
      <div className={`utc-bpb utc-bpb-${variant} utc-bpb-loading`}>
        <div className="utc-bpb-skeleton-line" />
        <div className="utc-bpb-skeleton-steps">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="utc-bpb-skeleton-step" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.stages || data.stages.length === 0) {
    return (
      <div className={`utc-bpb utc-bpb-${variant} utc-bpb-empty`}>
        <div className="utc-bpb-empty-icon">📭</div>
        <div className="utc-bpb-empty-text">
          <strong>Chưa có đợt đồ án nào đang hoạt động</strong>
          <span>Liên hệ Khoa CNTT để được thêm vào đợt đồ án hiện tại.</span>
        </div>
      </div>
    );
  }

  const currentStage = data.stages.find((s) => s.number === data.current_stage_number);
  const programLabel =
    data.batch?.program_type === 'ENGINEER'
      ? '⚙️ Hệ Kỹ sư'
      : data.batch?.program_type === 'BACHELOR'
        ? '🎓 Hệ Cử nhân'
        : '🔄 Cả Cử nhân & Kỹ sư';

  return (
    <div className={`utc-bpb utc-bpb-${variant}`}>
      {/* ---------- Header ---------- */}
      <div className="utc-bpb-header">
        <div className="utc-bpb-header-left">
          <span className="utc-bpb-title-icon">🚦</span>
          <div className="utc-bpb-title-group">
            <span className="utc-bpb-title">
              {title || 'Tiến Trình Đợt Đồ Án'}
              {data.batch?.batch_code ? (
                <span className="utc-bpb-batch-code">{data.batch.batch_code}</span>
              ) : null}
            </span>
            <span className="utc-bpb-subtitle">
              {data.batch?.batch_name || ''} · {programLabel}
            </span>
          </div>
        </div>

        <div className="utc-bpb-header-right">
          <span
            className={`utc-bpb-status-pill ${data.is_open ? 'open' : 'closed'}`}
            title={
              data.is_open
                ? 'Đợt đang mở cho sinh viên đăng ký'
                : 'Đợt đang đóng / đã kết thúc'
            }
          >
            {data.is_open ? '🟢 Đợt đang mở' : '🔴 Đợt đã đóng'}
          </span>
          <span className="utc-bpb-percent" title="Tiến độ tổng thể của đợt">
            {Math.round(data.overall_percent || 0)}%
          </span>
          {onRefresh && (
            <button
              type="button"
              className="utc-bpb-refresh"
              onClick={onRefresh}
              title="Làm mới tiến trình"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* ---------- Thanh % tổng thể ---------- */}
      <div className="utc-bpb-overall-track">
        <div
          className="utc-bpb-overall-fill"
          style={{ width: `${Math.min(100, Math.max(0, data.overall_percent || 0))}%` }}
        />
      </div>

      {/* ---------- 6 bước ---------- */}
      <div className="utc-bpb-steps">
        {data.stages.map((stage) => {
          const isActive = stage.number === data.current_stage_number;
          const isExpanded = expanded === stage.number;
          return (
            <div
              key={stage.number}
              className={`utc-bpb-step ${stage.status} ${isActive ? 'current' : ''}`}
            >
              <button
                type="button"
                className="utc-bpb-step-head"
                onClick={() => {
                  setExpanded(isExpanded ? null : stage.number);
                  if (onStageClick) onStageClick(stage);
                }}
                title={stage.description}
              >
                <span className="utc-bpb-step-dot">
                  {stage.status === 'done' ? '✓' : stage.number}
                </span>
                <span className="utc-bpb-step-icon">{stage.icon}</span>
                <span className="utc-bpb-step-body">
                  <span className="utc-bpb-step-label">{stage.short_label}</span>
                  <span className="utc-bpb-step-status">{STATUS_LABEL[stage.status]}</span>
                </span>
              </button>

              {showStats && isExpanded && (
                <div className="utc-bpb-step-detail">
                  <p className="utc-bpb-step-desc">{stage.description}</p>
                  {stage.role_hint && (
                    <p className="utc-bpb-step-role">👤 Trách nhiệm: {stage.role_hint}</p>
                  )}
                  {stage.action_hint && (
                    <p className="utc-bpb-step-action">👉 {stage.action_hint}</p>
                  )}
                  {stage.stats && Object.keys(stage.stats).length > 0 && (
                    <div className="utc-bpb-step-stats">
                      {Object.entries(stage.stats).map(([k, v]) => (
                        <span key={k} className="utc-bpb-stat-chip">
                          {k}: <strong>{v}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {isActive && stage.percent > 0 && (
                    <div className="utc-bpb-mini-track">
                      <div
                        className="utc-bpb-mini-fill"
                        style={{ width: `${Math.min(100, stage.percent)}%` }}
                      />
                      <span className="utc-bpb-mini-label">{stage.percent}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- Hành động tiếp theo ---------- */}
      {currentStage && (
        <div className="utc-bpb-next">
          <span className="utc-bpb-next-label">Giai đoạn hiện tại:</span>
          <span className="utc-bpb-next-value">
            {currentStage.icon} {currentStage.label}
          </span>
          {data.next_actions && data.next_actions.length > 0 && (
            <span className="utc-bpb-next-hint">· {data.next_actions[0]}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchProgressBar;

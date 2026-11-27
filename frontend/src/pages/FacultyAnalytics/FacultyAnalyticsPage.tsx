import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { FacultyAnalyticsData, ScoreDiscrepancyResponse } from '../../types';
import './FacultyAnalyticsPage.css';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  ALLOCATED: 'Đã phân công GVHD',
  TOPIC_PENDING: 'Chờ duyệt đề tài',
  TOPIC_APPROVED: 'Đã duyệt đề tài',
  TOPIC_REJECTED: 'Từ chối đề tài',
  IN_PROGRESS: 'Đang thực hiện',
  DEFENSE_READY: 'Sẵn sàng bảo vệ',
  DEFENSE_COMPLETED: 'Đã bảo vệ',
  COMPLETED: 'Hoàn thành',
  PASSED: 'Đạt',
  FAILED: 'Không đạt',
  DEFERRED: 'Bảo lưu',
  CANCELLED: 'Đã hủy',
};

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  PASSED: 'success',
  COMPLETED: 'success',
  DEFENSE_COMPLETED: 'success',
  TOPIC_APPROVED: 'info',
  IN_PROGRESS: 'info',
  ALLOCATED: 'info',
  DEFENSE_READY: 'info',
  TOPIC_PENDING: 'warning',
  DEFERRED: 'warning',
  FAILED: 'danger',
  TOPIC_REJECTED: 'danger',
  CANCELLED: 'danger',
};

const SCORE_SOURCE_LABELS: Record<string, string> = {
  SUPERVISOR: 'GVHD',
  REVIEWER: 'GVPB',
  COUNCIL: 'Hội đồng',
  RUBRIC_SUPERVISOR: 'Rubric GVHD',
  RUBRIC_REVIEWER: 'Rubric GVPB',
  RUBRIC_COUNCIL: 'Rubric HĐ',
};

const KPITile: React.FC<{
  label: string;
  value: string | number | null;
  sub?: string;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}> = ({ label, value, sub, tone = 'default' }) => {
  const valueClass =
    tone === 'success'
      ? 'fa-kpi-value fa-kpi-value--success'
      : tone === 'warn'
        ? 'fa-kpi-value fa-kpi-value--warn'
        : tone === 'danger'
          ? 'fa-kpi-value fa-kpi-value--danger'
          : 'fa-kpi-value';

  return (
    <div className="fa-kpi-card">
      <div className="fa-kpi-label">{label}</div>
      <div className={valueClass}>
        {value === null || value === undefined ? '—' : value}
      </div>
      {sub && <div className="fa-kpi-sub">{sub}</div>}
    </div>
  );
};

const CSSBar: React.FC<{ label: string; count: number; maxCount: number }> = ({
  label,
  count,
  maxCount,
}) => {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="fa-bar-row">
      <span className="fa-bar-label">{label}</span>
      <div className="fa-bar-track">
        <div className="fa-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fa-bar-count">{count}</span>
    </div>
  );
};

export const FacultyAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<FacultyAnalyticsData | null>(null);
  const [discrepancy, setDiscrepancy] = useState<ScoreDiscrepancyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState('');
  const [department, setDepartment] = useState('');
  const [showDiscrepancy, setShowDiscrepancy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analytics, disc] = await Promise.allSettled([
        featuresApi.getFacultyAnalytics({
          batch_id: batchId || undefined,
          department: department || undefined,
        }),
        featuresApi.getScoreDiscrepancy({ batch_id: batchId || undefined }),
      ]);
      if (analytics.status === 'fulfilled') setData(analytics.value);
      else setError('Lỗi tải dữ liệu phân tích.');
      if (disc.status === 'fulfilled') setDiscrepancy(disc.value);
    } finally {
      setLoading(false);
    }
  }, [batchId, department]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxBucket = data
    ? Math.max(...data.score_distribution.map((b) => b.count), 1)
    : 1;

  return (
    <AdminLayout>
      <div className="fa-page">
        <div className="fa-header">
          <div className="fa-header-text">
            <h2>Phân Tích Giảng Viên &amp; Sinh Viên</h2>
            <p>Thống kê tiến độ đồ án tốt nghiệp, phân bổ điểm số, tải hướng dẫn và phát hiện lệch điểm</p>
          </div>
          <button onClick={fetchData} disabled={loading} className="fa-refresh-btn">
            {loading ? <><span className="m-spinner" aria-hidden="true" /> Đang tải...</> : 'Làm mới'}
          </button>
        </div>

        {/* Filters */}
        <div className="fa-filter-bar">
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="fa-select"
            aria-label="Lọc theo đợt đồ án"
          >
            <option value="">-- Tất cả đợt ĐATN --</option>
            {data?.available_batches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batch_code} — {b.batch_name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Lọc theo bộ môn..."
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="fa-input"
            aria-label="Lọc theo bộ môn"
          />
        </div>

        {error && <div className="fa-alert-error">{error}</div>}

        {loading && !data && <div className="fa-loading">Đang tải dữ liệu...</div>}

        {data && (
          <>
            {/* KPI Tiles */}
            <div className="fa-kpi-grid">
              <KPITile label="Tổng số đồ án" value={data.total_projects} />
              <KPITile
                label="Tỉ lệ đạt"
                value={data.pass_rate !== null ? `${data.pass_rate}%` : null}
                sub={`Đạt: ${data.status_counts['PASSED'] ?? 0} / Không đạt: ${data.status_counts['FAILED'] ?? 0}`}
                tone="success"
              />
              <KPITile
                label="Điểm trung bình"
                value={data.average_final_score ?? '—'}
                sub="Thang 10"
              />
              <KPITile
                label="Nhiệm vụ trễ hạn"
                value={data.tasks.overdue}
                sub={`Trên tổng ${data.tasks.total} nhiệm vụ`}
                tone={data.tasks.overdue > 0 ? 'danger' : 'default'}
              />
              <KPITile
                label="Nộp muộn"
                value={`${data.tasks.late_rate}%`}
                sub="Tỉ lệ nộp muộn"
                tone={data.tasks.late_rate > 20 ? 'warn' : 'default'}
              />
            </div>

            {/* Score Distribution & Status Breakdown */}
            <div className="fa-two-col">
              <div className="fa-card">
                <h3 className="fa-card-title">Phân bổ điểm (thang 10)</h3>
                <div className="fa-bar-list">
                  {data.score_distribution.map((bucket) => (
                    <CSSBar
                      key={bucket.range}
                      label={bucket.range}
                      count={bucket.count}
                      maxCount={maxBucket}
                    />
                  ))}
                </div>
                {data.score_distribution.every((b) => b.count === 0) && (
                  <div className="fa-empty">Chưa có dữ liệu điểm.</div>
                )}
              </div>

              <div className="fa-card">
                <h3 className="fa-card-title">Trạng thái đồ án</h3>
                {Object.keys(data.status_counts).length === 0 ? (
                  <div className="fa-empty">Chưa có đồ án.</div>
                ) : (
                  <div className="fa-status-list">
                    {Object.entries(data.status_counts).map(([statusCode, count]) => {
                      const tone = STATUS_TONE[statusCode] ?? 'neutral';
                      const badgeClass =
                        tone === 'neutral'
                          ? 'fa-status-badge'
                          : `fa-status-badge fa-status-badge--${tone}`;
                      return (
                        <div key={statusCode} className="fa-status-row">
                          <span className={badgeClass}>
                            {STATUS_LABELS[statusCode] ?? statusCode}
                          </span>
                          <span className="fa-status-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Supervisor Load Table */}
            <div className="fa-card">
              <h3 className="fa-card-title">Tải hướng dẫn của Giảng viên</h3>
              {data.supervisor_load.length === 0 ? (
                <div className="fa-empty">Chưa có dữ liệu.</div>
              ) : (
                <div className="fa-table-wrap">
                  <table className="m-stagger fa-table">
                    <thead>
                      <tr>
                        <th>Họ tên</th>
                        <th>Học vị</th>
                        <th>Bộ môn</th>
                        <th>Đã phân công</th>
                        <th>Hạn mức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.supervisor_load.map((row) => (
                        <tr key={row.supervisor_id}>
                          <td>{row.name || '—'}</td>
                          <td className="fa-td-muted">{row.academic_title || '—'}</td>
                          <td className="fa-td-muted">{row.department || '—'}</td>
                          <td className="fa-td-strong">{row.assigned}</td>
                          <td
                            className={
                              row.quota && row.assigned > row.quota
                                ? 'fa-quota-over'
                                : 'fa-quota-ok'
                            }
                          >
                            {row.quota ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Score Discrepancy Section */}
            <div className="fa-card">
              <div className="fa-card-header">
                <h3 className="fa-card-title">
                  Phát hiện lệch điểm ({discrepancy?.count ?? 0} trường hợp)
                </h3>
                <button
                  onClick={() => setShowDiscrepancy((v) => !v)}
                  className="fa-toggle-btn"
                >
                  {showDiscrepancy ? 'Ẩn' : 'Hiển thị'}
                </button>
              </div>
              {showDiscrepancy && discrepancy && discrepancy.results.length > 0 && (
                <div className="fa-table-wrap">
                  <table className="m-stagger fa-table fa-table--warn">
                    <thead>
                      <tr>
                        <th>MSSV</th>
                        <th>Đề tài</th>
                        <th>Đợt</th>
                        <th>Độ lệch</th>
                        <th>Nguồn điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discrepancy.results.map((item) => (
                        <tr key={item.project_id}>
                          <td className="fa-td-strong">{item.student_code}</td>
                          <td className="fa-topic-cell" title={item.topic_title_vi}>
                            {item.topic_title_vi}
                          </td>
                          <td>{item.batch_code}</td>
                          <td className="fa-spread-val">{item.spread}</td>
                          <td>
                            <div className="fa-score-pills">
                              {item.entries.map((e, i) => (
                                <span
                                  key={i}
                                  className={
                                    e.is_outlier
                                      ? 'fa-score-pill fa-score-pill--outlier'
                                      : 'fa-score-pill'
                                  }
                                >
                                  {SCORE_SOURCE_LABELS[e.source] ?? e.source}: {e.score_10}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {showDiscrepancy && discrepancy?.results.length === 0 && (
                <div className="fa-empty fa-empty--success">
                  Không phát hiện trường hợp lệch điểm đáng kể.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

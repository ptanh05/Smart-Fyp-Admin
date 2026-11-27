import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { DataRetentionPreview, DataRetentionApplyResult } from '../../types';
import './DataRetentionPage.css';

const CONFIRM_TOKEN = 'XAC_NHAN_XOA';

const DELETED_COUNT_LABELS: Record<string, string> = {
  batches: 'Số đợt đủ điều kiện',
  projects_in_scope: 'Số đồ án nằm trong phạm vi',
  deferral_evidence_files: 'Tệp minh chứng bảo lưu',
  weekly_report_files: 'Tệp báo cáo tuần',
  task_deliverable_files: 'Tệp sản phẩm nhiệm vụ',
  submission_versions: 'Phiên bản bài nộp',
  internship_info: 'Thông tin thực tập',
  student_preferences: 'Nguyện vọng GVHD',
};

const CountRow: React.FC<{ label: string; count: number; warn?: boolean }> = ({
  label,
  count,
  warn,
}) => {
  const valClass =
    count === 0
      ? 'dr-count-val dr-count-val--zero'
      : warn
        ? 'dr-count-val dr-count-val--warn'
        : 'dr-count-val';

  return (
    <div className="dr-count-row">
      <span className="dr-count-label">{label}</span>
      <span className={valClass}>{count}</span>
    </div>
  );
};

export const DataRetentionPage: React.FC = () => {
  const [yearsInput, setYearsInput] = useState('5');
  const [years, setYears] = useState(5);
  const [preview, setPreview] = useState<DataRetentionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<DataRetentionApplyResult | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showApplyPanel, setShowApplyPanel] = useState(false);

  const fetchPreview = useCallback(async (targetYears: number) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);
    try {
      const data = await featuresApi.getRetentionPreview(targetYears);
      setPreview(data);
    } catch {
      setError('Lỗi tải xem trước chính sách lưu giữ dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreview(5);
  }, [fetchPreview]);

  const handleCalculatePreview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = yearsInput.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      setError('Vui lòng nhập thời gian lưu giữ là số nguyên từ 1 đến 20 năm.');
      return;
    }
    setYears(parsed);
    fetchPreview(parsed);
  };

  const handleApply = async () => {
    if (confirmText !== CONFIRM_TOKEN) {
      setError(`Vui lòng nhập chính xác "${CONFIRM_TOKEN}" để xác nhận.`);
      return;
    }
    if (
      !window.confirm(
        'XÁC NHẬN: Thao tác này sẽ xóa vĩnh viễn dữ liệu và không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?'
      )
    ) {
      return;
    }
    setApplyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await featuresApi.applyRetention(years);
      setApplyResult(result);
      if (result.applied) {
        setSuccess(
          `Đã áp dụng chính sách lưu giữ dữ liệu thành công. Mốc thời gian: ${result.cutoff}`
        );
        setShowApplyPanel(false);
        setConfirmText('');
        fetchPreview(years);
      } else {
        setSuccess(result.detail || 'Không có dữ liệu nào cần xóa.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Lỗi áp dụng chính sách lưu giữ dữ liệu.');
    } finally {
      setApplyLoading(false);
    }
  };

  const hasData =
    preview && Object.values(preview.counts).some((v) => typeof v === 'number' && v > 0);

  return (
    <AdminLayout>
      <div className="dr-page">
        <div className="dr-header">
          <h2>Chính Sách Lưu Giữ Dữ Liệu</h2>
          <p>
            Theo Nghị định 13/2023/NĐ-CP: Xóa dữ liệu cá nhân không còn cần thiết của các đợt đã
            đóng quá số năm quy định. Giữ lại: hồ sơ đồ án, điểm số, bản lưu trữ chính thức. Xóa:
            tệp minh chứng bảo lưu, báo cáo tuần, tệp sản phẩm nhiệm vụ, phiên bản bài nộp (trừ bản
            lưu trữ), thông tin thực tập và nguyện vọng GVHD.
          </p>
        </div>

        {/* Years Selector */}
        <form className="dr-control-bar" onSubmit={handleCalculatePreview}>
          <label htmlFor="dr-years-input" className="dr-control-label">
            Thời gian lưu giữ (năm):
          </label>
          <input
            id="dr-years-input"
            type="number"
            min={1}
            max={20}
            value={yearsInput}
            onChange={(e) => setYearsInput(e.target.value)}
            className="dr-years-input"
            placeholder="1–20"
          />
          <button type="submit" disabled={loading} className="dr-primary-btn">
            {loading ? <><span className="m-spinner" aria-hidden="true" /> Đang tính...</> : 'Tính trước'}
          </button>
          <span className="dr-years-hint">Giá trị hợp lệ từ 1 đến 20 năm</span>
        </form>

        {error && <div className="dr-alert dr-alert--error">{error}</div>}
        {success && <div className="dr-alert dr-alert--success">{success}</div>}

        {preview && (
          <div className="dr-grid">
            {/* Summary */}
            <div className="dr-card">
              <h3 className="dr-card-title">Thống kê xem trước</h3>
              <div className="dr-cutoff-callout">
                Ngưỡng ngày: <strong>{preview.cutoff}</strong> ({preview.years ?? years} năm trước)
              </div>
              <div className="dr-count-list">
                <CountRow label="Số đợt đủ điều kiện" count={preview.counts.batches} warn />
                <CountRow label="Số đồ án nằm trong phạm vi" count={preview.counts.projects_in_scope} />
                <CountRow
                  label="Tệp minh chứng bảo lưu"
                  count={preview.counts.deferral_evidence_files}
                  warn={preview.counts.deferral_evidence_files > 0}
                />
                <CountRow
                  label="Tệp báo cáo tuần"
                  count={preview.counts.weekly_report_files}
                  warn={preview.counts.weekly_report_files > 0}
                />
                <CountRow
                  label="Tệp sản phẩm nhiệm vụ"
                  count={preview.counts.task_deliverable_files}
                  warn={preview.counts.task_deliverable_files > 0}
                />
                <CountRow
                  label="Phiên bản bài nộp (giữ lại bản cuối)"
                  count={preview.counts.submission_versions}
                  warn={preview.counts.submission_versions > 0}
                />
                <CountRow
                  label="Thông tin thực tập"
                  count={preview.counts.internship_info}
                  warn={preview.counts.internship_info > 0}
                />
                <CountRow
                  label="Nguyện vọng GVHD"
                  count={preview.counts.student_preferences}
                  warn={preview.counts.student_preferences > 0}
                />
              </div>
            </div>

            {/* Batch list */}
            <div className="dr-card">
              <h3 className="dr-card-title">
                Các đợt đủ điều kiện ({preview.batches.length})
              </h3>
              {preview.batches.length === 0 ? (
                <div className="dr-empty-ok">
                  Không có đợt nào cần xử lý với ngưỡng {preview.years ?? years} năm.
                </div>
              ) : (
                <div className="dr-batch-list">
                  {preview.batches.map((b) => (
                    <div key={b.id} className="dr-batch-item">
                      <span className="dr-batch-code">{b.batch_code}</span>
                      <span className="dr-batch-name">{b.batch_name}</span>
                      {b.end_date && (
                        <span className="dr-batch-date">Kết thúc: {b.end_date}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Apply Panel */}
        {preview && hasData && (
          <div className="dr-danger-card">
            <div className="dr-danger-header">
              <h3 className="dr-danger-title">
                Áp dụng chính sách (KHÔNG thể hoàn tác)
              </h3>
              <button
                type="button"
                onClick={() => setShowApplyPanel((v) => !v)}
                className="dr-danger-toggle"
              >
                {showApplyPanel ? 'Ẩn' : 'Hiển thị bảng xác nhận'}
              </button>
            </div>

            {showApplyPanel && (
              <div className="dr-confirm-body">
                <p className="dr-confirm-desc">
                  Nhập chính xác <strong>{CONFIRM_TOKEN}</strong> để xác nhận xóa dữ liệu:
                </p>
                <div className="dr-confirm-row">
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_TOKEN}
                    className={
                      confirmText === CONFIRM_TOKEN
                        ? 'dr-confirm-input dr-confirm-input--valid'
                        : 'dr-confirm-input'
                    }
                  />
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={applyLoading || confirmText !== CONFIRM_TOKEN}
                    className="dr-apply-btn"
                  >
                    {applyLoading ? <><span className="m-spinner" aria-hidden="true" /> Đang xử lý...</> : 'XÁC NHẬN XÓA DỮ LIỆU'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {preview && !hasData && (
          <div className="dr-clean-banner">
            Không có dữ liệu nào cần xử lý với ngưỡng {preview.years ?? years} năm.
          </div>
        )}

        {applyResult && applyResult.applied && applyResult.deleted_counts && (
          <div className="dr-result-card">
            <h4 className="dr-result-title">Kết quả xóa dữ liệu:</h4>
            <div className="dr-result-grid">
              {Object.entries(applyResult.deleted_counts).map(([key, value]) => (
                <div key={key} className="dr-result-row">
                  <span>{DELETED_COUNT_LABELS[key] ?? key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

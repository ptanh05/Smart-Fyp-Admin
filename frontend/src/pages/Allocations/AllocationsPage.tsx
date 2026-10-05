import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './AllocationsPage.css';

interface SupervisorQuota {
  id: number;
  supervisor: number;
  supervisor_id_code: string;
  supervisor_name: string;
  academic_title: string;
  phone_number: string;
  batch: number;
  department: string;
  base_quota?: number;
  rank_multiplier?: number;
  viet_anh_quota: number;
  general_cntt_quota: number;
  max_total_quota: number;
  current_assigned: number;
}

interface ProjectAdmin {
  id: number;
  student: number;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  education_program?: string;
  supervisor: number;
  supervisor_name: string;
  topic_title_vi: string;
  status: string;
  topic_review_status?: string;
}

export const AllocationsPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [quotas, setQuotas] = useState<SupervisorQuota[]>([]);
  const [projects, setProjects] = useState<ProjectAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [sendingEmails, setSendingEmails] = useState(false);

  // Manual Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStudent, setOverrideStudent] = useState<ProjectAdmin | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | ''>('');

  const fetchBatches = async () => {
    try {
      const res = await apiClient.get('/admin/batches/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      setBatches([]);
    }
  };

  const fetchData = async () => {
    if (!selectedBatchId) return;
    try {
      setLoading(true);
      const [quotaRes, projRes] = await Promise.all([
        apiClient.get(`/admin/quotas/?batch_id=${selectedBatchId}`),
        apiClient.get(`/admin/projects/?batch_id=${selectedBatchId}`),
      ]);
      setQuotas(Array.isArray(quotaRes.data) ? quotaRes.data : (quotaRes.data?.results || []));
      setProjects(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.results || []));
    } catch (err) {
      console.error(err);
      setQuotas([]);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchData();
    }
  }, [selectedBatchId]);

  const currentBatch = batches.find((b) => b.id === selectedBatchId);

  const handleRunMCMF = async () => {
    if (!selectedBatchId) return;
    const isEngineer = currentBatch?.program_type === 'ENGINEER';
    const confirmMsg = isEngineer
      ? 'Chạy tối ưu phân công tự động (MCMF Matching)?\nLưu ý: Hệ Kỹ sư sẽ kích hoạt ràng buộc cứng: chỉ phân công GVHD có học vị Tiến sĩ (TS) trở lên.'
      : 'Bạn có chắc chắn muốn chạy thuật toán phân GVHD tự động (MCMF Matching tối ưu NV1-NV3)?';

    if (!confirm(confirmMsg)) return;

    try {
      setMatching(true);
      setMatchResult(null);
      const res = await apiClient.post('/admin/allocations/auto-match/', {
        batch_id: selectedBatchId,
      });
      setMatchResult(res.data);
      fetchData();
    } catch (err: any) {
      alert('Lỗi chạy thuật toán: ' + (err.response?.data?.detail || err.message));
    } finally {
      setMatching(false);
    }
  };

  const handleFinalizeAllocation = async () => {
    if (!selectedBatchId) return;
    if (!confirm('Khoa xác nhận CHỐT phân công đợt đồ án này? Sau khi chốt, đề xuất sẽ được khóa để chuẩn bị công bố.')) return;

    try {
      const res = await apiClient.post('/admin/allocations/finalize/', { batch_id: selectedBatchId });
      alert(res.data?.message || 'Đã chốt phân công thành công!');
      fetchBatches();
      fetchData();
    } catch (err: any) {
      alert('Lỗi chốt phân công: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handlePublishAllocation = async () => {
    if (!selectedBatchId) return;
    if (!confirm('CÔNG BỐ & PHÁT THÔNG BÁO kết quả phân công cho toàn bộ Giảng viên và Sinh viên qua hệ thống?')) return;

    try {
      const res = await apiClient.post('/admin/allocations/publish/', { batch_id: selectedBatchId });
      alert(res.data?.message || 'Đã công bố và gửi thông báo thành công! Chuyển sang Giai đoạn 3.');
      fetchBatches();
      fetchData();
    } catch (err: any) {
      alert('Lỗi công bố: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenOverride = (proj: ProjectAdmin) => {
    setOverrideStudent(proj);
    setSelectedSupervisorId(proj.supervisor || '');
    setShowOverrideModal(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideStudent || !selectedSupervisorId || !selectedBatchId) return;

    try {
      await apiClient.patch('/admin/allocations/manual/', {
        student_id: overrideStudent.student,
        supervisor_id: Number(selectedSupervisorId),
        batch_id: selectedBatchId,
      });
      alert(`Đã override phân công thủ công cho SV ${overrideStudent.student_reg_no} thành công!`);
      setShowOverrideModal(false);
      setOverrideStudent(null);
      fetchData();
    } catch (err: any) {
      alert('Lỗi override: ' + (err.response?.data?.detail || err.message));
    }
  };

  const totalQuota = quotas.reduce((s, q) => s + (q.max_total_quota || 0), 0);
  const totalAssigned = quotas.reduce((s, q) => s + (q.current_assigned || 0), 0);

  return (
    <AdminLayout>
      <div className="utc-allocations-portal">
        {/* Header Bar */}
        <div className="utc-allocations-header-bar">
          <div className="utc-batch-select-group">
            <label>🎯 Đợt Đồ Án Tốt Nghiệp:</label>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="utc-batch-dropdown"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code} - {b.batch_name} ({b.program_type === 'ENGINEER' ? 'Kỹ Sư' : 'Cử Nhân'})
                </option>
              ))}
            </select>

            {currentBatch && (
              <span className={`utc-stage-badge ${currentBatch.current_stage === 'PHASE_2_LOCKED' ? 'stage-locked' : 'stage-progress'}`}>
                {currentBatch.current_stage === 'PHASE_2_LOCKED'
                  ? '🔒 Khoa Đã Chốt Phân Công'
                  : currentBatch.is_allocation_published
                  ? '📢 Đã Công Bố Kết Quả'
                  : '⏳ Đang Trong Quy Trình Phân Công'}
              </span>
            )}
          </div>

          <div className="utc-alloc-actions">
            <button
              onClick={handleRunMCMF}
              disabled={matching}
              className="utc-btn-gradient-green"
              title="Chạy giải thuật MCMF tối ưu NV1-NV3 và kiểm tra ràng buộc Kỹ sư"
            >
              <span>⚡</span> {matching ? 'Đang chạy tối ưu...' : 'Chạy Tối Ưu Phân Công (MCMF)'}
            </button>

            <button
              onClick={handleFinalizeAllocation}
              className="utc-btn-warning"
              title="Khoa chốt danh sách phân công (Bước 17)"
            >
              <span>🔒</span> Khoa Chốt Phân Công
            </button>

            <button
              onClick={handlePublishAllocation}
              className="utc-btn-primary"
              title="Công bố và gửi email kết quả cho SV & GV (Bước 18 & 19)"
            >
              <span>📢</span> Công Bố & Gửi Thông Báo
            </button>
            <button
              onClick={handleFinalizeAndNotify}
              disabled={sendingEmails || matching}
              className="utc-btn-primary"
              style={{ backgroundColor: '#059669' }}
            >
              <span>✉️</span> {sendingEmails ? 'Đang gửi Email...' : 'Chốt danh sách & Gửi Email SMTP'}
            </button>
          </div>
        </div>

        {/* Rule Indicator Alert */}
        {currentBatch?.program_type === 'ENGINEER' && (
          <div className="utc-rule-banner">
            <span>⚠️</span>
            <div>
              <strong>Quy chuẩn đào tạo Kỹ sư:</strong> Toàn bộ sinh viên thuộc đợt này bắt buộc chỉ được phân công cho Giảng viên có học vị tối thiểu là <strong>Tiến sĩ (TS, PGS.TS, GS.TS)</strong>. Các giảng viên học vị Thạc sĩ sẽ tự động bị loại khỏi danh sách ghép nối.
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="utc-metrics-strip">
          <div className="utc-metric-card">
            <span className="utc-metric-title">Tổng Chỉ Tiêu Capacity</span>
            <span className="utc-metric-num">{totalQuota}</span>
            <span className="utc-metric-sub">Tính theo hệ số học vị GV</span>
          </div>
          <div className="utc-metric-card">
            <span className="utc-metric-title">Đã Phân Công</span>
            <span className="utc-metric-num text-emerald">{totalAssigned}</span>
            <span className="utc-metric-sub">Sinh viên đã có GVHD</span>
          </div>
          <div className="utc-metric-card">
            <span className="utc-metric-title">Chỉ Tiêu Còn Lại</span>
            <span className="utc-metric-num text-blue">{Math.max(0, totalQuota - totalAssigned)}</span>
            <span className="utc-metric-sub">Chỗ trống tiếp nhận đồ án</span>
          </div>
          <div className="utc-metric-card">
            <span className="utc-metric-title">Tổng Số Giảng Viên</span>
            <span className="utc-metric-num text-purple">{quotas.length}</span>
            <span className="utc-metric-sub">Cán bộ tham gia đợt này</span>
          </div>
        </div>

        {/* Matching Result Alert */}
        {matchResult && (
          <div className="utc-match-feedback">
            <div className="utc-match-feedback-header">
              <h4>🎉 Kết Quả Đề Xuất Phân Công Tối Ưu:</h4>
              <span>
                Ghép thành công: <strong>{matchResult.matched_count}</strong> | Chưa phân: <strong>{matchResult.unassigned_count}</strong>
              </span>
            </div>
            {matchResult.unassigned && matchResult.unassigned.length > 0 && (
              <div className="utc-unassigned-warning">
                <strong>Sinh viên chưa được phân:</strong>
                <ul>
                  {matchResult.unassigned.map((u: any, idx: number) => (
                    <li key={idx}>
                      {u.student_name} ({u.registration_no}) - Lý do: {u.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Main Content: Projects & Quotas */}
        <div className="utc-allocations-split">
          {/* Projects Table */}
          <div className="utc-panel-card">
            <div className="utc-panel-head">
              <h4>📋 Danh Sách Phân Công Sinh Viên & Đề Tài ({projects.length})</h4>
              <span className="text-muted">Khoa có thể Review & Override chỉnh sửa thủ công</span>
            </div>

            {loading ? (
              <div className="utc-loading-text">Đang tải dữ liệu...</div>
            ) : projects.length === 0 ? (
              <div className="utc-empty-text">Chưa có sinh viên nào trong đợt này.</div>
            ) : (
              <div className="utc-table-container">
                <table className="utc-custom-table">
                  <thead>
                    <tr>
                      <th>MSSV</th>
                      <th>Sinh Viên</th>
                      <th>Hệ ĐT</th>
                      <th>GV Hướng Dẫn</th>
                      <th>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((proj) => (
                      <tr key={proj.id}>
                        <td className="font-bold">{proj.student_reg_no}</td>
                        <td>{proj.student_name}</td>
                        <td>
                          <span className={`utc-tag-edu ${proj.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                            {proj.education_program === 'ENGINEER' ? '⚙️ Kỹ sư' : '🎓 Cử nhân'}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold text-slate-800">{proj.supervisor_name}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleOpenOverride(proj)}
                            className="utc-btn-override"
                            title="Chỉnh sửa / Override phân công cho SV này"
                          >
                            ✏️ Override
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Supervisors Quotas Table */}
          <div className="utc-panel-card">
            <div className="utc-panel-head">
              <h4>👨‍🏫 Định Mức & Capacity Giảng Viên ({quotas.length})</h4>
              <span className="text-muted">Tự động tính theo hệ số học vị</span>
            </div>

            {loading ? (
              <div className="utc-loading-text">Đang tải danh sách định mức...</div>
            ) : quotas.length === 0 ? (
              <div className="utc-empty-text">Chưa thiết lập Quota cho đợt này.</div>
            ) : (
              <div className="utc-table-container">
                <table className="utc-custom-table">
                  <thead>
                    <tr>
                      <th>Giảng Viên</th>
                      <th>Học Vị</th>
                      <th>Hệ Số</th>
                      <th>Tối Đa</th>
                      <th>Đã Gán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotas.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <div className="font-semibold">{q.supervisor_name}</div>
                          <div className="text-xs text-muted">{q.department || 'Khoa CNTT'}</div>
                        </td>
                        <td>
                          <span className="utc-academic-tag">{q.academic_title || 'ThS'}</span>
                        </td>
                        <td className="text-center font-bold text-slate-600">x{q.rank_multiplier || 1.0}</td>
                        <td className="text-center font-bold text-blue-600">{q.max_total_quota}</td>
                        <td className="text-center font-bold text-emerald-600">
                          {q.current_assigned} / {q.max_total_quota}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: MANUAL OVERRIDE */}
        {showOverrideModal && overrideStudent && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>✏️ Khoa Override / Điều Chỉnh Thủ Công GVHD</h4>
                <button onClick={() => setShowOverrideModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleSaveOverride}>
                <div className="utc-override-info">
                  <p>Sinh viên: <strong>{overrideStudent.student_name}</strong> (MSSV: {overrideStudent.student_reg_no})</p>
                  <p>Chương trình: <strong>{overrideStudent.education_program === 'ENGINEER' ? 'Kỹ sư (Yêu cầu GVHD tối thiểu TS)' : 'Cử nhân'}</strong></p>
                  <p>GVHD hiện tại: <strong>{overrideStudent.supervisor_name}</strong></p>
                </div>

                <div className="utc-form-group">
                  <label>Chọn Giảng Viên Hướng Dẫn Mới (Override):</label>
                  <select
                    className="utc-input"
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(Number(e.target.value))}
                    required
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {quotas.map((q) => (
                      <option key={q.supervisor} value={q.supervisor}>
                        {q.supervisor_name} ({q.academic_title || 'ThS'}) - Còn trống: {Math.max(0, q.max_total_quota - q.current_assigned)} chỗ
                      </option>
                    ))}
                  </select>
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowOverrideModal(false)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Xác Nhận Override</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

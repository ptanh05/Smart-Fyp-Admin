import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import { formatFullName } from '../../utils/nameHelper';
import './EligibilityPage.css';

interface ProjectEligibility {
  id: number;
  student?: number | null;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  education_program: string;
  supervisor_name: string;
  topic_title_vi: string;
  initial_eligibility: 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE' | 'FORCE_APPROVED' | 'DISQUALIFIED';
  ineligibility_reason: string;
  gpa_score: number | null;
  debt_credits: number;
}

export const EligibilityPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Force Approve Modal
  const [forceProject, setForceProject] = useState<ProjectEligibility | null>(null);
  const [forceReason, setForceReason] = useState('');
  const [submittingForce, setSubmittingForce] = useState(false);

  // Manual Academic Edit Modal
  const [editProject, setEditProject] = useState<ProjectEligibility | null>(null);
  const [editGpa, setEditGpa] = useState<string>('');
  const [editDebtCredits, setEditDebtCredits] = useState<string>('0');
  const [editEligibility, setEditEligibility] = useState<string>('AUTO');
  const [editReason, setEditReason] = useState<string>('');
  const [savingAcademic, setSavingAcademic] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchBatches = async () => {
    try {
      const res = await apiClient.get('/admin/batches/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBatches(list);
      const savedId = localStorage.getItem('utc_selected_batch_id');
      const found = savedId ? list.find((b: any) => b.id === Number(savedId)) : null;
      if (found) {
        setSelectedBatchId(found.id);
      } else if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      setBatches([]);
    }
  };

  const fetchProjects = async () => {
    if (!selectedBatchId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/projects/?batch_id=${selectedBatchId}`);
      setProjects(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error(err);
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
      fetchProjects();
    }
  }, [selectedBatchId]);

  const handleImportEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedBatchId) return;

    try {
      setImporting(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('batch_id', selectedBatchId.toString());

      const res = await apiClient.post('/admin/eligibility/import-excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      fetchProjects();
    } catch (err: any) {
      setToast({ type: 'error', message: 'Lỗi import: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setImporting(false);
    }
  };

  const getInitialIneligibilityReason = (proj: ProjectEligibility) => {
    if (proj.ineligibility_reason && proj.ineligibility_reason.trim()) {
      return proj.ineligibility_reason;
    }
    if (proj.debt_credits && proj.debt_credits >= 10) {
      return `Nợ ${proj.debt_credits} tín chỉ (vượt giới hạn quy định tối đa < 10 TC)`;
    }
    if (proj.gpa_score !== null && proj.gpa_score !== undefined && proj.gpa_score < 2.0) {
      return `Điểm CPA ${proj.gpa_score} (dưới ngưỡng 2.0 quy định)`;
    }
    if (proj.initial_eligibility === 'INELIGIBLE') {
      return 'Không đủ điều kiện học vụ theo danh sách rà soát';
    }
    return 'Chưa có ghi chú vi phạm cụ thể (Cần phê duyệt đặc cách theo đơn giải trình)';
  };

  const openForceApproveModal = (p: ProjectEligibility) => {
    setForceProject(p);
    const defaultNote = p.debt_credits && p.debt_credits >= 10
      ? `Khoa đặc cách: Cho phép SV nợ ${p.debt_credits} TC làm đồ án có điều kiện, cam kết trả nợ trước lễ bảo vệ.`
      : (p.gpa_score !== null && p.gpa_score !== undefined && p.gpa_score < 2.0
          ? `Khoa đặc cách: Chấp thuận đơn giải trình nâng điểm của SV (CPA ${p.gpa_score}).`
          : (p.ineligibility_reason ? `Đặc cách: ${p.ineligibility_reason}` : 'Khoa phê duyệt đặc cách theo đơn giải trình và quyết định của Hội đồng.'));
    setForceReason(defaultNote);
  };

  const handleForceApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forceProject || submittingForce) return;

    try {
      setSubmittingForce(true);
      const targetId = forceProject.id > 0
        ? forceProject.id
        : (forceProject.student || Math.abs(forceProject.id));

      await apiClient.post(`/admin/projects/${targetId}/force-approve/`, {
        decision: 'FORCE_APPROVE',
        reason: forceReason.trim() || 'Khoa phê duyệt đặc cách theo đơn giải trình',
      });
      setToast({
        type: 'success',
        message: `Đã Force Approve đặc cách thành công cho SV ${formatFullName(forceProject.student_name)} (${forceProject.student_reg_no})!`,
      });
      setForceProject(null);
      setForceReason('');
      fetchProjects();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: 'Lỗi đặc cách: ' + (err.response?.data?.detail || err.message),
      });
    } finally {
      setSubmittingForce(false);
    }
  };

  const handleBulkForceApproveIneligible = async () => {
    const ineligibles = projects.filter((p) => p.initial_eligibility === 'INELIGIBLE');
    if (ineligibles.length === 0) {
      setToast({ type: 'info', message: 'Không có sinh viên nào ở trạng thái Không đủ điều kiện.' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn Force Approve đặc cách cho toàn bộ ${ineligibles.length} sinh viên không đủ điều kiện được làm đồ án tốt nghiệp?`)) {
      return;
    }
    try {
      setSubmittingForce(true);
      for (const p of ineligibles) {
        const targetId = p.id > 0 ? p.id : (p.student || Math.abs(p.id));
        await apiClient.post(`/admin/projects/${targetId}/force-approve/`, {
          decision: 'FORCE_APPROVE',
          reason: 'Khoa phê duyệt đặc cách tập trung cho đợt đồ án',
        });
      }
      setToast({
        type: 'success',
        message: `Đã Force Approve thành công cho toàn bộ ${ineligibles.length} sinh viên!`,
      });
      fetchProjects();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: 'Lỗi: ' + (err.response?.data?.detail || err.message),
      });
    } finally {
      setSubmittingForce(false);
    }
  };

  const handleDisqualify = async (projId: number, regNo: string) => {
    const reason = prompt('Nhập lý do loại sinh viên này khỏi đợt đồ án:', 'Không đủ điều kiện học vụ theo quy định');
    if (reason === null) return;

    try {
      const targetId = projId > 0 ? projId : Math.abs(projId);
      await apiClient.patch(`/admin/projects/${targetId}/eligibility-decision/`, {
        decision: 'DISQUALIFY',
        reason: reason.trim(),
      });
      setToast({ type: 'info', message: `Đã loại sinh viên ${regNo} khỏi đợt đồ án.` });
      fetchProjects();
    } catch (err: any) {
      setToast({ type: 'error', message: 'Lỗi: ' + (err.response?.data?.detail || err.message) });
    }
  };

  const openAcademicEditModal = (p: ProjectEligibility) => {
    setEditProject(p);
    setEditGpa(p.gpa_score !== null && p.gpa_score !== undefined ? String(p.gpa_score) : '');
    setEditDebtCredits(String(p.debt_credits ?? 0));
    setEditEligibility('AUTO');
    setEditReason(p.ineligibility_reason || '');
  };

  const handleSaveAcademicEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject || savingAcademic) return;
    try {
      setSavingAcademic(true);
      const targetId = editProject.id > 0 ? editProject.id : (editProject.student || Math.abs(editProject.id));
      const payload: any = {
        batch_id: selectedBatchId,
        debt_credits: Number(editDebtCredits || 0),
        ineligibility_reason: editReason.trim(),
        auto_evaluate: editEligibility === 'AUTO',
      };
      if (editGpa.trim() !== '') {
        payload.gpa_score = Number(editGpa);
      }
      if (editEligibility !== 'AUTO') {
        payload.initial_eligibility = editEligibility;
      }
      await apiClient.patch(`/admin/projects/${targetId}/academic-record/`, payload);
      setToast({
        type: 'success',
        message: `Đã cập nhật điểm học vụ cho SV ${formatFullName(editProject.student_name)} (${editProject.student_reg_no}).`,
      });
      setEditProject(null);
      fetchProjects();
    } catch (err: any) {
      setToast({ type: 'error', message: 'Lỗi cập nhật học vụ: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setSavingAcademic(false);
    }
  };

  const studentProjects = projects.filter((p) => p.student !== null && p.student !== undefined);

  const filtered = studentProjects.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.initial_eligibility === filterStatus;
  });

  const countEligible = studentProjects.filter((p) => p.initial_eligibility === 'ELIGIBLE').length;
  const countIneligible = studentProjects.filter((p) => p.initial_eligibility === 'INELIGIBLE').length;
  const countForceApproved = studentProjects.filter((p) => p.initial_eligibility === 'FORCE_APPROVED').length;
  const countDisqualified = studentProjects.filter((p) => p.initial_eligibility === 'DISQUALIFIED').length;

  return (
    <AdminLayout>
      <div className="utc-eligibility-portal">
        {/* Header Bar */}
        <div className="utc-eligibility-header-bar">
          <div className="utc-eligibility-header-info">
            <h3>Giai Đoạn 4: Xét Điều Kiện Làm Đồ Án & Force Approve (Bước 26 & 27)</h3>
            <p>Rà soát điều kiện học vụ: Sinh viên đủ điều kiện làm đồ án hoặc Khoa quyết định Force Approve / Loại khỏi đợt</p>
          </div>

          <div className="utc-header-actions">
            <select
              value={selectedBatchId || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedBatchId(val);
                localStorage.setItem('utc_selected_batch_id', String(val));
              }}
              className="utc-batch-dropdown"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code} - {b.batch_name}
                </option>
              ))}
            </select>

            <button onClick={() => setShowImportModal(true)} className="utc-btn-emerald">
              <span>📊</span> Import Điểm Xét ĐK (Excel)
            </button>

            {countIneligible > 0 && (
              <button
                onClick={handleBulkForceApproveIneligible}
                className="utc-btn-force-bulk"
                title="Đặc cách cho tất cả sinh viên không đủ điều kiện trong đợt"
              >
                <span>⭐</span> Force Approve Tất Cả ({countIneligible})
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="utc-elig-metrics-grid">
          <div
            className={`utc-elig-card ${filterStatus === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ALL')}
          >
            <span className="card-label">Tổng Sinh Viên</span>
            <span className="card-num">{studentProjects.length}</span>
            <span className="card-sub">Toàn bộ sinh viên trong đợt</span>
          </div>

          <div
            className={`utc-elig-card ${filterStatus === 'ELIGIBLE' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ELIGIBLE')}
          >
            <span className="card-label">Đủ Điều Kiện Làm ĐA</span>
            <span className="card-num text-emerald">{countEligible}</span>
            <span className="card-sub">Đi tiếp đến GĐ5 (Thực hiện)</span>
          </div>

          <div
            className={`utc-elig-card ${filterStatus === 'INELIGIBLE' ? 'active' : ''}`}
            onClick={() => setFilterStatus('INELIGIBLE')}
          >
            <span className="card-label">Không Đủ Điều Kiện</span>
            <span className="card-num text-amber">{countIneligible}</span>
            <span className="card-sub">Chờ Khoa xét Force Approve</span>
          </div>

          <div
            className={`utc-elig-card ${filterStatus === 'FORCE_APPROVED' ? 'active' : ''}`}
            onClick={() => setFilterStatus('FORCE_APPROVED')}
          >
            <span className="card-label">Đã Đặc Cách (Force Approve)</span>
            <span className="card-num text-blue">{countForceApproved}</span>
            <span className="card-sub">Khoa đã cho phép làm đồ án</span>
          </div>

          <div
            className={`utc-elig-card ${filterStatus === 'DISQUALIFIED' ? 'active' : ''}`}
            onClick={() => setFilterStatus('DISQUALIFIED')}
          >
            <span className="card-label">Bị Loại Khỏi Đợt</span>
            <span className="card-num text-red">{countDisqualified}</span>
            <span className="card-sub">Không được làm đồ án</span>
          </div>
        </div>

        {/* Projects Table */}
        <div className="utc-elig-table-card">
          <div className="utc-elig-table-head">
            <h4>Danh Sách Xét Duyệt Điều Kiện ({filtered.length})</h4>
            <span className="text-muted">Nhấn "Force Approve" để đặc cách hoặc "Loại Khỏi Đợt"</span>
          </div>

          {loading ? (
            <div className="utc-loading-text">Đang tải danh sách...</div>
          ) : filtered.length === 0 ? (
            <div className="utc-empty-text">Chưa có dữ liệu xét duyệt. Hãy nhấn Import Excel.</div>
          ) : (
            <div className="utc-table-container">
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th>MSSV</th>
                    <th>Sinh Viên</th>
                    <th>Hệ ĐT</th>
                    <th>GPA</th>
                    <th>Nợ Tín Chỉ</th>
                    <th>Kết Luận Điều Kiện</th>
                    <th>Lý Do / Ghi Chú</th>
                    <th>Quyết Định Của Khoa</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.student_reg_no}</td>
                      <td>
                        <div className="font-semibold">{formatFullName(p.student_name)}</div>
                        <div className="text-xs text-muted">{p.student_class}</div>
                      </td>
                      <td>
                        <span className={`utc-tag-edu ${p.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                          {p.education_program === 'ENGINEER' ? '⚙️ Kỹ sư' : '🎓 Cử nhân'}
                        </span>
                      </td>
                      <td className="font-bold text-center">{p.gpa_score !== null ? p.gpa_score : '—'}</td>
                      <td className="text-center font-bold text-red-600">{p.debt_credits || 0}</td>
                      <td>
                        <span className={`utc-elig-pill pill-${(p.initial_eligibility || 'pending').toLowerCase()}`}>
                          {p.initial_eligibility === 'ELIGIBLE'
                            ? '✅ Đủ Điều Kiện'
                            : p.initial_eligibility === 'FORCE_APPROVED'
                            ? '⭐ Đặc Cách (Force Approve)'
                            : p.initial_eligibility === 'DISQUALIFIED'
                            ? '🚫 Bị Loại Khỏi Đợt'
                            : p.initial_eligibility === 'INELIGIBLE'
                            ? '⚠️ Không Đủ Điều Kiện'
                            : '⏳ Chưa Xét'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '250px' }}>
                        <span className="text-sm text-slate-700">{p.ineligibility_reason || '—'}</span>
                      </td>
                      <td>
                        <div className="utc-action-btn-group">
                          {p.initial_eligibility !== 'ELIGIBLE' && p.initial_eligibility !== 'FORCE_APPROVED' && (
                            <>
                              <button
                                onClick={() => openForceApproveModal(p)}
                                className="utc-btn-sm-force"
                                data-testid="force-approve-btn"
                                title="Cho phép đặc cách làm đồ án (Force Approve)"
                              >
                                ⭐ Force Approve
                              </button>
                              {p.initial_eligibility !== 'DISQUALIFIED' && (
                                <button
                                  onClick={() => handleDisqualify(p.id, p.student_reg_no)}
                                  className="utc-btn-sm-disqualify"
                                  title="Loại sinh viên khỏi đợt đồ án"
                                >
                                  ✕ Loại
                                </button>
                              )}
                            </>
                          )}
                          {p.initial_eligibility === 'ELIGIBLE' && (
                            <span className="text-xs text-emerald-600 font-bold">✅ Đủ ĐK (GĐ5)</span>
                          )}
                          {p.initial_eligibility === 'FORCE_APPROVED' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="text-xs text-blue-600 font-bold">⭐ Đã đặc cách (GĐ5)</span>
                              <button
                                onClick={() => openForceApproveModal(p)}
                                className="utc-btn-sm-subtle"
                                title="Cập nhật thông tin đặc cách"
                              >
                                Sửa
                              </button>
                            </div>
                          )}
                          {p.initial_eligibility === 'DISQUALIFIED' && (
                            <span className="text-xs text-red-600 font-bold">🚫 Đã loại</span>
                          )}
                          <button
                            onClick={() => openAcademicEditModal(p)}
                            className="utc-btn-sm-subtle"
                            title="Sửa thủ công CPA/GPA, tín chỉ nợ và điều kiện"
                          >
                            ✏️ Sửa học vụ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL 1: IMPORT EXCEL */}
        {showImportModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>📊 Import Điểm Tích Lũy & Xét Điều Kiện Làm ĐATN</h4>
                <button onClick={() => setShowImportModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleImportEligibility}>
                <div className="utc-form-group">
                  <label>Chọn File Excel Điểm Tích Lũy:</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    required
                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                    className="utc-input"
                  />
                  <small style={{ color: '#64748b', display: 'block', marginTop: '0.4rem' }}>
                    File Excel chứa các cột: MSSV, Điểm tích lũy (GPA), Số tín chỉ nợ, Kết luận điều kiện.
                  </small>
                </div>

                {importResult && (
                  <div className="utc-alert-box">
                    <strong>Kết quả rà soát:</strong>
                    <div>Đã xử lý: {importResult.total_processed} sinh viên</div>
                    <div style={{ color: '#059669' }}>Đủ điều kiện: {importResult.eligible_count}</div>
                    <div style={{ color: '#d97706' }}>Không đủ điều kiện: {importResult.ineligible_count}</div>
                  </div>
                )}

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowImportModal(false)} className="utc-btn-cancel">Đóng</button>
                  <button type="submit" disabled={importing} className="utc-btn-emerald">
                    {importing ? 'Đang phân tích...' : 'Bắt Đầu Import & Xét Duyệt'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: FORCE APPROVE */}
        {forceProject && (
          <div className="utc-modal-backdrop" onClick={() => !submittingForce && setForceProject(null)}>
            <div className="utc-modal-card force-approve-modal" onClick={(e) => e.stopPropagation()}>
              <div className="utc-modal-head">
                <h4>⭐ Quyết Định Force Approve (Đặc Cách Cho Làm Đồ Án)</h4>
                <button
                  type="button"
                  disabled={submittingForce}
                  onClick={() => setForceProject(null)}
                  className="utc-btn-close"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleForceApproveSubmit}>
                <div className="utc-student-highlight-box">
                  <div className="utc-sh-row">
                    <span className="utc-sh-label">Sinh viên:</span>
                    <strong className="utc-sh-val">{formatFullName(forceProject.student_name)}</strong>
                    <span className="utc-badge-reg">MSSV: {forceProject.student_reg_no}</span>
                    {forceProject.student_class && (
                      <span className="utc-badge-class">Lớp: {forceProject.student_class}</span>
                    )}
                  </div>
                  <div className="utc-sh-metrics">
                    <div className="utc-sh-metric">
                      <span className="utc-metric-lbl">Điểm CPA tích lũy:</span>
                      <strong className={`utc-metric-val ${forceProject.gpa_score !== null && forceProject.gpa_score < 2.0 ? 'text-red' : 'text-emerald'}`}>
                        {forceProject.gpa_score !== null && forceProject.gpa_score !== undefined ? forceProject.gpa_score : 'Chưa cập nhật'}
                      </strong>
                    </div>
                    <div className="utc-sh-metric">
                      <span className="utc-metric-lbl">Tín chỉ nợ:</span>
                      <strong className={`utc-metric-val ${forceProject.debt_credits >= 10 ? 'text-red' : 'text-emerald'}`}>
                        {forceProject.debt_credits || 0} TC
                      </strong>
                    </div>
                  </div>
                  <div className="utc-sh-reason">
                    <span className="utc-sh-label">Lý do không đạt ban đầu:</span>
                    <span className="utc-reason-text font-bold text-red">
                      {getInitialIneligibilityReason(forceProject)}
                    </span>
                  </div>
                </div>

                <div className="utc-form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="forceReasonInput">Lý do Khoa chấp thuận đặc cách (Lưu hồ sơ kiểm toán):</label>
                  <textarea
                    id="forceReasonInput"
                    rows={4}
                    required
                    disabled={submittingForce}
                    placeholder="VD: Sinh viên đã có đơn cam kết trả nợ học phần trong kỳ phụ; Đã được phê duyệt giải trình đặc cách..."
                    value={forceReason}
                    onChange={(e) => setForceReason(e.target.value)}
                    className="utc-input"
                  />
                </div>

                <div className="utc-modal-foot">
                  <button
                    type="button"
                    disabled={submittingForce}
                    onClick={() => setForceProject(null)}
                    className="utc-btn-cancel"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submittingForce}
                    className="utc-btn-primary"
                  >
                    {submittingForce ? 'Đang xử lý Force Approve...' : 'Xác Nhận Force Approve'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: MANUAL ACADEMIC RECORD EDIT */}
        {editProject && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card utc-modal-force">
              <div className="utc-modal-head">
                <h4>✏️ Chỉnh Sửa Điểm Tích Lũy & Điều Kiện Học Vụ</h4>
                <button onClick={() => setEditProject(null)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleSaveAcademicEdit}>
                <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#334155' }}>
                  Sinh viên: <strong>{formatFullName(editProject.student_name)}</strong> ({editProject.student_reg_no})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="utc-form-group">
                    <label>Điểm tích lũy (CPA / hệ 4.0):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="4"
                      value={editGpa}
                      onChange={(e) => setEditGpa(e.target.value)}
                      placeholder="VD: 2.85"
                      className="utc-input"
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Số tín chỉ nợ:</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      required
                      value={editDebtCredits}
                      onChange={(e) => setEditDebtCredits(e.target.value)}
                      className="utc-input"
                    />
                  </div>
                </div>
                <div className="utc-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Kết luận điều kiện:</label>
                  <select
                    value={editEligibility}
                    onChange={(e) => setEditEligibility(e.target.value)}
                    className="utc-input"
                  >
                    <option value="AUTO">Tự động xét theo quy chế (Nợ &lt; 10 TC → Đủ ĐK)</option>
                    <option value="ELIGIBLE">✅ Đủ Điều Kiện (ELIGIBLE)</option>
                    <option value="INELIGIBLE">⚠️ Không Đủ Điều Kiện (INELIGIBLE)</option>
                    <option value="FORCE_APPROVED">⭐ Đặc Cách (FORCE_APPROVED)</option>
                    <option value="DISQUALIFIED">🚫 Loại khỏi đợt (DISQUALIFIED)</option>
                  </select>
                </div>
                <div className="utc-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Ghi chú / Lý do học vụ:</label>
                  <textarea
                    rows={3}
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Ghi chú rà soát học vụ..."
                    className="utc-input"
                  />
                </div>
                <div className="utc-modal-foot">
                  <button type="button" disabled={savingAcademic} onClick={() => setEditProject(null)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" disabled={savingAcademic} className="utc-btn-primary">
                    {savingAcademic ? 'Đang lưu...' : '💾 Lưu Điều Chỉnh'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION CONTAINER */}
        {toast && (
          <div className="utc-toast-container">
            <div className={`utc-toast-item ${toast.type}`}>
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="utc-toast-close"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

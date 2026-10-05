import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './EligibilityPage.css';

interface ProjectEligibility {
  id: number;
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
      alert('Lỗi import: ' + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };

  const handleForceApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forceProject) return;

    try {
      await apiClient.patch(`/admin/projects/${forceProject.id}/eligibility-decision/`, {
        decision: 'FORCE_APPROVE',
        reason: forceReason.trim() || 'Khoa phê duyệt đặc cách theo đơn giải trình',
      });
      alert(`Đã Force Approve đặc cách cho SV ${forceProject.student_reg_no} làm đồ án!`);
      setForceProject(null);
      setForceReason('');
      fetchProjects();
    } catch (err: any) {
      alert('Lỗi đặc cách: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDisqualify = async (projId: number, regNo: string) => {
    const reason = prompt('Nhập lý do loại sinh viên này khỏi đợt đồ án:', 'Không đủ điều kiện học vụ theo quy định');
    if (reason === null) return;

    try {
      await apiClient.patch(`/admin/projects/${projId}/eligibility-decision/`, {
        decision: 'DISQUALIFY',
        reason: reason.trim(),
      });
      alert(`Đã loại sinh viên ${regNo} khỏi đợt đồ án.`);
      fetchProjects();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const filtered = projects.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.initial_eligibility === filterStatus;
  });

  const countEligible = projects.filter((p) => p.initial_eligibility === 'ELIGIBLE').length;
  const countIneligible = projects.filter((p) => p.initial_eligibility === 'INELIGIBLE').length;
  const countForceApproved = projects.filter((p) => p.initial_eligibility === 'FORCE_APPROVED').length;
  const countDisqualified = projects.filter((p) => p.initial_eligibility === 'DISQUALIFIED').length;

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
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
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
          </div>
        </div>

        {/* Metric Cards */}
        <div className="utc-elig-metrics-grid">
          <div
            className={`utc-elig-card ${filterStatus === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ALL')}
          >
            <span className="card-label">Tổng Sinh Viên</span>
            <span className="card-num">{projects.length}</span>
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
                        <div className="font-semibold">{p.student_name}</div>
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
                          {p.initial_eligibility === 'INELIGIBLE' && (
                            <>
                              <button
                                onClick={() => setForceProject(p)}
                                className="utc-btn-sm-force"
                                title="Cho phép đặc cách làm đồ án"
                              >
                                ⭐ Force Approve
                              </button>
                              <button
                                onClick={() => handleDisqualify(p.id, p.student_reg_no)}
                                className="utc-btn-sm-disqualify"
                                title="Loại sinh viên khỏi đợt đồ án"
                              >
                                ✕ Loại
                              </button>
                            </>
                          )}
                          {p.initial_eligibility === 'ELIGIBLE' && (
                            <span className="text-xs text-emerald-600 font-bold">Đã vào GĐ5</span>
                          )}
                          {p.initial_eligibility === 'FORCE_APPROVED' && (
                            <span className="text-xs text-blue-600 font-bold">Đặc cách (GĐ5)</span>
                          )}
                          {p.initial_eligibility === 'DISQUALIFIED' && (
                            <span className="text-xs text-red-600 font-bold">Đã loại</span>
                          )}
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
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>⭐ Quyết Định Force Approve (Đặc Cách Cho Làm Đồ Án)</h4>
                <button onClick={() => setForceProject(null)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleForceApproveSubmit}>
                <div className="utc-form-group">
                  <p>Sinh viên: <strong>{forceProject.student_name}</strong> ({forceProject.student_reg_no})</p>
                  <p>Lý do không đạt ban đầu: <span className="text-red font-bold">{forceProject.ineligibility_reason}</span></p>
                </div>

                <div className="utc-form-group">
                  <label>Lý do Khoa chấp thuận đặc cách (Lưu hồ sơ kiểm toán):</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="VD: Sinh viên đã có đơn cam kết trả nợ học phần trong kỳ phụ; Đã được phê duyệt giải trình đặc cách..."
                    value={forceReason}
                    onChange={(e) => setForceReason(e.target.value)}
                    className="utc-input"
                  />
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setForceProject(null)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Xác Nhận Force Approve</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

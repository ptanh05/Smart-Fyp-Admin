import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import { formatFullName } from '../../utils/nameHelper';
import './DefenseManagementPage.css';

interface ProjectAdmin {
  id: number;
  student: number;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  education_program?: string;
  supervisor_name: string;
  reviewer_name: string;
  council: number | null;
  council_name: string;
  topic_title_vi: string;
  status: string;
  supervisor_defense_confirmed?: boolean;
  final_academic_eligibility?: string;
  final_academic_notes?: string;
  deferral_status?: string;
  deferral_reason?: string;
  supervisor_score: number | null;
  reviewer_score: number | null;
  final_score_10: number | null;
  final_score_4: number | null;
  final_letter_grade: string;
  is_passed: boolean;
}

interface ActionNotice {
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  details?: string[];
}

const formatMissingStudentItem = (item: any): string => {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return String(item);
  const regNo = item.student_reg_no || item.registration_no || item.mssv || '';
  const name = item.student_name || item.full_name || item.name || '';
  const missing = Array.isArray(item.missing_fields)
    ? item.missing_fields.join(', ')
    : item.missing || item.reason || item.detail || '';
  const label = [regNo, name].filter(Boolean).join(' - ');
  if (label && missing) return `${label}: ${missing}`;
  return label || missing || JSON.stringify(item);
};

const extractApiErrorDetails = (data: any, fallback: string): { message: string; details: string[] } => {
  if (!data || typeof data !== 'object') {
    return { message: typeof data === 'string' && data.trim() ? data : fallback, details: [] };
  }
  const message =
    data.detail ||
    data.error ||
    data.message ||
    fallback;

  const listKeys = [
    'missing_students',
    'incomplete_students',
    'incomplete_projects',
    'ungraded_students',
    'ungraded_projects',
    'unfinalized_councils',
    'students',
    'errors',
  ];
  const details: string[] = [];
  for (const key of listKeys) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      data[key].forEach((entry: any) => details.push(formatMissingStudentItem(entry)));
    }
  }
  return { message, details };
};

export const DefenseManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'grades' | 'deferral'>('grades');
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [councils, setCouncils] = useState<any[]>([]);
  const [selectedCouncilId, setSelectedCouncilId] = useState<string>('');
  const [projects, setProjects] = useState<ProjectAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Action loading & notice banner states
  const [finalizing, setFinalizing] = useState(false);
  const [closingBatch, setClosingBatch] = useState(false);
  const [exportingSummary, setExportingSummary] = useState(false);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

  // Import Final Academic Modal
  const [showImportFinalModal, setShowImportFinalModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Formal Deferral Requests & Admin-created Deferral Modal
  const [deferralRequests, setDeferralRequests] = useState<any[]>([]);
  const [showCreateDeferralModal, setShowCreateDeferralModal] = useState(false);
  const [deferProjectId, setDeferProjectId] = useState<string>('');
  const [deferReason, setDeferReason] = useState<string>('');
  const [deferAdminNotes, setDeferAdminNotes] = useState<string>('');
  const [deferAutoApprove, setDeferAutoApprove] = useState<boolean>(true);
  const [creatingDeferral, setCreatingDeferral] = useState<boolean>(false);
  const [councilSignatures, setCouncilSignatures] = useState<any>(null);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || null;
  const selectedCouncil = selectedCouncilId
    ? councils.find((c) => String(c.id) === String(selectedCouncilId)) || null
    : null;
  const finalizedCouncilCount = councils.filter((c) => Boolean(c.is_finalized)).length;
  const allCouncilsFinalized = councils.length > 0 && finalizedCouncilCount === councils.length;

  const fetchBatches = async () => {
    try {
      const res = await apiClient.get(`/admin/batches/?_t=${Date.now()}`);
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
      let url = `/admin/projects/?batch_id=${selectedBatchId}`;
      if (selectedCouncilId) {
        url += `&council_id=${selectedCouncilId}`;
      }

      const [counRes, projRes, defRes, sigRes] = await Promise.all([
        apiClient.get(`/admin/councils/?batch_id=${selectedBatchId}&_t=${Date.now()}`),
        apiClient.get(url),
        apiClient.get(`/admin/deferrals/?batch_id=${selectedBatchId}`).catch(() => ({ data: [] })),
        selectedCouncilId
          ? apiClient.get(`/admin/defense/councils/${selectedCouncilId}/signatures/`).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      setCouncils(Array.isArray(counRes.data) ? counRes.data : (counRes.data?.results || []));
      setProjects(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.results || []));
      setDeferralRequests(Array.isArray(defRes.data) ? defRes.data : (defRes.data?.results || []));
      setCouncilSignatures(sigRes?.data || null);
    } catch (err) {
      console.error(err);
      setCouncils([]);
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
  }, [selectedBatchId, selectedCouncilId]);

  const handleDownloadToTrinhDocx = async () => {
    if (!selectedCouncilId) {
      alert('Vui lòng chọn một Hội đồng cụ thể để xuất Tờ trình Word!');
      return;
    }
    try {
      const res = await apiClient.get(`/admin/export/to-trinh-word/?council_id=${selectedCouncilId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `To_trinh_Hoi_dong_${selectedCouncilId}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi tải file Tờ trình: ' + JSON.stringify(err));
    }
  };

  const handleDownloadBienBanExcel = async () => {
    if (!selectedCouncilId) {
      alert('Vui lòng chọn một Hội đồng cụ thể để xuất Biên bản chấm điểm Excel!');
      return;
    }
    try {
      const res = await apiClient.get(`/admin/export/bien-ban-excel/?council_id=${selectedCouncilId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bien_ban_cham_diem_HD_${selectedCouncilId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi tải file Bảng điểm Excel: ' + JSON.stringify(err));
    }
  };

  const handleDownloadFinalSummaryExcel = async () => {
    if (!selectedBatchId) return;
    try {
      setExportingSummary(true);
      setActionNotice(null);
      const res = await apiClient.get(`/admin/export/final-summary-excel/?batch_id=${selectedBatchId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_du_lieu_cuoi_ky_Dot_${selectedBatchId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      let errData = err.response?.data;
      if (errData instanceof Blob) {
        try {
          const text = await errData.text();
          errData = JSON.parse(text);
        } catch {
          errData = null;
        }
      }
      const { message, details } = extractApiErrorDetails(
        errData,
        err.message || 'Không thể xuất báo cáo dữ liệu cuối kỳ.'
      );
      setActionNotice({
        type: 'error',
        title: 'Lỗi xuất dữ liệu cuối kỳ',
        message,
        details,
      });
    } finally {
      setExportingSummary(false);
    }
  };

  const handleFinalizeCouncilScores = async () => {
    if (!selectedCouncilId) {
      setActionNotice({
        type: 'warning',
        title: 'Chưa chọn Hội đồng',
        message: 'Vui lòng chọn một Hội đồng cụ thể để xác nhận chốt điểm.',
      });
      return;
    }
    if (selectedCouncil?.is_finalized || selectedBatch?.is_closed) return;
    if (!confirm('Xác nhận Hội đồng chấm thi đã hoàn thành và CHỐT ĐIỂM chính thức? Sau khi chốt, điểm số sẽ được khóa.')) return;
    try {
      setFinalizing(true);
      setActionNotice(null);
      const res = await apiClient.post(`/admin/councils/${selectedCouncilId}/finalize-scores/`);
      setActionNotice({
        type: 'success',
        title: 'Chốt điểm Hội đồng thành công',
        message: res.data?.message || 'Đã xác nhận chốt điểm chính thức cho Hội đồng.',
      });
      await fetchData();
    } catch (err: any) {
      const { message, details } = extractApiErrorDetails(
        err.response?.data,
        err.message || 'Không thể chốt điểm Hội đồng.'
      );
      setActionNotice({
        type: 'error',
        title: 'Không thể chốt điểm Hội đồng',
        message,
        details,
      });
    } finally {
      setFinalizing(false);
    }
  };

  const handleCloseBatch = async () => {
    if (!selectedBatchId || selectedBatch?.is_closed || !allCouncilsFinalized) return;
    if (!confirm('Khoa xác nhận HOÀN TẤT VÀ KẾT THÚC ĐỢT ĐỒ ÁN TỐT NGHIỆP? Toàn bộ hồ sơ sẽ được lưu trữ.')) return;
    try {
      setClosingBatch(true);
      setActionNotice(null);
      const res = await apiClient.post(`/admin/batches/${selectedBatchId}/close/`);
      setActionNotice({
        type: 'success',
        title: 'Kết thúc đợt đồ án thành công',
        message: res.data?.message || 'Đợt đồ án đã được hoàn tất và chuyển vào kho lưu trữ.',
      });
      await Promise.all([fetchBatches(), fetchData()]);
    } catch (err: any) {
      const { message, details } = extractApiErrorDetails(
        err.response?.data,
        err.message || 'Không thể kết thúc đợt đồ án.'
      );
      setActionNotice({
        type: 'error',
        title: 'Không thể kết thúc đợt đồ án',
        message,
        details,
      });
    } finally {
      setClosingBatch(false);
    }
  };

  const handleImportFinalAcademic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedBatchId) return;

    try {
      setImporting(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('batch_id', selectedBatchId.toString());

      const res = await apiClient.post('/admin/final-academic/import-excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };

  const handleDeferralDecision = async (projId: number, decision: 'APPROVE_DEFERRAL' | 'REJECT_DEFERRAL', regNo: string) => {
    const isApprove = decision === 'APPROVE_DEFERRAL';
    const reasonPrompt = isApprove
      ? prompt(`Nhập ghi chú duyệt đơn bảo lưu cho SV ${regNo}:`, 'Đủ điều kiện bảo lưu theo quy chế đào tạo')
      : prompt(`Nhập lý do từ chối bảo lưu cho SV ${regNo} (Loại khỏi đợt):`, 'Không đạt yêu cầu bảo lưu');

    if (reasonPrompt === null) return;

    try {
      const res = await apiClient.patch(`/admin/projects/${projId}/deferral-decision/`, {
        decision: decision,
        reason: reasonPrompt,
      });
      alert(res.data?.message || 'Xử lý thành công!');
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateDeferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deferProjectId || !deferReason.trim() || creatingDeferral) return;
    const selectedProj = projects.find((p) => String(p.id) === deferProjectId);
    try {
      setCreatingDeferral(true);
      await apiClient.post('/admin/deferrals/', {
        project_id: selectedProj && selectedProj.id > 0 ? selectedProj.id : undefined,
        student_id: selectedProj?.student || Math.abs(Number(deferProjectId)),
        reason: deferReason.trim(),
        admin_notes: deferAdminNotes.trim(),
        auto_approve: deferAutoApprove,
      });
      setActionNotice({
        type: 'success',
        title: 'Lập đơn bảo lưu hộ thành công',
        message: `Đã lập hồ sơ bảo lưu cho sinh viên ${selectedProj?.student_reg_no || ''}.`,
      });
      setShowCreateDeferralModal(false);
      setDeferProjectId('');
      setDeferReason('');
      setDeferAdminNotes('');
      await fetchData();
    } catch (err: any) {
      alert('Lỗi lập đơn bảo lưu: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreatingDeferral(false);
    }
  };

  const deferralByProjectId = new Map<number, any>();
  deferralRequests.forEach((req) => {
    if (req.project && !deferralByProjectId.has(req.project)) {
      deferralByProjectId.set(req.project, req);
    }
  });

  const deferralCandidates = projects.filter(
    (p) =>
      p.deferral_status === 'REQUESTED' ||
      p.deferral_status === 'APPROVED' ||
      p.final_academic_eligibility === 'INELIGIBLE'
  );

  return (
    <AdminLayout>
      <div className="utc-defense-portal">
        {/* Navigation Tabs */}
        <div className="utc-subnav-tabs">
          <button
            className={`utc-subnav-btn ${activeTab === 'grades' ? 'active' : ''}`}
            onClick={() => setActiveTab('grades')}
          >
            📊 Điểm Số, Biên Bản & Tổng Hợp
          </button>
          <button
            className={`utc-subnav-btn ${activeTab === 'deferral' ? 'active' : ''}`}
            onClick={() => setActiveTab('deferral')}
          >
            📋 Rà Soát Học Vụ & Nhánh Bảo Lưu ({deferralCandidates.length})
          </button>
        </div>

        {/* Header Bar */}
        <div className="utc-defense-header-bar">
          <div className="utc-defense-header-top">
            <div className="utc-defense-filters-group">
              <div className="utc-defense-filter-item">
                <label>Đợt ĐATN:</label>
                <select
                  value={selectedBatchId || ''}
                  onChange={(e) => {
                    setSelectedBatchId(Number(e.target.value));
                    setSelectedCouncilId('');
                    setActionNotice(null);
                  }}
                  className="utc-form-select"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} - {b.batch_name}{b.is_closed ? ' (Đã kết thúc)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="utc-defense-filter-item">
                <label>Lọc Hội Đồng:</label>
                <select
                  value={selectedCouncilId}
                  onChange={(e) => {
                    setSelectedCouncilId(e.target.value);
                    setActionNotice(null);
                  }}
                  className="utc-form-select"
                >
                  <option value="">-- Tất cả Hội đồng --</option>
                  {councils.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.council_name} ({c.defense_room || 'Phòng ?'}){c.is_finalized ? ' ✓ Đã chốt' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="utc-defense-status-pills">
              {selectedBatch && (
                <span className={`utc-status-badge ${selectedBatch.is_closed ? 'is-closed' : 'is-open'}`}>
                  {selectedBatch.is_closed ? '🔒 Đợt đã kết thúc' : '🟢 Đợt đang hoạt động'}
                </span>
              )}
              <span className={`utc-status-badge ${allCouncilsFinalized ? 'is-done' : 'is-pending'}`}>
                {allCouncilsFinalized ? '✅' : '⏳'} {finalizedCouncilCount} / {councils.length} hội đồng đã chốt điểm
              </span>
              {selectedCouncil && (
                <span className={`utc-status-badge ${selectedCouncil.is_finalized ? 'is-done' : 'is-warn'}`}>
                  {selectedCouncil.is_finalized ? '🔒 HĐ đã chốt điểm' : '⚠️ HĐ chưa chốt điểm'}
                </span>
              )}
              {councilSignatures && (
                <span className={`utc-status-badge ${councilSignatures.fully_signed_projects >= councilSignatures.total_projects && councilSignatures.total_projects > 0 ? 'is-done' : 'is-pending'}`}>
                  🖋️ Biên bản đủ chữ ký: {councilSignatures.fully_signed_projects}/{councilSignatures.total_projects} ĐT
                </span>
              )}
            </div>
          </div>

          <div className="utc-defense-actions-group">
            <button
              onClick={handleDownloadToTrinhDocx}
              disabled={!selectedCouncilId}
              className="utc-btn-blue-outline"
              title={!selectedCouncilId ? 'Chọn một Hội đồng cụ thể để xuất Tờ trình Word' : 'Xuất Tờ trình thành lập Hội đồng Word chuẩn UTC'}
            >
              <span>📄</span> Xuất Tờ Trình Word
            </button>

            <button
              onClick={handleDownloadBienBanExcel}
              disabled={!selectedCouncilId}
              className="utc-btn-emerald-outline"
              title={!selectedCouncilId ? 'Chọn một Hội đồng cụ thể để xuất Bảng điểm Excel' : 'Xuất file Biên bản chấm điểm Excel của Hội đồng'}
            >
              <span>📊</span> Xuất Bảng Điểm HĐ (Excel)
            </button>

            <button
              onClick={handleFinalizeCouncilScores}
              disabled={
                !selectedCouncilId ||
                finalizing ||
                Boolean(selectedCouncil?.is_finalized) ||
                Boolean(selectedBatch?.is_closed)
              }
              className="utc-btn-amber"
              title={
                selectedBatch?.is_closed
                  ? 'Đợt đồ án đã kết thúc'
                  : !selectedCouncilId
                  ? 'Vui lòng chọn một Hội đồng cụ thể để chốt điểm'
                  : selectedCouncil?.is_finalized
                  ? 'Hội đồng này đã xác nhận chốt điểm'
                  : 'Hội đồng xác nhận chốt điểm chính thức'
              }
            >
              <span>🔒</span>{' '}
              {finalizing
                ? 'Đang chốt điểm...'
                : selectedCouncil?.is_finalized
                ? 'HĐ Đã Chốt Điểm'
                : 'HĐ Xác Nhận Chốt Điểm'}
            </button>

            <button
              onClick={handleDownloadFinalSummaryExcel}
              disabled={!selectedBatchId || exportingSummary}
              className="utc-btn-emerald"
              title={!selectedBatchId ? 'Vui lòng chọn đợt đồ án' : 'Xuất toàn bộ dữ liệu cuối kỳ phục vụ ký số và lưu trữ'}
            >
              <span>📑</span> {exportingSummary ? 'Đang xuất...' : 'Xuất Dữ Liệu Cuối Kỳ (Ký)'}
            </button>

            <button
              onClick={handleCloseBatch}
              disabled={
                !selectedBatchId ||
                closingBatch ||
                Boolean(selectedBatch?.is_closed) ||
                !allCouncilsFinalized
              }
              className="utc-btn-red"
              title={
                selectedBatch?.is_closed
                  ? 'Đợt đồ án này đã kết thúc và được lưu trữ'
                  : !allCouncilsFinalized
                  ? 'Chỉ có thể kết thúc đợt khi tất cả Hội đồng đã xác nhận chốt điểm'
                  : 'Khoa hoàn tất và kết thúc đợt đồ án'
              }
            >
              <span>🏁</span>{' '}
              {closingBatch
                ? 'Đang kết thúc...'
                : selectedBatch?.is_closed
                ? 'Đợt Đã Kết Thúc'
                : 'Kết Thúc Đợt Đồ Án'}
            </button>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div className={`utc-notice-banner notice-${actionNotice.type}`} role="alert">
            <div className="utc-notice-content">
              <div className="utc-notice-title">
                <span>
                  {actionNotice.type === 'success' ? '✅' : actionNotice.type === 'warning' ? '⚠️' : '❌'}
                </span>
                <strong>{actionNotice.title}</strong>
              </div>
              <p className="utc-notice-message">{actionNotice.message}</p>
              {actionNotice.details && actionNotice.details.length > 0 && (
                <ul className="utc-notice-details-list">
                  {actionNotice.details.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="utc-notice-close"
              onClick={() => setActionNotice(null)}
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: GRADES & COUNCIL SUMMARY */}
        {activeTab === 'grades' && (
          <div className="utc-defense-table-card">
            <div className="utc-panel-head">
              <div>
                <h4>Bảng Tổng Hợp Điểm Bảo Vệ & Xếp Loại Đồ Án Tốt Nghiệp ({projects.length})</h4>
                <span className="utc-panel-subtitle">Tổng hợp tự động: Điểm GVHD (40%), Điểm Phản biện (20%), Điểm Hội đồng (40%)</span>
              </div>
            </div>

            {loading ? (
              <div className="utc-loading-text">Đang tải dữ liệu điểm...</div>
            ) : projects.length === 0 ? (
              <div className="utc-empty-text">Không có đồ án nào trong bộ lọc này.</div>
            ) : (
              <div className="utc-table-container">
                <table className="utc-custom-table">
                  <thead>
                    <tr>
                      <th>MSSV</th>
                      <th>Sinh Viên</th>
                      <th>Hội Đồng</th>
                      <th>GV Hướng Dẫn</th>
                      <th>GV Phản Biện</th>
                      <th className="utc-cell-center">Điểm GVHD</th>
                      <th className="utc-cell-center">Điểm GVPB</th>
                      <th className="utc-cell-center">Tổng Hệ 10</th>
                      <th className="utc-cell-center">Hệ 4</th>
                      <th className="utc-cell-center">Điểm Chữ</th>
                      <th className="utc-cell-center">Ký Biên Bản</th>
                      <th>Kết Luận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((proj) => {
                      const isDeferred = proj.deferral_status === 'APPROVED';
                      const sigInfo = councilSignatures?.by_project?.[String(proj.id)];
                      return (
                        <tr key={proj.id} className={isDeferred ? 'utc-row-deferred' : undefined}>
                          <td className="utc-cell-bold">{proj.student_reg_no}</td>
                          <td>
                            <div className="utc-cell-semibold">{formatFullName(proj.student_name)}</div>
                            <div className="utc-cell-sub">{proj.student_class}</div>
                          </td>
                          <td>{proj.council_name || '—'}</td>
                          <td>{formatFullName(proj.supervisor_name)}</td>
                          <td>{formatFullName(proj.reviewer_name) || '—'}</td>
                          <td className="utc-cell-center utc-cell-bold">{proj.supervisor_score !== null ? proj.supervisor_score : '—'}</td>
                          <td className="utc-cell-center utc-cell-bold">{proj.reviewer_score !== null ? proj.reviewer_score : '—'}</td>
                          <td className="utc-cell-center utc-cell-bold utc-cell-score-primary">
                            {isDeferred ? '—' : proj.final_score_10 !== null ? proj.final_score_10 : '—'}
                          </td>
                          <td className="utc-cell-center utc-cell-bold">
                            {isDeferred ? '—' : proj.final_score_4 !== null ? proj.final_score_4 : '—'}
                          </td>
                          <td className="utc-cell-center utc-cell-bold">
                            {isDeferred ? '—' : proj.final_letter_grade || '—'}
                          </td>
                          <td className="utc-cell-center">
                            {sigInfo ? (
                              <span
                                className={`utc-pill ${sigInfo.is_fully_signed ? 'pill-green' : 'pill-amber'}`}
                                title={(sigInfo.members || []).map((m: any) => `${m.name}: ${m.signed ? 'Đã ký' : 'Chưa ký'}`).join('\n')}
                              >
                                🖋️ {sigInfo.signed_count}/{sigInfo.total_members}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            {isDeferred ? (
                              <span className="utc-badge-deferral">BẢO LƯU</span>
                            ) : proj.is_passed ? (
                              <span className="utc-badge-pass">ĐẠT</span>
                            ) : proj.final_score_10 !== null ? (
                              <span className="utc-badge-fail">KHÔNG ĐẠT</span>
                            ) : (
                              <span className="utc-badge-pending">Chờ chấm</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEFERRAL & FINAL ACADEMIC STATUS */}
        {activeTab === 'deferral' && (
          <div className="utc-defense-table-card">
            <div className="utc-panel-head">
              <div>
                <h4>Nhánh Bảo Lưu & Rà Soát Học Vụ Cuối (Bước 36, 37 & 43)</h4>
                <span className="utc-panel-subtitle">
                  Nếu không đủ điều kiện học vụ hoặc không đủ khả năng bảo vệ: Khoa duyệt đơn Bảo lưu → Lưu hồ sơ và kết thúc; Không duyệt → Loại khỏi đợt
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowCreateDeferralModal(true)}
                  className="utc-btn-primary"
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                >
                  <span>➕</span> Lập đơn bảo lưu hộ SV
                </button>
                <button onClick={() => setShowImportFinalModal(true)} className="utc-btn-emerald">
                  <span>📊</span> Import Kiểm Tra Học Vụ Cuối (Excel)
                </button>
              </div>
            </div>

            <div className="utc-table-container">
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th>MSSV</th>
                    <th>Sinh Viên</th>
                    <th>GV Xác Nhận BV</th>
                    <th>Điều Kiện Học Vụ Cuối</th>
                    <th>Trạng Thái Bảo Lưu</th>
                    <th>Lý Do / Ghi Chú</th>
                    <th>Quyết Định Của Khoa</th>
                  </tr>
                </thead>
                <tbody>
                  {deferralCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="utc-table-empty-cell">
                        Không có sinh viên nào rơi vào diện bảo lưu hoặc nợ học vụ cuối.
                      </td>
                    </tr>
                  ) : (
                    deferralCandidates.map((proj) => (
                      <tr key={proj.id}>
                        <td className="utc-cell-bold">{proj.student_reg_no}</td>
                        <td className="utc-cell-semibold">{formatFullName(proj.student_name)}</td>
                        <td>
                          <span className={`utc-pill ${proj.supervisor_defense_confirmed ? 'pill-green' : 'pill-amber'}`}>
                            {proj.supervisor_defense_confirmed ? 'Đủ khả năng BV' : 'Chưa xác nhận'}
                          </span>
                        </td>
                        <td>
                          <span className={`utc-pill ${proj.final_academic_eligibility === 'ELIGIBLE' ? 'pill-green' : 'pill-red'}`}>
                            {proj.final_academic_eligibility === 'ELIGIBLE' ? 'Đủ ĐK Học Vụ' : 'Nợ CĐR / Học phí'}
                          </span>
                        </td>
                        <td>
                          <span className={`utc-deferral-status status-${(proj.deferral_status || 'none').toLowerCase()}`}>
                            {proj.deferral_status === 'APPROVED'
                              ? '✅ Đã Duyệt Bảo Lưu'
                              : proj.deferral_status === 'REJECTED'
                              ? '🚫 Từ Chối Bảo Lưu (Loại)'
                              : '⏳ Đơn Xin Bảo Lưu'}
                          </span>
                        </td>
                        <td className="utc-cell-notes-col">
                          <span className="utc-cell-notes">{proj.deferral_reason || proj.final_academic_notes || '—'}</span>
                          {deferralByProjectId.get(proj.id)?.supervisor_feedback && (
                            <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', padding: '4px 6px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                              💬 <b>GVHD:</b> {deferralByProjectId.get(proj.id).supervisor_feedback}
                            </div>
                          )}
                          {deferralByProjectId.get(proj.id)?.created_by_admin && (
                            <div style={{ marginTop: '3px', fontSize: '0.72rem', color: '#4338ca', fontWeight: 600 }}>
                              🏛️ Khoa lập hộ SV
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="utc-action-btn-group">
                            {proj.deferral_status !== 'APPROVED' && (
                              <button
                                onClick={() => handleDeferralDecision(proj.id, 'APPROVE_DEFERRAL', proj.student_reg_no)}
                                className="utc-btn-sm-approve"
                                title="Khoa duyệt bảo lưu → Lưu hồ sơ và kết thúc"
                              >
                                ✓ Duyệt Bảo Lưu
                              </button>
                            )}
                            {proj.deferral_status !== 'REJECTED' && (
                              <button
                                onClick={() => handleDeferralDecision(proj.id, 'REJECT_DEFERRAL', proj.student_reg_no)}
                                className="utc-btn-sm-reject"
                                title="Từ chối bảo lưu → Loại khỏi đợt"
                              >
                                ✕ Loại Khỏi Đợt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: IMPORT FINAL ACADEMIC */}
        {showImportFinalModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>📊 Import Rà Soát Điều Kiện Học Vụ Cuối (Bước 36 & 37)</h4>
                <button onClick={() => setShowImportFinalModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleImportFinalAcademic}>
                <div className="utc-modal-body">
                  <div className="utc-form-group">
                    <label>Chọn File Excel Rà Soát Học Vụ:</label>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      required
                      onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                      className="utc-input"
                    />
                    <small>
                      File Excel kiểm tra chuẩn đầu ra ngoại ngữ, công nợ học phí và điều kiện bảo vệ.
                    </small>
                  </div>

                  {importResult && (
                    <div className="utc-alert-box">
                      <strong>Kết quả rà soát:</strong>
                      <div>Đã kiểm tra: {importResult.total} sinh viên</div>
                      <div className="utc-alert-stat-ok">Đủ điều kiện: {importResult.eligible_count}</div>
                      <div className="utc-alert-stat-err">Không đủ ĐK (Chuyển bảo lưu): {importResult.ineligible_count}</div>
                    </div>
                  )}
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowImportFinalModal(false)} className="utc-btn-cancel">Đóng</button>
                  <button type="submit" disabled={importing} className="utc-btn-emerald">
                    {importing ? 'Đang phân tích...' : 'Bắt Đầu Import & Rà Soát'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* MODAL: ADMIN CREATE DEFERRAL */}
        {showCreateDeferralModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>📋 Lập Đơn Bảo Lưu Đồ Án Hộ Sinh Viên</h4>
                <button onClick={() => setShowCreateDeferralModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleCreateDeferral}>
                <div className="utc-modal-body">
                  <div className="utc-form-group">
                    <label>Chọn Sinh viên trong đợt:</label>
                    <select
                      required
                      value={deferProjectId}
                      onChange={(e) => setDeferProjectId(e.target.value)}
                      className="utc-input"
                    >
                      <option value="">-- Chọn sinh viên --</option>
                      {projects.filter((p) => p.student).map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.student_reg_no} - {formatFullName(p.student_name)} ({p.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="utc-form-group" style={{ marginTop: '0.75rem' }}>
                    <label>Lý do bảo lưu (*):</label>
                    <textarea
                      required
                      rows={3}
                      value={deferReason}
                      onChange={(e) => setDeferReason(e.target.value)}
                      placeholder="VD: Xin bảo lưu do lý do sức khỏe / công tác có minh chứng..."
                      className="utc-input"
                    />
                  </div>
                  <div className="utc-form-group" style={{ marginTop: '0.75rem' }}>
                    <label>Ghi chú của Khoa:</label>
                    <input
                      type="text"
                      value={deferAdminNotes}
                      onChange={(e) => setDeferAdminNotes(e.target.value)}
                      placeholder="Ghi chú nội bộ hoặc quyết định của Khoa..."
                      className="utc-input"
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={deferAutoApprove}
                      onChange={(e) => setDeferAutoApprove(e.target.checked)}
                    />
                    <span>Phê duyệt bảo lưu ngay (Chuyển trạng thái sang <b>DEFERRED</b>)</span>
                  </label>
                </div>
                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowCreateDeferralModal(false)} className="utc-btn-cancel">Đóng</button>
                  <button type="submit" disabled={creatingDeferral} className="utc-btn-primary">
                    {creatingDeferral ? 'Đang tạo...' : '💾 Tạo Hồ Sơ Bảo Lưu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

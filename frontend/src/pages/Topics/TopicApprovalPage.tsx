import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import { formatFullName } from '../../utils/nameHelper';
import './TopicApprovalPage.css';

interface ProjectTopic {
  id: number;
  student: number | null;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  education_program: string;
  supervisor: number | null;
  supervisor_name: string;
  topic_category?: number | null;
  topic_category_name?: string;
  topic_title_vi: string;
  topic_title_en: string;
  topic_review_status: 'DRAFT' | 'GV_CONFIRMED' | 'APPROVED' | 'REVISION_REQUIRED';
  topic_revision_notes: string;
  status: string;
  outline_pdf_path?: string;
  outline_file_url?: string;
  created_at?: string;
}

export const TopicApprovalPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectTopic[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OFFERED' | 'STUDENT'>('ALL');
  const [search, setSearch] = useState<string>('');

  // Evaluation & Feedback Tool Modal State
  const [selectedProject, setSelectedProject] = useState<ProjectTopic | null>(null);
  const [evalDecision, setEvalDecision] = useState<'APPROVE' | 'REQUEST_REVISION' | 'REJECT'>('APPROVE');
  const [evalNotes, setEvalNotes] = useState<string>('');
  const [submittingEval, setSubmittingEval] = useState<boolean>(false);

  // Document Preview Modal State
  const [previewDocument, setPreviewDocument] = useState<{
    url: string;
    title: string;
    studentName?: string;
    regNo?: string;
  } | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const QUICK_FEEDBACK_TEMPLATES = [
    '✅ Đề tài đạt chuẩn, nội dung và phạm vi phù hợp với mục tiêu ĐATN Khoa CNTT.',
    '⚠️ Đề tài có phạm vi quá rộng, GV & SV cần thu hẹp phạm vi và tập trung vào chức năng cốt lõi.',
    '⚠️ Cần làm rõ hơn kiến trúc công nghệ, framework và cơ sở dữ liệu sẽ áp dụng trong đề cương.',
    '⚠️ Tên đề tài chưa phản ánh đúng sản phẩm phần mềm đầu ra, đề nghị điều chỉnh lại tiêu đề.',
    '❌ Hướng đề tài bị trùng lặp với đề tài khác trong cùng đợt, đề nghị Giảng viên chọn bài toán khác.',
  ];

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
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setProjects(list);
    } catch (err) {
      console.error('Fetch projects error:', err);
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

  // Quick Approve
  const handleQuickApprove = async (proj: ProjectTopic) => {
    const isOffered = !proj.student || !proj.student_reg_no;
    const rawTitle = (proj.topic_title_vi || '').trim();
    const isDummyTitle = rawTitle.startsWith('Đồ án tốt nghiệp của') || rawTitle.startsWith('Đề tài tốt nghiệp của');
    const hasRealTitle = isOffered ? !!rawTitle : (!!rawTitle && !isDummyTitle);

    if (!hasRealTitle && !isOffered) {
      showToast('Sinh viên chưa đăng ký đề tài chính thức, Khoa chưa thể phê duyệt!', 'error');
      return;
    }

    if (!isOffered && proj.topic_review_status !== 'GV_CONFIRMED') {
      showToast('GVHD chưa duyệt và gửi đề tài lên Khoa, Khoa chưa thể phê duyệt!', 'error');
      return;
    }

    const confirmMsg = isOffered
      ? `Khoa xác nhận CHẤP THUẬN đề tài gợi ý:\n"${proj.topic_title_vi}"\nGVHD: ${proj.supervisor_name}?\n\nSau khi duyệt, sinh viên trong đợt có thể đăng ký đề tài này.`
      : `Khoa xác nhận PHÊ DUYỆT đề tài:\n"${proj.topic_title_vi}"\nSinh viên: ${proj.student_name} (${proj.student_reg_no})?`;

    if (!confirm(confirmMsg)) return;

    try {
      await apiClient.patch(`/admin/projects/${proj.id}/topic-approval/`, {
        decision: 'APPROVE',
        notes: '',
      });
      showToast('Đã phê duyệt đề tài thành công!', 'success');
      fetchProjects();
    } catch (err: any) {
      showToast('Lỗi phê duyệt: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  // Open Evaluation & Feedback Tool Modal
  const handleOpenEvaluationModal = (proj: ProjectTopic) => {
    setSelectedProject(proj);
    const isOffered = !proj.student || !proj.student_reg_no;
    const rawTitle = (proj.topic_title_vi || '').trim();
    const isDummy = rawTitle.startsWith('Đồ án tốt nghiệp của') || rawTitle.startsWith('Đề tài tốt nghiệp của');
    const hasRealTitle = isOffered ? !!rawTitle : (!!rawTitle && !isDummy);

    if (!hasRealTitle && !isOffered) {
      setEvalDecision('REQUEST_REVISION');
    } else if (proj.topic_review_status === 'REVISION_REQUIRED') {
      setEvalDecision('REQUEST_REVISION');
    } else {
      setEvalDecision('APPROVE');
    }
    setEvalNotes(proj.topic_revision_notes || '');
  };

  // Submit Feedback & Decision
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const isModalOffered = !selectedProject.student || !selectedProject.student_reg_no;
    const modalRawTitle = (selectedProject.topic_title_vi || '').trim();
    const isModalDummy = modalRawTitle.startsWith('Đồ án tốt nghiệp của') || modalRawTitle.startsWith('Đề tài tốt nghiệp của');
    const modalHasRealTitle = isModalOffered ? !!modalRawTitle : (!!modalRawTitle && !isModalDummy);

    if (evalDecision === 'APPROVE' && !modalHasRealTitle && !isModalOffered) {
      alert('Sinh viên chưa đăng ký tên đề tài chính thức. Khoa không thể Phê duyệt! Vui lòng chọn "Yêu cầu chỉnh sửa lại" để gửi phản hồi nhắc nhở sinh viên.');
      return;
    }

    if (evalDecision !== 'APPROVE' && !evalNotes.trim()) {
      alert('Vui lòng nhập nội dung góp ý hoặc lý do yêu cầu chỉnh sửa/từ chối để phản hồi cho Giảng viên.');
      return;
    }

    try {
      setSubmittingEval(true);
      await apiClient.patch(`/admin/projects/${selectedProject.id}/topic-approval/`, {
        decision: evalDecision,
        notes: evalNotes.trim(),
      });
      showToast('Đã lưu kết quả thẩm định và gửi phản hồi thành công!', 'success');
      setSelectedProject(null);
      fetchProjects();
    } catch (err: any) {
      showToast('Lỗi gửi kết quả thẩm định: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setSubmittingEval(false);
    }
  };

  const handleDownloadOutline = async (projId: number, regNo?: string) => {
    try {
      const res = await apiClient.get(`/admin/projects/${projId}/download-outline/`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = regNo ? `Phieu_giao_de_tai_${regNo}.docx` : `Phieu_de_tai_goi_y_${projId}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Lỗi tải phiếu giao đề tài Word!', 'error');
    }
  };

  const handlePreviewOutline = (proj: ProjectTopic) => {
    const fileUrl = proj.outline_file_url || (proj.outline_pdf_path ? `/media/${proj.outline_pdf_path}` : '');
    if (!fileUrl) {
      showToast('Sinh viên chưa tải lên tệp đề cương PDF!', 'info');
      return;
    }
    setPreviewDocument({
      url: fileUrl,
      title: proj.topic_title_vi,
      studentName: proj.student_name,
      regNo: proj.student_reg_no,
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setSearch('');
  };

  // Valid projects
  const validProjects = projects.filter((p) => p.status !== 'UNASSIGNED');

  // Counts by review status
  const countPending = validProjects.filter((p) => p.topic_review_status === 'GV_CONFIRMED').length;
  const countApproved = validProjects.filter((p) => p.topic_review_status === 'APPROVED').length;
  const countRevision = validProjects.filter((p) => p.topic_review_status === 'REVISION_REQUIRED').length;
  const countDraft = validProjects.filter((p) => p.topic_review_status === 'DRAFT').length;

  // Counts by type
  const offeredProjects = validProjects.filter((p) => !p.student || !p.student_reg_no);
  const studentProjects = validProjects.filter((p) => p.student && !!p.student_reg_no);

  // Filtered view
  const filteredProjects = validProjects.filter((p) => {
    if (statusFilter !== 'ALL' && p.topic_review_status !== statusFilter) {
      return false;
    }

    const isOffered = !p.student || !p.student_reg_no;
    if (typeFilter === 'OFFERED' && !isOffered) return false;
    if (typeFilter === 'STUDENT' && isOffered) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = (p.topic_title_vi || '').toLowerCase().includes(q) || (p.topic_title_en || '').toLowerCase().includes(q);
      const matchSup = (p.supervisor_name || '').toLowerCase().includes(q);
      const matchStu = (p.student_name || '').toLowerCase().includes(q) || (p.student_reg_no || '').toLowerCase().includes(q);
      const matchCat = (p.topic_category_name || '').toLowerCase().includes(q);
      return matchTitle || matchSup || matchStu || matchCat;
    }

    return true;
  });

  const getStatusName = (filter: string) => {
    switch (filter) {
      case 'GV_CONFIRMED':
        return 'Chờ Khoa duyệt';
      case 'APPROVED':
        return 'Đã duyệt (Approved)';
      case 'REVISION_REQUIRED':
        return 'Yêu cầu sửa lại';
      case 'DRAFT':
        return 'Đang soạn nháp (Draft)';
      default:
        return 'Tất cả';
    }
  };

  return (
    <AdminLayout>
      <div className="utc-topics-portal">
        {/* Toast Notification */}
        {toast && (
          <div className={`utc-toast utc-toast-${toast.type}`}>
            <span className="utc-toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="utc-toast-message">{toast.message}</span>
            <button className="utc-toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* Header Bar */}
        <div className="utc-topics-header-bar">
          <div className="utc-topics-header-info">
            <div className="utc-header-badge-row">
              <span className="utc-badge-phase">GIAI ĐOẠN 3 / 6</span>
              <span className="utc-badge-council">🏛️ HỘI ĐỒNG KHOA CNTT</span>
            </div>
            <h3>Giai Đoạn 3: Thẩm Định & Phê Duyệt Đề Tài ĐATN</h3>
            <p>
              Thẩm định chất lượng đề tài và đề cương chi tiết: Phê duyệt đề tài chính thức cho Sinh viên, thông qua đề tài gợi ý của GVHD hoặc gửi góp ý yêu cầu điều chỉnh.
            </p>
          </div>

          <div className="utc-batch-select-card">
            <div className="utc-batch-label">
              <span className="utc-batch-icon">🎯</span>
              <span>Đợt Đồ Án Tốt Nghiệp:</span>
            </div>
            <div className="utc-batch-action-row">
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
              <button
                className="utc-btn-refresh"
                onClick={fetchProjects}
                title="Làm mới danh sách đề tài"
              >
                ↻
              </button>
            </div>
          </div>
        </div>

        {/* Status Counters / KPI Cards */}
        <div className="utc-topic-stats-grid">
          {/* 1. All Topics */}
          <div
            className={`utc-topic-stat-box stat-all ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            <div className="stat-top-row">
              <div className="stat-icon-wrapper icon-all">📚</div>
              <span className="stat-tag tag-all">Tổng số</span>
              {statusFilter === 'ALL' && <span className="stat-active-indicator">● Đang chọn</span>}
            </div>
            <div className="stat-number text-blue">{validProjects.length}</div>
            <div className="stat-title">Tất cả đề tài</div>
            <div className="stat-sub">Toàn bộ đề tài trong đợt</div>
          </div>

          {/* 2. Pending Approval */}
          <div
            className={`utc-topic-stat-box stat-pending ${statusFilter === 'GV_CONFIRMED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('GV_CONFIRMED')}
          >
            <div className="stat-top-row">
              <div className="stat-icon-wrapper icon-amber">⏳</div>
              <span className="stat-tag tag-amber">Cần xử lý</span>
              {statusFilter === 'GV_CONFIRMED' && <span className="stat-active-indicator">● Đang chọn</span>}
            </div>
            <div className="stat-number text-amber">{countPending}</div>
            <div className="stat-title">Chờ Khoa duyệt</div>
            <div className="stat-sub">GVHD đã xác nhận & gửi lên</div>
          </div>

          {/* 3. Approved */}
          <div
            className={`utc-topic-stat-box stat-approved ${statusFilter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('APPROVED')}
          >
            <div className="stat-top-row">
              <div className="stat-icon-wrapper icon-emerald">✅</div>
              <span className="stat-tag tag-emerald">Đạt chuẩn</span>
              {statusFilter === 'APPROVED' && <span className="stat-active-indicator">● Đang chọn</span>}
            </div>
            <div className="stat-number text-emerald">{countApproved}</div>
            <div className="stat-title">Khoa đã duyệt</div>
            <div className="stat-sub">Phê duyệt chính thức</div>
          </div>

          {/* 4. Revision Required */}
          <div
            className={`utc-topic-stat-box stat-revision ${statusFilter === 'REVISION_REQUIRED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('REVISION_REQUIRED')}
          >
            <div className="stat-top-row">
              <div className="stat-icon-wrapper icon-rose">⚠️</div>
              <span className="stat-tag tag-rose">Cần điều chỉnh</span>
              {statusFilter === 'REVISION_REQUIRED' && <span className="stat-active-indicator">● Đang chọn</span>}
            </div>
            <div className="stat-number text-rose">{countRevision}</div>
            <div className="stat-title">Yêu cầu sửa lại</div>
            <div className="stat-sub">Khoa đã gửi phản hồi góp ý</div>
          </div>

          {/* 5. Draft */}
          <div
            className={`utc-topic-stat-box stat-draft ${statusFilter === 'DRAFT' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DRAFT')}
          >
            <div className="stat-top-row">
              <div className="stat-icon-wrapper icon-slate">📝</div>
              <span className="stat-tag tag-slate">Đang soạn</span>
              {statusFilter === 'DRAFT' && <span className="stat-active-indicator">● Đang chọn</span>}
            </div>
            <div className="stat-number text-slate">{countDraft}</div>
            <div className="stat-title">Đang soạn nháp</div>
            <div className="stat-sub">Chưa nộp hoặc chưa gửi Khoa</div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="utc-topic-table-card">
          {/* Controls Bar: Type Tabs & Search */}
          <div className="utc-topic-controls-bar">
            {/* Segmented Pill Tabs */}
            <div className="utc-type-tabs">
              <button
                className={`utc-type-tab ${typeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTypeFilter('ALL')}
              >
                <span>📑 Tất cả đề tài</span>
                <span className="utc-pill-count">{validProjects.length}</span>
              </button>
              <button
                className={`utc-type-tab ${typeFilter === 'OFFERED' ? 'active' : ''}`}
                onClick={() => setTypeFilter('OFFERED')}
              >
                <span>💡 Đề tài gợi ý của GV</span>
                <span className="utc-pill-count">{offeredProjects.length}</span>
              </button>
              <button
                className={`utc-type-tab ${typeFilter === 'STUDENT' ? 'active' : ''}`}
                onClick={() => setTypeFilter('STUDENT')}
              >
                <span>🎓 Đề tài nhóm Sinh viên</span>
                <span className="utc-pill-count">{studentProjects.length}</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="utc-search-wrapper">
              <span className="utc-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm kiếm theo tên đề tài, SV, GVHD, MSSV..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="utc-search-input"
              />
              {search && (
                <button className="utc-search-clear" onClick={() => setSearch('')}>
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Table Header Row & Filter Summary */}
          <div className="utc-topic-table-head">
            <div className="utc-head-left">
              <h4>
                Danh sách đề tài tốt nghiệp ({filteredProjects.length})
                {typeFilter === 'OFFERED' && <span className="utc-badge-sub"> • Đề tài gợi ý</span>}
                {typeFilter === 'STUDENT' && <span className="utc-badge-sub"> • Đồ án sinh viên</span>}
              </h4>
              <p className="utc-head-tip">
                Sử dụng nút <strong>"✓ Duyệt nhanh"</strong> để duyệt tức thì hoặc <strong>"🏛️ Thẩm định & Góp ý"</strong> để gửi góp ý chi tiết cho Giảng viên.
              </p>
            </div>

            {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || search.trim()) && (
              <div className="utc-active-filters-bar">
                <span className="utc-filter-label">Bộ lọc:</span>
                {statusFilter !== 'ALL' && (
                  <span className="utc-filter-chip">
                    Trạng thái: <strong>{getStatusName(statusFilter)}</strong>
                    <button onClick={() => setStatusFilter('ALL')}>✕</button>
                  </span>
                )}
                {typeFilter !== 'ALL' && (
                  <span className="utc-filter-chip">
                    Loại: <strong>{typeFilter === 'OFFERED' ? 'Đề tài gợi ý' : 'Đồ án SV'}</strong>
                    <button onClick={() => setTypeFilter('ALL')}>✕</button>
                  </span>
                )}
                {search.trim() && (
                  <span className="utc-filter-chip">
                    Từ khóa: <strong>"{search}"</strong>
                    <button onClick={() => setSearch('')}>✕</button>
                  </span>
                )}
                <button className="utc-btn-reset-filters" onClick={handleResetFilters}>
                  ↺ Xóa tất cả lọc
                </button>
              </div>
            )}
          </div>

          {/* Loading, Empty State or Table */}
          {loading ? (
            <div className="utc-state-container">
              <div className="utc-loading-spinner"></div>
              <p className="utc-loading-text">Đang tải danh sách đề tài & thẩm định...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="utc-empty-card">
              <div className="utc-empty-icon-circle">
                {search ? '🔍' : statusFilter === 'GV_CONFIRMED' ? '⏳' : '📭'}
              </div>
              <h5 className="utc-empty-title">Không tìm thấy đề tài nào</h5>
              <p className="utc-empty-desc">
                {search ? (
                  <>Không tìm thấy đề tài nào phù hợp với từ khóa "<strong>{search}</strong>".</>
                ) : statusFilter === 'GV_CONFIRMED' ? (
                  <>Hiện tại không có đề tài nào đang ở trạng thái <strong>Chờ Khoa duyệt</strong>. Bạn có thể chọn tab "Tất cả đề tài" hoặc "Đang soạn nháp" để kiểm tra tiến trình.</>
                ) : (
                  <>Không có đề tài nào phù hợp với bộ lọc <strong>{getStatusName(statusFilter)}</strong> hiện tại.</>
                )}
              </p>
              {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || search) && (
                <button className="utc-btn-empty-reset" onClick={handleResetFilters}>
                  ↺ Xem tất cả đề tài ({validProjects.length})
                </button>
              )}
            </div>
          ) : (
            <div className="utc-table-container">
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Đối Tượng / MSSV</th>
                    <th style={{ minWidth: '170px' }}>Sinh Viên / Lớp</th>
                    <th style={{ minWidth: '180px' }}>GVHD / Bộ Môn</th>
                    <th style={{ minWidth: '320px' }}>Tên Đề Tài & Đề Cương</th>
                    <th style={{ width: '160px' }}>Trạng Thái Duyệt</th>
                    <th style={{ minWidth: '220px', textAlign: 'center' }}>Thao Tác Của Khoa</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const isOffered = !p.student || !p.student_reg_no;
                    const rawTitle = (p.topic_title_vi || '').trim();
                    const isDummyTitle = rawTitle.startsWith('Đồ án tốt nghiệp của') || rawTitle.startsWith('Đề tài tốt nghiệp của');
                    const hasRealTitle = isOffered ? !!rawTitle : (!!rawTitle && !isDummyTitle);
                    const hasOutline = !!p.outline_pdf_path || !!p.outline_file_url;

                    return (
                      <tr key={p.id} className={isOffered ? 'row-offered-topic' : ''}>
                        {/* 1. MSSV / Object Type */}
                        <td>
                          {isOffered ? (
                            <span className="utc-tag-offered" title="Đề tài gợi ý do GVHD đề xuất mở">
                              💡 Đề tài gợi ý
                            </span>
                          ) : (
                            <div className="utc-student-code-col">
                              <span className="utc-reg-no">{p.student_reg_no}</span>
                              <span className={`utc-tag-edu ${p.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                                {p.education_program === 'ENGINEER' ? '⚙️ Kỹ sư' : '🎓 Cử nhân'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 2. Student Info */}
                        <td>
                          {isOffered ? (
                            <div>
                              <span className="utc-tag-open">🟢 Đang mở đăng ký</span>
                              <div className="utc-text-xs-sub">Chưa có nhóm sinh viên nhận</div>
                            </div>
                          ) : (
                            <div className="utc-student-info-cell">
                              <div className="utc-avatar-badge">
                                {p.student_name ? (p.student_name.trim().split(/\s+/).pop() || 'S').charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div>
                                <div className="utc-student-name">{formatFullName(p.student_name)}</div>
                                <div className="utc-student-class">{p.student_class || 'Khoa CNTT'}</div>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 3. Supervisor */}
                        <td>
                          <div className="utc-supervisor-cell">
                            <span className="utc-supervisor-icon">👨‍🏫</span>
                            <div>
                              <div className="utc-supervisor-name">
                                {formatFullName(p.supervisor_name) || 'Chưa phân công'}
                              </div>
                              <div className="utc-supervisor-role">
                                {isOffered ? 'Cán bộ đề xuất' : 'Giảng viên hướng dẫn'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 4. Title, Major & Outline Document */}
                        <td>
                          {hasRealTitle ? (
                            <>
                              <div className="utc-topic-title-vi">{p.topic_title_vi}</div>
                              {p.topic_title_en && (
                                <div className="utc-topic-title-en">{p.topic_title_en}</div>
                              )}
                            </>
                          ) : (
                            <div className="utc-unsubmitted-topic-card">
                              <div className="utc-unsubmitted-badge">
                                <span className="utc-badge-dot dot-slate"></span>
                                <span>Chưa đăng ký tên đề tài</span>
                              </div>
                              <div className="utc-unsubmitted-desc">
                                Sinh viên chưa gửi tên đề tài chính thức & đề cương chi tiết
                              </div>
                            </div>
                          )}

                          <div className="utc-topic-meta-row">
                            {p.topic_category_name && (
                              <span
                                className={`utc-category-pill ${!hasRealTitle ? 'pill-tentative' : ''}`}
                                title={!hasRealTitle ? 'Hướng nghiên cứu khảo sát sơ bộ ở GĐ2' : 'Lĩnh vực chuyên môn'}
                              >
                                {hasRealTitle ? `📁 ${p.topic_category_name}` : `🎯 Hướng NC: ${p.topic_category_name}`}
                              </span>
                            )}

                            {/* Outline Status */}
                            {hasOutline ? (
                              <button
                                className="utc-pill-outline-btn"
                                onClick={() => handlePreviewOutline(p)}
                                title="Xem file đề cương PDF do sinh viên tải lên"
                              >
                                📄 Đề cương PDF (Xem ngay)
                              </button>
                            ) : !isOffered ? (
                              <span className="utc-tag-no-outline" title="Sinh viên chưa nộp tệp đề cương chi tiết">
                                ⚠️ Chưa nộp đề cương
                              </span>
                            ) : null}
                          </div>

                          {/* Revision feedback note from Faculty */}
                          {p.topic_revision_notes && (
                            <div className="utc-revision-callout">
                              <span className="utc-rev-icon">💬</span>
                              <div>
                                <strong>Góp ý từ Khoa:</strong> {p.topic_revision_notes}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 5. Review Status Badge */}
                        <td>
                          <span className={`utc-topic-badge badge-${(p.topic_review_status || 'draft').toLowerCase()}`}>
                            {p.topic_review_status === 'APPROVED' ? (
                              <>
                                <span className="utc-badge-dot dot-emerald"></span>
                                Đã Phê Duyệt
                              </>
                            ) : p.topic_review_status === 'GV_CONFIRMED' ? (
                              <>
                                <span className="utc-badge-dot dot-amber"></span>
                                Chờ Khoa Duyệt
                              </>
                            ) : p.topic_review_status === 'REVISION_REQUIRED' ? (
                              <>
                                <span className="utc-badge-dot dot-rose"></span>
                                Yêu Cầu Sửa Lại
                              </>
                            ) : !hasRealTitle && !isOffered ? (
                              <>
                                <span className="utc-badge-dot dot-slate"></span>
                                Chưa Gửi Đề Tài
                              </>
                            ) : (
                              <>
                                <span className="utc-badge-dot dot-slate"></span>
                                Bản Nháp (Draft)
                              </>
                            )}
                          </span>
                        </td>

                        {/* 6. Action Buttons */}
                        <td>
                          <div className="utc-action-btn-group">
                            {p.topic_review_status !== 'APPROVED' && (
                              hasRealTitle && !isOffered && p.topic_review_status !== 'GV_CONFIRMED' ? (
                                <button
                                  className="utc-btn-quick-approve-disabled"
                                  disabled
                                  title="GVHD chưa duyệt và gửi đề tài lên Khoa"
                                >
                                  Chờ GVHD duyệt
                                </button>
                              ) : hasRealTitle ? (
                                <button
                                  onClick={() => handleQuickApprove(p)}
                                  className="utc-btn-quick-approve"
                                  title="Khoa xác nhận chấp thuận đề tài này"
                                >
                                  ✓ Duyệt nhanh
                                </button>
                              ) : !isOffered ? (
                                <button
                                  className="utc-btn-quick-approve-disabled"
                                  disabled
                                  title="Sinh viên chưa đăng ký đề tài nên chưa thể phê duyệt"
                                >
                                  Chờ SV gửi đề tài
                                </button>
                              ) : null
                            )}

                            <button
                              onClick={() => handleOpenEvaluationModal(p)}
                              className="utc-btn-eval"
                              title="Mở công cụ thẩm định và gửi phản hồi chi tiết cho Giảng viên"
                            >
                              🏛️ Thẩm định & Góp ý
                            </button>

                            {hasOutline && (
                              <button
                                onClick={() => handlePreviewOutline(p)}
                                className="utc-btn-preview-outline"
                                title="Xem tệp đề cương chi tiết của sinh viên"
                              >
                                👁 Xem đề cương
                              </button>
                            )}

                            {p.topic_review_status === 'APPROVED' && (
                              <button
                                onClick={() => handleDownloadOutline(p.id, p.student_reg_no)}
                                className="utc-btn-outline-doc"
                                title="Tải phiếu giao đề tài Word (.docx)"
                              >
                                📄 Tải biểu mẫu
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ==============================================================================
         * MODAL: KHOA EVALUATION & FEEDBACK TOOL (CÔNG CỤ THẨM ĐỊNH & PHẢN HỒI ĐỀ TÀI)
         * ============================================================================== */}
        {selectedProject && (
          <div className="utc-modal-backdrop" onClick={() => setSelectedProject(null)}>
            <div className="utc-modal-card utc-eval-modal" onClick={(e) => e.stopPropagation()}>
              <div className="utc-modal-head">
                <div className="utc-modal-head-title">
                  <div className="utc-modal-icon">🏛️</div>
                  <div>
                    <h4>Công Cụ Thẩm Định & Phản Hồi Đề Tài</h4>
                    <p className="utc-modal-sub">
                      Hội đồng Khoa CNTT đưa ra quyết định phê duyệt hoặc gửi nhận xét góp ý tới Giảng viên hướng dẫn & Sinh viên.
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedProject(null)} className="utc-btn-close">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitEvaluation}>
                {/* Warning Banner if unsubmitted */}
                {(() => {
                  const isModalOffered = !selectedProject.student || !selectedProject.student_reg_no;
                  const modalRawTitle = (selectedProject.topic_title_vi || '').trim();
                  const isModalDummy = modalRawTitle.startsWith('Đồ án tốt nghiệp của') || modalRawTitle.startsWith('Đề tài tốt nghiệp của');
                  const modalHasRealTitle = isModalOffered ? !!modalRawTitle : (!!modalRawTitle && !isModalDummy);

                  if (!modalHasRealTitle && !isModalOffered) {
                    return (
                      <div className="utc-modal-warning-banner">
                        ⚠️ <strong>Lưu ý:</strong> Sinh viên này <strong>chưa nộp tên đề tài chính thức</strong> và đề cương chi tiết. Khoa vui lòng chọn <strong>"Yêu cầu chỉnh sửa lại"</strong> để gửi phản hồi/nhắc nhở sinh viên khẩn trương đăng ký.
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Project Overview Card */}
                <div className="utc-eval-project-card">
                  <div className="eval-row">
                    <span className="eval-label">Tên đề tài:</span>
                    <span className="eval-value font-bold text-slate-900">
                      {(() => {
                        const isModalOffered = !selectedProject.student || !selectedProject.student_reg_no;
                        const modalRawTitle = (selectedProject.topic_title_vi || '').trim();
                        const isModalDummy = modalRawTitle.startsWith('Đồ án tốt nghiệp của') || modalRawTitle.startsWith('Đề tài tốt nghiệp của');
                        const modalHasRealTitle = isModalOffered ? !!modalRawTitle : (!!modalRawTitle && !isModalDummy);
                        return modalHasRealTitle ? selectedProject.topic_title_vi : (
                          <span className="text-amber-600 font-semibold">⚠️ Chưa đăng ký tên đề tài</span>
                        );
                      })()}
                    </span>
                  </div>
                  {selectedProject.topic_title_en && (
                    <div className="eval-row">
                      <span className="eval-label">Tên tiếng Anh:</span>
                      <span className="eval-value italic text-slate-700">{selectedProject.topic_title_en}</span>
                    </div>
                  )}
                  <div className="eval-grid-2">
                    <div className="eval-row">
                      <span className="eval-label">GV Đề xuất / GVHD:</span>
                      <span className="eval-value font-semibold text-slate-800">
                        {formatFullName(selectedProject.supervisor_name) || 'Chưa phân công'}
                      </span>
                    </div>
                    <div className="eval-row">
                      <span className="eval-label">Lĩnh vực:</span>
                      <span className="eval-value text-slate-800">
                        {selectedProject.topic_category_name || 'Công nghệ thông tin'}
                      </span>
                    </div>
                  </div>
                  <div className="eval-row">
                    <span className="eval-label">Đối tượng:</span>
                    <span className="eval-value">
                      {!selectedProject.student || !selectedProject.student_reg_no ? (
                        <span className="utc-tag-offered">💡 Đề tài gợi ý mở (Chưa có nhóm nhận)</span>
                      ) : (
                        <span className="font-medium text-slate-800">
                          🎓 Sinh viên: {formatFullName(selectedProject.student_name)} ({selectedProject.student_reg_no})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Decision Selector */}
                <div className="utc-form-group">
                  <label className="utc-form-label">
                    1. Quyết định thẩm định của Hội đồng Khoa:
                  </label>
                  <div className="utc-decision-cards">
                    <div
                      className={`utc-decision-card card-approve ${evalDecision === 'APPROVE' ? 'selected' : ''}`}
                      onClick={() => setEvalDecision('APPROVE')}
                    >
                      <div className="decision-radio-icon">🟢</div>
                      <div>
                        <strong>Chấp thuận (Phê duyệt chính thức)</strong>
                        <p>Đề tài và đề cương đạt chuẩn. Mở quyền nộp báo cáo và sinh biểu mẫu đề cương chuẩn.</p>
                      </div>
                    </div>

                    <div
                      className={`utc-decision-card card-revision ${evalDecision === 'REQUEST_REVISION' ? 'selected' : ''}`}
                      onClick={() => setEvalDecision('REQUEST_REVISION')}
                    >
                      <div className="decision-radio-icon">🟡</div>
                      <div>
                        <strong>Yêu cầu chỉnh sửa lại</strong>
                        <p>Đề tài cần thu hẹp phạm vi, làm rõ kiến trúc công nghệ hoặc sửa đổi theo ý kiến của Khoa.</p>
                      </div>
                    </div>

                    <div
                      className={`utc-decision-card card-reject ${evalDecision === 'REJECT' ? 'selected' : ''}`}
                      onClick={() => setEvalDecision('REJECT')}
                    >
                      <div className="decision-radio-icon">🔴</div>
                      <div>
                        <strong>Từ chối đề tài</strong>
                        <p>Đề tài không phù hợp với chuẩn đào tạo hoặc trùng lặp. Yêu cầu chọn đề tài khác.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Feedback Presets */}
                <div className="utc-form-group">
                  <label className="utc-form-label">
                    2. Gợi ý góp ý nhanh (Bấm để chèn tự động):
                  </label>
                  <div className="utc-quick-presets">
                    {QUICK_FEEDBACK_TEMPLATES.map((tpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="utc-preset-chip"
                        onClick={() => {
                          setEvalNotes((prev) => (prev ? `${prev}\n${tpl}` : tpl));
                          if (tpl.startsWith('✅')) setEvalDecision('APPROVE');
                          else if (tpl.startsWith('❌')) setEvalDecision('REJECT');
                          else setEvalDecision('REQUEST_REVISION');
                        }}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Notes */}
                <div className="utc-form-group">
                  <label className="utc-form-label">
                    3. Ý kiến nhận xét & Hướng dẫn điều chỉnh chi tiết của Khoa:
                    {evalDecision !== 'APPROVE' && <span className="utc-required">*</span>}
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Nhập nội dung nhận xét chi tiết để Giảng viên và Sinh viên biết cách chỉnh sửa..."
                    value={evalNotes}
                    onChange={(e) => setEvalNotes(e.target.value)}
                    className="utc-textarea"
                    required={evalDecision !== 'APPROVE'}
                  />
                  <small className="utc-form-hint">
                    {evalDecision === 'APPROVE'
                      ? 'Nội dung phản hồi (tùy chọn) sẽ được lưu trữ vào biên bản thẩm định của Khoa.'
                      : 'Nội dung nhận xét này sẽ xuất hiện ngay lập tức trên trang cá nhân của GVHD & Sinh viên.'}
                  </small>
                </div>

                {/* Modal Footer */}
                <div className="utc-modal-foot">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(null)}
                    className="utc-btn-cancel"
                    disabled={submittingEval}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className={`utc-btn-submit ${evalDecision === 'APPROVE' ? 'btn-eval-approve' : evalDecision === 'REJECT' ? 'btn-eval-reject' : 'btn-eval-revision'}`}
                    disabled={submittingEval}
                  >
                    {submittingEval
                      ? 'Đang lưu kết quả...'
                      : evalDecision === 'APPROVE'
                      ? '✓ Xác Nhận Phê Duyệt Đề Tài'
                      : evalDecision === 'REJECT'
                      ? '❌ Xác Nhận Từ Chối Đề Tài'
                      : '⚠️ Gửi Góp Ý & Yêu Cầu Sửa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================================
         * MODAL: DOCUMENT PREVIEW (XEM FILE ĐỀ CƯƠNG PDF TRỰC TIẾP)
         * ============================================================================== */}
        {previewDocument && (
          <div className="utc-modal-backdrop" onClick={() => setPreviewDocument(null)}>
            <div className="utc-modal-card utc-preview-modal" onClick={(e) => e.stopPropagation()}>
              <div className="utc-modal-head">
                <div className="utc-modal-head-title">
                  <div className="utc-modal-icon">📄</div>
                  <div>
                    <h4>Xem File Đề Cương Chi Tiết ĐATN</h4>
                    <p className="utc-modal-sub">
                      {previewDocument.studentName && (
                        <span>Sinh viên: <strong>{previewDocument.studentName}</strong> ({previewDocument.regNo}) • </span>
                      )}
                      Đề tài: <em>{previewDocument.title}</em>
                    </p>
                  </div>
                </div>
                <div className="utc-preview-actions">
                  <a
                    href={previewDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="utc-btn-open-new-tab"
                  >
                    ↗ Mở tab mới
                  </a>
                  <button onClick={() => setPreviewDocument(null)} className="utc-btn-close">
                    ✕
                  </button>
                </div>
              </div>

              <div className="utc-preview-body">
                <iframe
                  src={previewDocument.url}
                  title="Xem Đề Cương"
                  className="utc-preview-iframe"
                />
              </div>

              <div className="utc-modal-foot">
                <button
                  type="button"
                  onClick={() => setPreviewDocument(null)}
                  className="utc-btn-cancel"
                >
                  Đóng bản xem trước
                </button>
                <a
                  href={previewDocument.url}
                  download
                  className="utc-btn-download-pdf"
                >
                  ⬇ Tải File PDF Về Máy
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
export default TopicApprovalPage;

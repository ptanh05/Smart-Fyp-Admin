import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
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

  const QUICK_FEEDBACK_TEMPLATES = [
    '✅ Đề tài đạt chuẩn, nội dung và phạm vi phù hợp với mục tiêu ĐATN Khoa CNTT.',
    '⚠️ Đề tài có phạm vi quá rộng, GV cần thu hẹp phạm vi và tập trung vào chức năng cốt lõi.',
    '⚠️ Cần làm rõ hơn kiến trúc công nghệ, framework và cơ sở dữ liệu sẽ áp dụng.',
    '⚠️ Tên đề tài chưa phản ánh đúng sản phẩm phần mềm đầu ra, đề nghị điều chỉnh lại tiêu đề.',
    '❌ Hướng đề tài bị trùng lặp với đề tài khác trong cùng đợt, đề nghị Giảng viên chọn bài toán khác.',
  ];

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
    const confirmMsg = isOffered
      ? `Khoa xác nhận CHẤP THUẬN đề tài gợi ý: "${proj.topic_title_vi}" của GV ${proj.supervisor_name}?\n\nSau khi duyệt, sinh viên trong đợt có thể đăng ký đề tài này.`
      : `Khoa xác nhận PHÊ DUYỆT đề tài: "${proj.topic_title_vi}" cho sinh viên ${proj.student_name} (${proj.student_reg_no})?`;

    if (!confirm(confirmMsg)) return;

    try {
      await apiClient.patch(`/admin/projects/${proj.id}/topic-approval/`, {
        decision: 'APPROVE',
        notes: '',
      });
      alert('Đã phê duyệt đề tài thành công!');
      fetchProjects();
    } catch (err: any) {
      alert('Lỗi phê duyệt: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Open Evaluation & Feedback Tool Modal
  const handleOpenEvaluationModal = (proj: ProjectTopic) => {
    setSelectedProject(proj);
    // default decision based on current state
    if (proj.topic_review_status === 'REVISION_REQUIRED') {
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
      alert('Đã lưu kết quả thẩm định và gửi phản hồi thành công!');
      setSelectedProject(null);
      fetchProjects();
    } catch (err: any) {
      alert('Lỗi gửi kết quả thẩm định: ' + (err.response?.data?.detail || err.message));
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
      alert('Lỗi tải phiếu giao đề tài!');
    }
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
    // Status filter
    if (statusFilter !== 'ALL' && p.topic_review_status !== statusFilter) {
      return false;
    }

    // Type filter
    const isOffered = !p.student || !p.student_reg_no;
    if (typeFilter === 'OFFERED' && !isOffered) return false;
    if (typeFilter === 'STUDENT' && isOffered) return false;

    // Search query
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

  return (
    <AdminLayout>
      <div className="utc-topics-portal">
        {/* Header Bar */}
        <div className="utc-topics-header-bar">
          <div className="utc-topics-header-info">
            <h3>Giai Đoạn 3: Phê Duyệt Đề Tài & Sinh Đề Cương ĐATN (Bước 22 & 23)</h3>
            <p>
              Công cụ thẩm định đề tài của Hội đồng Khoa: Xem xét đề tài gợi ý của GVHD và đề tài nhóm SV để Phê duyệt hoặc Gửi phản hồi yêu cầu sửa.
            </p>
          </div>

          <div className="utc-batch-select-group">
            <label>🎯 Chọn Đợt ĐATN:</label>
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
          </div>
        </div>

        {/* Status Counters */}
        <div className="utc-topic-stats-grid">
          <div
            className={`utc-topic-stat-box ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            <span className="stat-title">Tất cả đề tài</span>
            <span className="stat-number">{validProjects.length}</span>
          </div>

          <div
            className={`utc-topic-stat-box ${statusFilter === 'GV_CONFIRMED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('GV_CONFIRMED')}
          >
            <span className="stat-title">Chờ Khoa duyệt</span>
            <span className="stat-number text-amber">{countPending}</span>
          </div>

          <div
            className={`utc-topic-stat-box ${statusFilter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('APPROVED')}
          >
            <span className="stat-title">Khoa đã duyệt (Approved)</span>
            <span className="stat-number text-emerald">{countApproved}</span>
          </div>

          <div
            className={`utc-topic-stat-box ${statusFilter === 'REVISION_REQUIRED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('REVISION_REQUIRED')}
          >
            <span className="stat-title">Yêu cầu sửa lại</span>
            <span className="stat-number text-red">{countRevision}</span>
          </div>

          <div
            className={`utc-topic-stat-box ${statusFilter === 'DRAFT' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DRAFT')}
          >
            <span className="stat-title">Đang soạn nháp (Draft)</span>
            <span className="stat-number text-slate">{countDraft}</span>
          </div>
        </div>

        {/* Projects Table Card */}
        <div className="utc-topic-table-card">
          {/* Controls Bar: Type Tabs & Search */}
          <div className="utc-topic-controls-bar">
            {/* Subtabs: Type Selector */}
            <div className="utc-type-tabs">
              <button
                className={`utc-type-tab ${typeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTypeFilter('ALL')}
              >
                📑 Tất cả ({validProjects.length})
              </button>
              <button
                className={`utc-type-tab ${typeFilter === 'OFFERED' ? 'active' : ''}`}
                onClick={() => setTypeFilter('OFFERED')}
              >
                💡 Đề tài gợi ý của GV ({offeredProjects.length})
              </button>
              <button
                className={`utc-type-tab ${typeFilter === 'STUDENT' ? 'active' : ''}`}
                onClick={() => setTypeFilter('STUDENT')}
              >
                🎓 Đề tài nhóm SV ({studentProjects.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="utc-search-box">
              <input
                type="text"
                placeholder="Tìm theo tên đề tài, GVHD, SV..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="utc-search-clear" onClick={() => setSearch('')}>
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="utc-topic-table-head">
            <h4>
              Danh sách đề tài tốt nghiệp ({filteredProjects.length})
              {typeFilter === 'OFFERED' && <span className="utc-badge-sub"> - Đề xuất từ Giảng viên</span>}
              {typeFilter === 'STUDENT' && <span className="utc-badge-sub"> - Đồ án của Sinh viên</span>}
            </h4>
            <span className="text-muted">
              Sử dụng nút <strong>"✓ Duyệt"</strong> để duyệt nhanh hoặc <strong>"🏛️ Thẩm định & Phản hồi"</strong> để gửi góp ý chi tiết cho Giảng viên.
            </span>
          </div>

          {loading ? (
            <div className="utc-loading-text">Đang tải danh sách đề tài...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="utc-empty-text">Không có đề tài nào phù hợp với bộ lọc hiện tại.</div>
          ) : (
            <div className="utc-table-container">
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th>Đối Tượng / MSSV</th>
                    <th>Sinh Viên / Trạng Thái Nhận</th>
                    <th>Hệ ĐT</th>
                    <th>GV Đề Xuất / Hướng Dẫn</th>
                    <th>Tên Đề Tài & Lĩnh Vực</th>
                    <th>Trạng Thái Duyệt</th>
                    <th>Công Cụ Phê Duyệt Của Khoa</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const isOffered = !p.student || !p.student_reg_no;

                    return (
                      <tr key={p.id} className={isOffered ? 'row-offered-topic' : ''}>
                        {/* MSSV / Type Tag */}
                        <td>
                          {isOffered ? (
                            <span className="utc-tag-offered" title="Đề tài gợi ý do GV đề xuất">
                              💡 Đề tài gợi ý
                            </span>
                          ) : (
                            <span className="font-bold text-slate-800">{p.student_reg_no}</span>
                          )}
                        </td>

                        {/* Student Info */}
                        <td>
                          {isOffered ? (
                            <div>
                              <span className="utc-tag-open">🟢 Chưa có nhóm nhận</span>
                              <div className="text-xs text-muted mt-1">Đề tài mở cho SV đăng ký</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-900">{p.student_name}</div>
                              <div className="text-xs text-muted">{p.student_class || 'Khoa CNTT'}</div>
                            </div>
                          )}
                        </td>

                        {/* Program */}
                        <td>
                          {isOffered ? (
                            <span className="utc-tag-edu edu-all">🎓 CN / ⚙️ KS</span>
                          ) : (
                            <span className={`utc-tag-edu ${p.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                              {p.education_program === 'ENGINEER' ? '⚙️ Kỹ sư' : '🎓 Cử nhân'}
                            </span>
                          )}
                        </td>

                        {/* Supervisor */}
                        <td>
                          <div className="font-semibold text-slate-900">{p.supervisor_name || 'Chưa phân công'}</div>
                          {isOffered && <div className="text-xs text-muted">Cán bộ đề xuất</div>}
                        </td>

                        {/* Title & Category & Notes */}
                        <td style={{ maxWidth: '340px' }}>
                          <div className="font-semibold text-slate-900">{p.topic_title_vi}</div>
                          {p.topic_title_en && <div className="text-xs text-muted italic mt-0.5">{p.topic_title_en}</div>}
                          {p.topic_category_name && (
                            <div className="utc-category-tag mt-1">
                              📁 {p.topic_category_name}
                            </div>
                          )}
                          {p.topic_revision_notes && (
                            <div className="utc-revision-note-box">
                              <strong>💬 Phản hồi từ Khoa:</strong> {p.topic_revision_notes}
                            </div>
                          )}
                        </td>

                        {/* Review Status Badge */}
                        <td>
                          <span className={`utc-topic-badge badge-${(p.topic_review_status || 'draft').toLowerCase()}`}>
                            {p.topic_review_status === 'APPROVED'
                              ? '✅ Đã Duyệt'
                              : p.topic_review_status === 'GV_CONFIRMED'
                              ? '⏳ Chờ Khoa Duyệt'
                              : p.topic_review_status === 'REVISION_REQUIRED'
                              ? '⚠️ Yêu Cầu Sửa'
                              : '📝 Bản Nháp (Draft)'}
                          </span>
                        </td>

                        {/* Action Tool Buttons */}
                        <td>
                          <div className="utc-action-btn-group">
                            {p.topic_review_status !== 'APPROVED' && (
                              <button
                                onClick={() => handleQuickApprove(p)}
                                className="utc-btn-sm-approve"
                                title="Khoa xác nhận chấp thuận đề tài này"
                              >
                                ✓ Duyệt
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEvaluationModal(p)}
                              className="utc-btn-sm-eval"
                              title="Mở công cụ thẩm định và gửi phản hồi cho Giảng viên"
                            >
                              🏛️ Thẩm định & Phản hồi
                            </button>

                            {p.topic_review_status === 'APPROVED' && (
                              <button
                                onClick={() => handleDownloadOutline(p.id, p.student_reg_no)}
                                className="utc-btn-sm-outline"
                                title="Tải phiếu giao đề tài Word (.docx)"
                              >
                                📄 Tải Đề Cương
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
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card utc-eval-modal">
              <div className="utc-modal-head">
                <div>
                  <h4>🏛️ Công Cụ Thẩm Định & Phản Hồi Đề Tài (Khoa CNTT)</h4>
                  <p className="utc-modal-sub">
                    Đưa ra quyết định phê duyệt hoặc gửi phản hồi / yêu cầu chỉnh sửa trực tiếp tới Giảng viên hướng dẫn.
                  </p>
                </div>
                <button onClick={() => setSelectedProject(null)} className="utc-btn-close">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitEvaluation}>
                {/* Project Overview Card */}
                <div className="utc-eval-project-card">
                  <div className="eval-row">
                    <span className="eval-label">Tên đề tài:</span>
                    <span className="eval-value font-bold text-slate-900">{selectedProject.topic_title_vi}</span>
                  </div>
                  {selectedProject.topic_title_en && (
                    <div className="eval-row">
                      <span className="eval-label">Tên tiếng Anh:</span>
                      <span className="eval-value italic text-slate-700">{selectedProject.topic_title_en}</span>
                    </div>
                  )}
                  <div className="eval-grid-2">
                    <div className="eval-row">
                      <span className="eval-label">GV Đề xuất / Hướng dẫn:</span>
                      <span className="eval-value font-semibold text-slate-800">
                        {selectedProject.supervisor_name || 'Chưa phân công'}
                      </span>
                    </div>
                    <div className="eval-row">
                      <span className="eval-label">Lĩnh vực chuyên môn:</span>
                      <span className="eval-value text-slate-800">
                        {selectedProject.topic_category_name || 'Công nghệ thông tin'}
                      </span>
                    </div>
                  </div>
                  <div className="eval-row">
                    <span className="eval-label">Đối tượng đề tài:</span>
                    <span className="eval-value">
                      {!selectedProject.student || !selectedProject.student_reg_no ? (
                        <span className="utc-tag-offered">💡 Đề tài gợi ý mở (Chưa có nhóm nhận)</span>
                      ) : (
                        <span className="font-medium text-slate-800">
                          🎓 Sinh viên: {selectedProject.student_name} ({selectedProject.student_reg_no})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Decision Selector */}
                <div className="utc-form-group">
                  <label className="font-bold text-slate-800">1. Quyết định của Hội đồng Khoa:</label>
                  <div className="utc-decision-cards">
                    <div
                      className={`utc-decision-card card-approve ${evalDecision === 'APPROVE' ? 'selected' : ''}`}
                      onClick={() => setEvalDecision('APPROVE')}
                    >
                      <div className="decision-radio-icon">🟢</div>
                      <div>
                        <strong>Chấp thuận (Phê duyệt)</strong>
                        <p>Đề tài đạt chuẩn đào tạo. Mở quyền cho SV đăng ký hoặc sinh phiếu đề cương.</p>
                      </div>
                    </div>

                    <div
                      className={`utc-decision-card card-revision ${evalDecision === 'REQUEST_REVISION' ? 'selected' : ''}`}
                      onClick={() => setEvalDecision('REQUEST_REVISION')}
                    >
                      <div className="decision-radio-icon">🟡</div>
                      <div>
                        <strong>Yêu cầu chỉnh sửa lại</strong>
                        <p>Đề tài cần điều chỉnh phạm vi, công nghệ hoặc nội dung theo góp ý của Khoa.</p>
                      </div>
                    </div>

                    <div
                      className={`utc-decision-card card-reject ${evalDecision === 'REJECT' ? 'selected' : ''}`}
                      onClick={() => setEvalDecision('REJECT')}
                    >
                      <div className="decision-radio-icon">🔴</div>
                      <div>
                        <strong>Từ chối đề tài</strong>
                        <p>Đề tài không phù hợp hoặc trùng lặp. Yêu cầu Giảng viên đổi đề tài khác.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Feedback Presets */}
                <div className="utc-form-group">
                  <label className="font-bold text-slate-800">2. Gợi ý phản hồi nhanh (Nhấp để chọn):</label>
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
                  <label className="font-bold text-slate-800">
                    3. Ý kiến nhận xét & Hướng dẫn điều chỉnh chi tiết của Khoa:
                    {evalDecision !== 'APPROVE' && <span className="text-red-500"> *</span>}
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Nhập nội dung phản hồi, nhận xét cụ thể để Giảng viên và Sinh viên biết cách chỉnh sửa..."
                    value={evalNotes}
                    onChange={(e) => setEvalNotes(e.target.value)}
                    className="utc-input"
                    required={evalDecision !== 'APPROVE'}
                  />
                  <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                    {evalDecision === 'APPROVE'
                      ? 'Nội dung phản hồi (tùy chọn) sẽ được ghi nhận và hiển thị cho Giảng viên.'
                      : 'Nội dung phản hồi này sẽ xuất hiện ngay trên giao diện của Giảng viên và Nhóm sinh viên.'}
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
                      ? 'Đang gửi...'
                      : evalDecision === 'APPROVE'
                      ? '✓ Xác Nhận Phê Duyệt Đề Tài'
                      : evalDecision === 'REJECT'
                      ? '❌ Xác Nhận Từ Chối Đề Tài'
                      : '⚠️ Gửi Yêu Cầu Chỉnh Sửa Cho GV'}
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

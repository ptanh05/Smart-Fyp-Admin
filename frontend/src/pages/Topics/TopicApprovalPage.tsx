import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './TopicApprovalPage.css';

interface ProjectTopic {
  id: number;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  education_program: string;
  supervisor_name: string;
  topic_title_vi: string;
  topic_title_en: string;
  topic_review_status: 'DRAFT' | 'GV_CONFIRMED' | 'APPROVED' | 'REVISION_REQUIRED';
  topic_revision_notes: string;
  status: string;
}

export const TopicApprovalPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal Request Revision
  const [revisionProject, setRevisionProject] = useState<ProjectTopic | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');

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

  const handleApprove = async (projId: number) => {
    if (!confirm('Khoa xác nhận PHÊ DUYỆT đề tài tốt nghiệp này? Sau khi duyệt, hệ thống sẽ mở quyền sinh Phiếu giao đề tài/Đề cương.')) return;
    try {
      await apiClient.patch(`/admin/projects/${projId}/topic-approval/`, {
        decision: 'APPROVE',
      });
      alert('Phê duyệt đề tài thành công!');
      fetchProjects();
    } catch (err: any) {
      alert('Lỗi phê duyệt: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenRevision = (proj: ProjectTopic) => {
    setRevisionProject(proj);
    setRevisionNotes(proj.topic_revision_notes || '');
  };

  const handleSendRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionProject || !revisionNotes.trim()) return;

    try {
      await apiClient.patch(`/admin/projects/${revisionProject.id}/topic-approval/`, {
        decision: 'REQUEST_REVISION',
        notes: revisionNotes.trim(),
      });
      alert('Đã gửi yêu cầu chỉnh sửa đề tài về trạng thái Draft cho GV và SV.');
      setRevisionProject(null);
      fetchProjects();
    } catch (err: any) {
      alert('Lỗi gửi yêu cầu: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDownloadOutline = async (projId: number, regNo: string) => {
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
      a.download = `Phieu_giao_de_tai_${regNo}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi tải phiếu giao đề tài!');
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.topic_review_status === statusFilter;
  });

  const countPending = projects.filter((p) => p.topic_review_status === 'GV_CONFIRMED').length;
  const countApproved = projects.filter((p) => p.topic_review_status === 'APPROVED').length;
  const countRevision = projects.filter((p) => p.topic_review_status === 'REVISION_REQUIRED').length;
  const countDraft = projects.filter((p) => p.topic_review_status === 'DRAFT').length;

  return (
    <AdminLayout>
      <div className="utc-topics-portal">
        {/* Header Bar */}
        <div className="utc-topics-header-bar">
          <div className="utc-topics-header-info">
            <h3>Giai Đoạn 3: Phê Duyệt Đề Tài & Sinh Đề Cương ĐATN (Bước 22 & 23)</h3>
            <p>Hội đồng Khoa/Ban xem xét đề tài do GV & SV gửi lên: Duyệt (Approved) hoặc Yêu cầu sửa về Draft</p>
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
            <span className="stat-number">{projects.length}</span>
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

        {/* Projects Table */}
        <div className="utc-topic-table-card">
          <div className="utc-topic-table-head">
            <h4>Danh sách Đề tài đồ án tốt nghiệp ({filteredProjects.length})</h4>
            <span className="text-muted">Nhấn "Phê duyệt" để chấp thuận đề tài hoặc "Yêu cầu sửa"</span>
          </div>

          {loading ? (
            <div className="utc-loading-text">Đang tải danh sách đề tài...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="utc-empty-text">Không có đề tài nào phù hợp với bộ lọc.</div>
          ) : (
            <div className="utc-table-container">
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th>MSSV</th>
                    <th>Sinh Viên</th>
                    <th>Hệ ĐT</th>
                    <th>GV Hướng Dẫn</th>
                    <th>Tên Đề Tài Tốt Nghiệp</th>
                    <th>Trạng Thái Duyệt</th>
                    <th>Hành Động Của Khoa</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
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
                      <td>
                        <span className="font-medium text-slate-800">{p.supervisor_name}</span>
                      </td>
                      <td style={{ maxWidth: '320px' }}>
                        <div className="font-semibold text-slate-900">{p.topic_title_vi}</div>
                        {p.topic_title_en && <div className="text-xs text-muted italic">{p.topic_title_en}</div>}
                        {p.topic_revision_notes && (
                          <div className="utc-revision-note-box">
                            <strong>Lý do sửa:</strong> {p.topic_revision_notes}
                          </div>
                        )}
                      </td>
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
                      <td>
                        <div className="utc-action-btn-group">
                          {p.topic_review_status !== 'APPROVED' && (
                            <button
                              onClick={() => handleApprove(p.id)}
                              className="utc-btn-sm-approve"
                              title="Khoa phê duyệt đề tài"
                            >
                              ✓ Duyệt
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenRevision(p)}
                            className="utc-btn-sm-reject"
                            title="Yêu cầu sửa đề tài, trả về Draft"
                          >
                            ✎ Yêu cầu sửa
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL: REQUEST REVISION */}
        {revisionProject && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>⚠️ Yêu Cầu Chỉnh Sửa Đề Tài ĐATN (Bước 22)</h4>
                <button onClick={() => setRevisionProject(null)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleSendRevision}>
                <div className="utc-form-group">
                  <p>Sinh viên: <strong>{revisionProject.student_name}</strong> ({revisionProject.student_reg_no})</p>
                  <p>Đề tài: <strong>{revisionProject.topic_title_vi}</strong></p>
                  <p>GVHD: <strong>{revisionProject.supervisor_name}</strong></p>
                </div>

                <div className="utc-form-group">
                  <label>Ghi chú lý do yêu cầu chỉnh sửa (sẽ gửi cho GV & SV):</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="VD: Đề tài quá rộng, cần thu hẹp phạm vi; Tiêu đề cần sát với nội dung công nghệ đã đăng ký..."
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    className="utc-input"
                  />
                  <small style={{ color: '#64748b' }}>
                    Sau khi gửi yêu cầu, đề tài sẽ tự động quay về trạng thái Draft (Bước 20) để GV & SV chỉnh sửa.
                  </small>
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setRevisionProject(null)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-warning">Gửi Yêu Cầu Sửa</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

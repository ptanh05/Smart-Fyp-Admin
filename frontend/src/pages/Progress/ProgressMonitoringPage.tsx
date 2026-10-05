import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './ProgressMonitoringPage.css';

interface ProjectProgress {
  id: number;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  education_program: string;
  supervisor_name: string;
  topic_title_vi: string;
  status: string;
  topic_review_status: string;
  supervisor_defense_confirmed: boolean;
  is_eligible_for_defense: boolean;
  created_at: string;
}

export const ProgressMonitoringPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filtered = projects.filter((p) => {
    const s = searchTerm.toLowerCase();
    return (
      p.student_name.toLowerCase().includes(s) ||
      p.student_reg_no.toLowerCase().includes(s) ||
      p.topic_title_vi.toLowerCase().includes(s) ||
      p.supervisor_name.toLowerCase().includes(s)
    );
  });

  const countInProgress = projects.filter((p) => p.status === 'IN_PROGRESS' || p.status === 'OUTLINE_APPROVED').length;
  const countDefenseReady = projects.filter((p) => p.status === 'DEFENSE_READY' || p.is_eligible_for_defense).length;
  const countDeferred = projects.filter((p) => p.status === 'DEFERRED').length;

  return (
    <AdminLayout>
      <div className="utc-progress-portal">
        {/* Header Bar */}
        <div className="utc-progress-header-bar">
          <div className="utc-progress-header-info">
            <h3>Giai Đoạn 5: Giám Sát Tiến Độ Thực Hiện Đồ Án Tốt Nghiệp</h3>
            <p>Khoa theo dõi tiến độ tổng thể các nhóm đồ án, tình trạng hoàn thành task và đánh giá của Giảng viên</p>
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
          </div>
        </div>

        {/* Progress Metric Cards */}
        <div className="utc-prog-metric-grid">
          <div className="utc-prog-card">
            <span className="prog-label">Tổng Số Đồ Án</span>
            <span className="prog-num">{projects.length}</span>
            <span className="prog-sub">Nhóm sinh viên đang làm</span>
          </div>
          <div className="utc-prog-card">
            <span className="prog-label">Đang Triển Khai Thực Hiện</span>
            <span className="prog-num text-blue">{countInProgress}</span>
            <span className="prog-sub">Làm việc tuần với GVHD</span>
          </div>
          <div className="utc-prog-card">
            <span className="prog-label">Đủ Điều Kiện Bảo Vệ</span>
            <span className="prog-num text-emerald">{countDefenseReady}</span>
            <span className="prog-sub">GV duyệt chuyển sang GĐ6</span>
          </div>
          <div className="utc-prog-card">
            <span className="prog-label">Bảo Lưu Đồ Án</span>
            <span className="prog-num text-amber">{countDeferred}</span>
            <span className="prog-sub">Khoa đã tiếp nhận & duyệt</span>
          </div>
        </div>

        {/* Search & Project Table */}
        <div className="utc-prog-table-card">
          <div className="utc-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>Theo Dõi Chi Tiết Tiến Độ ({filtered.length})</h4>
            <input
              type="text"
              placeholder="🔍 Tìm kiếm sinh viên, GVHD, đề tài..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="utc-input"
              style={{ width: '320px' }}
            />
          </div>

          {loading ? (
            <div className="utc-loading-text">Đang tải tiến độ...</div>
          ) : filtered.length === 0 ? (
            <div className="utc-empty-text">Không tìm thấy đồ án nào.</div>
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
                    <th>Tiến Trình Đồ Án</th>
                    <th>Đánh Giá Của GVHD</th>
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
                      <td>
                        <span className="font-medium text-slate-800">{p.supervisor_name}</span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        <div className="font-semibold text-slate-900">{p.topic_title_vi}</div>
                      </td>
                      <td>
                        <span className="utc-stage-pill">{p.status}</span>
                      </td>
                      <td>
                        <span className={`utc-pill ${p.supervisor_defense_confirmed ? 'pill-green' : 'pill-amber'}`}>
                          {p.supervisor_defense_confirmed ? '✅ Đủ Khả Năng BV' : '⏳ Đang Thực Hiện'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './DefenseManagementPage.css';

interface ProjectAdmin {
  id: number;
  student: number;
  student_name: string;
  student_reg_no: string;
  student_class: string;
  supervisor_name: string;
  reviewer_name: string;
  council: number | null;
  council_name: string;
  topic_title_vi: string;
  status: string;
  supervisor_score: number | null;
  reviewer_score: number | null;
  final_score_10: number | null;
  final_letter_grade: string;
  is_passed: boolean;
}

export const DefenseManagementPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [councils, setCouncils] = useState<any[]>([]);
  const [selectedCouncilId, setSelectedCouncilId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [projects, setProjects] = useState<ProjectAdmin[]>([]);
  const [loading, setLoading] = useState(true);

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
      let url = `/admin/projects/?batch_id=${selectedBatchId}`;
      if (selectedCouncilId) {
        url += `&council_id=${selectedCouncilId}`;
      }
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }

      const [counRes, projRes] = await Promise.all([
        apiClient.get(`/admin/councils/?batch_id=${selectedBatchId}`),
        apiClient.get(url),
      ]);
      setCouncils(Array.isArray(counRes.data) ? counRes.data : (counRes.data?.results || []));
      setProjects(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.results || []));
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
  }, [selectedBatchId, selectedCouncilId, statusFilter]);

  const handleDownloadToTrinhDocx = async () => {
    if (!selectedCouncilId) {
      alert('Vui lòng chọn một Hội đồng cụ thể để xuất Tờ trình Word!');
      return;
    }
    try {
      const res = await apiClient.get(`/admin/export/to-trinh-word/?council_id=${selectedCouncilId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `To_trinh_Hoi_dong_${selectedCouncilId}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi tải file Tờ trình Word: ' + JSON.stringify(err));
    }
  };

  const handleDownloadBienBanExcel = async () => {
    if (!selectedCouncilId) {
      alert('Vui lòng chọn một Hội đồng cụ thể để xuất Bảng điểm Excel!');
      return;
    }
    try {
      const res = await apiClient.get(`/admin/export/bien-ban-excel/?council_id=${selectedCouncilId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

  return (
    <AdminLayout>
      <div className="utc-defense-portal">
        {/* Filters & Actions */}
        <div className="utc-defense-header-bar">
          <div className="utc-defense-filters-group">
            <div className="utc-defense-filter-item">
              <label>Đợt ĐATN</label>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="utc-form-select"
                style={{ minWidth: '180px' }}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="utc-defense-filter-item">
              <label>Lọc theo Hội đồng</label>
              <select
                value={selectedCouncilId}
                onChange={(e) => setSelectedCouncilId(e.target.value)}
                className="utc-form-select"
                style={{ minWidth: '220px' }}
              >
                <option value="">-- Tất cả Hội đồng --</option>
                {councils.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.council_name} (Phòng: {c.defense_room || 'TBA'})
                  </option>
                ))}
              </select>
            </div>

            <div className="utc-defense-filter-item">
              <label>Trạng thái</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="utc-form-select"
                style={{ minWidth: '180px' }}
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="ALLOCATED">Đã phân GVHD</option>
                <option value="OUTLINE_APPROVED">Đề cương đã duyệt</option>
                <option value="DEFENSE_READY">Đủ điều kiện bảo vệ</option>
                <option value="PASSED">Bảo vệ Đạt</option>
                <option value="FAILED">Không đạt</option>
              </select>
            </div>
          </div>

          <div className="utc-defense-actions-group">
            <button
              onClick={handleDownloadToTrinhDocx}
              className="utc-btn-primary"
              title="Xuất Tờ trình thành lập Hội đồng theo biểu mẫu Word .docx chuẩn UTC"
            >
              <span>📄</span> Xuất Tờ trình (.docx)
            </button>
            <button
              onClick={handleDownloadBienBanExcel}
              className="utc-btn-emerald"
              title="Xuất Bảng điểm tổng hợp ĐATN chuẩn quy chế tín chỉ UTC"
            >
              <span>📊</span> Xuất Bảng điểm (.xlsx)
            </button>
          </div>
        </div>

        {/* Defense Projects Table */}
        <div className="utc-table-card">
          <div className="utc-table-card-head">
            <h3>
              Danh sách Sinh viên & Kết quả Bảo vệ ĐATN ({projects.length} sinh viên)
            </h3>
            <span>Trọng số UTC: GVHD (40%) + GVPB (20%) + HĐ (40%)</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Đang tải danh sách đồ án bảo vệ...</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Chưa có dữ liệu đồ án nào trong đợt này.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>MSSV</th>
                    <th>Họ và tên</th>
                    <th>Lớp</th>
                    <th>Tên đề tài đồ án</th>
                    <th>GVHD</th>
                    <th>GVPB</th>
                    <th>Hội đồng</th>
                    <th style={{ textAlign: 'center' }}>GVHD (40%)</th>
                    <th style={{ textAlign: 'center' }}>GVPB (20%)</th>
                    <th style={{ textAlign: 'center' }}>Điểm 10</th>
                    <th style={{ textAlign: 'center' }}>Chữ</th>
                    <th style={{ textAlign: 'center' }}>Kết luận</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, idx) => {
                    return (
                      <tr key={p.id}>
                        <td style={{ color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{p.student_reg_no}</td>
                        <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                        <td style={{ color: '#64748b' }}>{p.student_class}</td>
                        <td style={{ maxWidth: '280px', fontWeight: 500 }} title={p.topic_title_vi}>
                          {p.topic_title_vi}
                        </td>
                        <td>{p.supervisor_name}</td>
                        <td>{p.reviewer_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa gán</span>}</td>
                        <td>{p.council_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa gán</span>}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.supervisor_score !== null ? p.supervisor_score : '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.reviewer_score !== null ? p.reviewer_score : '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#d97706', fontSize: '0.95rem' }}>
                          {p.final_score_10 !== null ? p.final_score_10 : '-'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>
                          {p.final_letter_grade || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {p.status === 'PASSED' ? (
                            <span className="utc-badge-passed">ĐẠT</span>
                          ) : p.status === 'FAILED' ? (
                            <span className="utc-badge-failed">KHÔNG ĐẠT</span>
                          ) : (
                            <span className="utc-badge-status">{p.status}</span>
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
      </div>
    </AdminLayout>
  );
};

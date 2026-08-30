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
  supervisor: number;
  supervisor_name: string;
  topic_title_vi: string;
  status: string;
}

export const AllocationsPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [quotas, setQuotas] = useState<SupervisorQuota[]>([]);
  const [projects, setProjects] = useState<ProjectAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);

  // Manual Assign Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualSupervisorId, setManualSupervisorId] = useState('');

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

  const handleRunMCMF = async () => {
    if (!selectedBatchId) return;
    if (!confirm('Bạn có chắc chắn muốn chạy thuật toán phân GVHD tự động (MCMF Matching)?')) return;

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

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStudentId || !manualSupervisorId || !selectedBatchId) return;

    try {
      await apiClient.patch('/admin/allocations/manual/', {
        student_id: Number(manualStudentId),
        supervisor_id: Number(manualSupervisorId),
        batch_id: selectedBatchId,
      });
      alert('Phân công thủ công thành công!');
      setShowManualModal(false);
      setManualStudentId('');
      setManualSupervisorId('');
      fetchData();
    } catch (err: any) {
      alert('Lỗi phân công: ' + (err.response?.data?.detail || err.message));
    }
  };

  const totalQuotaVA = quotas.reduce((s, q) => s + (q.viet_anh_quota || 0), 0);
  const totalQuotaCNTT = quotas.reduce((s, q) => s + (q.general_cntt_quota || 0), 0);
  const totalQuota = quotas.reduce((s, q) => s + (q.max_total_quota || 0), 0);
  const totalAssigned = quotas.reduce((s, q) => s + (q.current_assigned || 0), 0);

  return (
    <AdminLayout>
      <div className="utc-allocations-portal">
        {/* Batch Selector & Actions */}
        <div className="utc-allocations-header-bar">
          <div className="utc-batch-select-group">
            <label>🎯 Chọn Đợt ĐATN:</label>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="utc-form-select"
              style={{ minWidth: '240px' }}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_name} ({b.batch_code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowManualModal(true)}
              className="utc-btn-cancel"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>✏️</span> Phân công thủ công
            </button>
            <button
              onClick={handleRunMCMF}
              disabled={matching}
              className="utc-btn-primary"
            >
              <span>⚡</span> {matching ? 'Đang giải bài toán MCMF...' : 'Khởi chạy MCMF Auto-Match'}
            </button>
          </div>
        </div>

        {/* Quota Metric Summary Cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Đang tải dữ liệu phân công...</div>
        ) : (
          <div className="utc-quota-cards-grid">
            <div className="utc-quota-card">
              <span className="utc-quota-card-label">Chỉ tiêu CLC Việt - Anh</span>
              <span className="utc-quota-card-val blue">{totalQuotaVA} SV</span>
            </div>
            <div className="utc-quota-card">
              <span className="utc-quota-card-label">Chỉ tiêu CNTT Đại trà & KHMT</span>
              <span className="utc-quota-card-val indigo">{totalQuotaCNTT} SV</span>
            </div>
            <div className="utc-quota-card">
              <span className="utc-quota-card-label">Tổng định mức toàn Khoa</span>
              <span className="utc-quota-card-val amber">{totalQuota} SV</span>
            </div>
            <div className="utc-quota-card">
              <span className="utc-quota-card-label">Đã phân công thực tế</span>
              <span className="utc-quota-card-val emerald">{totalAssigned} / {totalQuota} SV</span>
            </div>
          </div>
        )}

        {/* Match Result Banner */}
        {matchResult && (
          <div className="utc-match-banner">
            <div className="utc-match-banner-title">
              <span>✅</span> Phân công MCMF hoàn tất: Đã khớp {matchResult.matched_count} / {matchResult.total_students} sinh viên!
            </div>
            {matchResult.unassigned_count > 0 && (
              <p className="utc-match-banner-sub">
                Có {matchResult.unassigned_count} sinh viên chưa thể xếp do vượt quota. Hãy sử dụng phân công thủ công hoặc mở thêm chỉ tiêu.
              </p>
            )}
          </div>
        )}

        {/* Quotas & Lecturers Table */}
        <div className="utc-table-card">
          <div className="utc-table-card-head">
            <h3>Định mức Quota Giảng viên Khoa CNTT</h3>
            <span>{quotas.length} Giảng viên</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="utc-custom-table">
              <thead>
                <tr>
                  <th>Mã GV</th>
                  <th>Họ và tên Giảng viên</th>
                  <th>Bộ môn</th>
                  <th style={{ textAlign: 'center' }}>Quota VA</th>
                  <th style={{ textAlign: 'center' }}>Quota CNTT</th>
                  <th style={{ textAlign: 'center' }}>Tổng Quota</th>
                  <th style={{ textAlign: 'center' }}>Đã nhận</th>
                  <th>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {quotas.map((q) => {
                  const isFull = q.current_assigned >= q.max_total_quota && q.max_total_quota > 0;
                  return (
                    <tr key={q.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{q.supervisor_id_code}</td>
                      <td style={{ fontWeight: 600 }}>{q.supervisor_name}</td>
                      <td>{q.department || 'Khoa CNTT'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{q.viet_anh_quota}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{q.general_cntt_quota}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#d97706' }}>{q.max_total_quota}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{q.current_assigned}</td>
                      <td>
                        {isFull ? (
                          <span className="utc-badge-full">Đã đủ Quota</span>
                        ) : (
                          <span className="utc-badge-available">Còn nhận {q.max_total_quota - q.current_assigned} SV</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Allocated Projects Table */}
        <div className="utc-table-card">
          <div className="utc-table-card-head">
            <h3>Danh Sách Đồ Án Đã Được Phân Công ({projects.length} đề tài)</h3>
            <span>Đợt ĐATN hiện tại</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="utc-custom-table">
              <thead>
                <tr>
                  <th>MSSV</th>
                  <th>Họ và Tên Sinh Viên</th>
                  <th>Lớp Học Phần</th>
                  <th>Tên Đề Tài Đồ Án</th>
                  <th>Giảng Viên Hướng Dẫn</th>
                  <th>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Chưa có sinh viên nào được phân công đề tài trong đợt này.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{p.student_reg_no}</td>
                      <td style={{ fontWeight: 600 }}>{p.student_name}</td>
                      <td>{p.student_class}</td>
                      <td style={{ maxWidth: '280px', fontWeight: 500 }} title={p.topic_title_vi}>
                        {p.topic_title_vi}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{p.supervisor_name}</td>
                      <td>
                        <span className="utc-badge-available">{p.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Manual Assign */}
        {showManualModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-box">
              <h3>Phân công Giảng viên Hướng dẫn Thủ công</h3>
              <p>Chỉ định trực tiếp Giảng viên hướng dẫn cho Sinh viên.</p>
              <form onSubmit={handleManualAssign}>
                <div className="utc-form-group">
                  <label>ID Sinh viên (Student ID)</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 101"
                    value={manualStudentId}
                    onChange={(e) => setManualStudentId(e.target.value)}
                    className="utc-form-input"
                  />
                </div>
                <div className="utc-form-group">
                  <label>ID Giảng viên (Supervisor ID)</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 12"
                    value={manualSupervisorId}
                    onChange={(e) => setManualSupervisorId(e.target.value)}
                    className="utc-form-input"
                  />
                </div>
                <div className="utc-modal-footer">
                  <button type="button" onClick={() => setShowManualModal(false)} className="utc-btn-cancel">
                    Hủy
                  </button>
                  <button type="submit" className="utc-btn-primary">
                    Xác nhận phân công
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

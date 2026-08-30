import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { apiClient } from '../../api/client';

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

  const totalQuotaVA = quotas.reduce((s, q) => s + q.viet_anh_quota, 0);
  const totalQuotaCNTT = quotas.reduce((s, q) => s + q.general_cntt_quota, 0);
  const totalQuota = quotas.reduce((s, q) => s + q.max_total_quota, 0);
  const totalAssigned = quotas.reduce((s, q) => s + q.current_assigned, 0);

  return (
    <AdminLayout title="Phân Giảng viên Hướng dẫn (Min-Cost Max-Flow Matching)">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Batch Selector & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400">Đợt ĐATN:</label>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_name} ({b.batch_code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold transition border border-slate-700 flex items-center gap-2"
            >
              <span>✏️</span> Phân công thủ công
            </button>
            <button
              onClick={handleRunMCMF}
              disabled={matching}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-600/30 disabled:opacity-50 flex items-center gap-2"
            >
              <span>⚡</span> {matching ? 'Đang giải bài toán MCMF...' : 'Khởi chạy MCMF Auto-Match'}
            </button>
          </div>
        </div>

        {/* Quota Metric Summary Cards */}
        {loading ? (
          <div className="text-center py-8 text-slate-400">Đang tải dữ liệu phân công...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Chỉ tiêu CLC Việt - Anh</span>
            <p className="text-xl font-bold text-blue-400 mt-1">{totalQuotaVA} SV</p>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Chỉ tiêu CNTT Đại trà & KHMT</span>
            <p className="text-xl font-bold text-indigo-400 mt-1">{totalQuotaCNTT} SV</p>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Tổng định mức toàn Khoa</span>
            <p className="text-xl font-bold text-amber-400 mt-1">{totalQuota} SV</p>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Đã phân công thực tế</span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{totalAssigned} / {totalQuota} SV</p>
          </div>
        </div>
        )}

        {/* Match Result Banner */}
        {matchResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/30 text-sm space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span>✅</span> Phân công MCMF hoàn tất: Đã khớp {matchResult.matched_count} / {matchResult.total_students} sinh viên!
            </div>
            {matchResult.unassigned_count > 0 && (
              <p className="text-amber-400 text-xs">
                Có {matchResult.unassigned_count} sinh viên chưa thể xếp do vượt quota. Hãy sử dụng phân công thủ công hoặc mở thêm chỉ tiêu.
              </p>
            )}
          </div>
        )}

        {/* Quotas & Lecturers Table */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">Định mức Quota 33 Giảng viên Khoa CNTT</h3>
            <span className="text-xs text-slate-400">{quotas.length} Giảng viên</span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 sticky top-0 uppercase font-semibold">
                <tr>
                  <th className="p-3">Mã GV</th>
                  <th className="p-3">Họ và tên Giảng viên</th>
                  <th className="p-3">Bộ môn</th>
                  <th className="p-3 text-center">Quota VA</th>
                  <th className="p-3 text-center">Quota CNTT</th>
                  <th className="p-3 text-center">Tổng Quota</th>
                  <th className="p-3 text-center">Đã nhận</th>
                  <th className="p-3">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {quotas.map((q) => {
                  const isFull = q.current_assigned >= q.max_total_quota && q.max_total_quota > 0;
                  return (
                    <tr key={q.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-mono text-slate-400">{q.supervisor_id_code}</td>
                      <td className="p-3 font-medium text-slate-100">{q.supervisor_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {q.department || 'Bộ môn'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold">{q.viet_anh_quota}</td>
                      <td className="p-3 text-center font-semibold">{q.general_cntt_quota}</td>
                      <td className="p-3 text-center font-bold text-amber-400">{q.max_total_quota}</td>
                      <td className="p-3 text-center font-bold text-emerald-400">{q.current_assigned}</td>
                      <td className="p-3">
                        {isFull ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                            Đã đủ Quota
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Còn {q.max_total_quota - q.current_assigned} chỗ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assigned Projects Table */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">Danh sách Đồ án đã được phân công ({projects.length} đề tài)</h3>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 sticky top-0 uppercase font-semibold">
                <tr>
                  <th className="p-3">MSSV</th>
                  <th className="p-3">Sinh viên</th>
                  <th className="p-3">Lớp học phần</th>
                  <th className="p-3">Tên đề tài đồ án</th>
                  <th className="p-3">Giảng viên hướng dẫn</th>
                  <th className="p-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-mono text-blue-400">{p.student_reg_no}</td>
                    <td className="p-3 font-medium text-slate-100">{p.student_name}</td>
                    <td className="p-3 text-slate-400">{p.student_class}</td>
                    <td className="p-3 font-medium text-slate-200">{p.topic_title_vi}</td>
                    <td className="p-3 font-semibold text-emerald-400">{p.supervisor_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Manual Assign */}
        {showManualModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Phân công Giảng viên Hướng dẫn</h3>
              <form onSubmit={handleManualAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">ID Sinh viên</label>
                  <input
                    type="number"
                    required
                    placeholder="Nhập ID sinh viên"
                    value={manualStudentId}
                    onChange={(e) => setManualStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Chọn Giảng viên hướng dẫn</label>
                  <select
                    value={manualSupervisorId}
                    onChange={(e) => setManualSupervisorId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {quotas.map((q) => (
                      <option key={q.supervisor} value={q.supervisor}>
                        {q.supervisor_name} ({q.department}) - Đã nhận: {q.current_assigned}/{q.max_total_quota}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition"
                  >
                    Lưu phân công
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

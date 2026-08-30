import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { apiClient } from '../../api/client';

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
    <AdminLayout title="Quản lý Bảo vệ ĐATN & Xuất Văn bản Hành chính (Word / Excel)">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Đợt ĐATN:</label>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Lọc theo Hội đồng:</label>
              <select
                value={selectedCouncilId}
                onChange={(e) => setSelectedCouncilId(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Tất cả Hội đồng --</option>
                {councils.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.council_name} (Phòng: {c.defense_room || 'TBA'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Trạng thái:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500"
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

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadToTrinhDocx}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition shadow-md shadow-blue-700/30 flex items-center gap-2"
              title="Xuất Tờ trình thành lập Hội đồng theo biểu mẫu Word .docx chuẩn UTC"
            >
              <span>📄</span> Xuất Tờ trình (.docx)
            </button>
            <button
              onClick={handleDownloadBienBanExcel}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition shadow-md shadow-emerald-700/30 flex items-center gap-2"
              title="Xuất Bảng điểm tổng hợp ĐATN chuẩn quy chế tín chỉ UTC"
            >
              <span>📊</span> Xuất Bảng điểm (.xlsx)
            </button>
          </div>
        </div>

        {/* Defense Projects Table */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">
              Danh sách Sinh viên & Kết quả Bảo vệ ĐATN ({projects.length} sinh viên)
            </h3>
            <span className="text-xs text-slate-400">Trọng số UTC: GVHD (40%) + GVPB (20%) + HĐ (40%)</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400">Đang tải danh sách đồ án bảo vệ...</div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 sticky top-0 uppercase font-semibold">
                <tr>
                  <th className="p-3">STT</th>
                  <th className="p-3">MSSV</th>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3">Lớp</th>
                  <th className="p-3">Tên đề tài đồ án</th>
                  <th className="p-3">GVHD</th>
                  <th className="p-3">GVPB</th>
                  <th className="p-3">Hội đồng</th>
                  <th className="p-3 text-center">GVHD (40%)</th>
                  <th className="p-3 text-center">GVPB (20%)</th>
                  <th className="p-3 text-center">Điểm 10</th>
                  <th className="p-3 text-center">Chữ</th>
                  <th className="p-3 text-center">Kết luận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {projects.map((p, idx) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-semibold text-blue-400">{p.student_reg_no}</td>
                      <td className="p-3 font-medium text-slate-100">{p.student_name}</td>
                      <td className="p-3 text-slate-400">{p.student_class}</td>
                      <td className="p-3 font-medium text-slate-200 max-w-xs truncate" title={p.topic_title_vi}>
                        {p.topic_title_vi}
                      </td>
                      <td className="p-3 text-slate-300">{p.supervisor_name}</td>
                      <td className="p-3 text-slate-300">{p.reviewer_name || <span className="text-slate-400 italic">Chưa gán</span>}</td>
                      <td className="p-3 text-slate-300">{p.council_name || <span className="text-slate-400 italic">Chưa gán</span>}</td>
                      <td className="p-3 text-center font-semibold text-slate-200">{p.supervisor_score !== null ? p.supervisor_score : '-'}</td>
                      <td className="p-3 text-center font-semibold text-slate-200">{p.reviewer_score !== null ? p.reviewer_score : '-'}</td>
                      <td className="p-3 text-center font-bold text-amber-400 text-sm">
                        {p.final_score_10 !== null ? p.final_score_10 : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-emerald-400">
                        {p.final_letter_grade || '-'}
                      </td>
                      <td className="p-3 text-center">
                        {p.status === 'PASSED' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            ĐẠT
                          </span>
                        ) : p.status === 'FAILED' ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                            KHÔNG ĐẠT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-xs">
                            {p.status}
                          </span>
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

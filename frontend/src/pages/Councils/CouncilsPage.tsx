import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { apiClient } from '../../api/client';

interface CouncilMember {
  id: number;
  user: number;
  role: string;
  external_institution: string;
  lecturer_name: string;
  academic_title: string;
}

interface DefenseCouncil {
  id: number;
  batch: number;
  council_number: number;
  council_name: string;
  session_date: string | null;
  session_time: string;
  defense_room: string;
  members: CouncilMember[];
  project_count: number;
}

export const CouncilsPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [councils, setCouncils] = useState<DefenseCouncil[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<any>(null);

  // Create Council Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [councilNumber, setCouncilNumber] = useState(1);
  const [councilName, setCouncilName] = useState('');
  const [defenseRoom, setDefenseRoom] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('MORNING');
  const [selectedMembers, setSelectedMembers] = useState<Array<{ user_id: number; role: string; external_institution?: string }>>([]);

  const fetchBatches = async () => {
    try {
      const res = await apiClient.get('/admin/batches/');
      setBatches(res.data);
      if (res.data.length > 0 && !selectedBatchId) {
        setSelectedBatchId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    if (!selectedBatchId) return;
    try {
      setLoading(true);
      const [counRes, userRes] = await Promise.all([
        apiClient.get(`/admin/councils/?batch_id=${selectedBatchId}`),
        apiClient.get('/admin/users/?user_type=supervisor'),
      ]);
      setCouncils(counRes.data);
      setUsers(userRes.data);
    } catch (err) {
      console.error(err);
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

  const handleAutoAssignReviewers = async () => {
    if (!selectedBatchId) return;
    if (!confirm('Khởi chạy tự động phân bổ Hội đồng & Giảng viên phản biện (ràng buộc không trùng GVHD)?')) return;

    try {
      setAssigning(true);
      setAssignResult(null);
      const res = await apiClient.post('/admin/reviewers/auto-assign/', {
        batch_id: selectedBatchId,
      });
      setAssignResult(res.data);
      fetchData();
    } catch (err: any) {
      alert('Lỗi phân công phản biện: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateCouncil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !councilName) return;

    try {
      await apiClient.post('/admin/councils/', {
        batch_id: selectedBatchId,
        council_number: councilNumber,
        council_name: councilName,
        defense_room: defenseRoom,
        session_date: sessionDate || null,
        session_time: sessionTime,
        members: selectedMembers,
      });
      alert('Tạo Hội đồng bảo vệ thành công!');
      setShowCreateModal(false);
      setSelectedMembers([]);
      fetchData();
    } catch (err: any) {
      alert('Lỗi tạo hội đồng: ' + (err.response?.data?.detail || err.message));
    }
  };

  const addMemberRow = () => {
    if (users.length > 0) {
      setSelectedMembers([...selectedMembers, { user_id: users[0].id, role: 'MEMBER' }]);
    }
  };

  return (
    <AdminLayout title="Quản lý Hội đồng bảo vệ & Phân Giảng viên phản biện">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
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
              onClick={() => {
                setCouncilNumber(councils.length + 1);
                setCouncilName(`Hội đồng ${councils.length + 1} - Kỹ sư CNTT`);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <span>➕</span> Thành lập Hội đồng mới
            </button>
            <button
              onClick={handleAutoAssignReviewers}
              disabled={assigning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-2"
            >
              <span>⚖️</span> {assigning ? 'Đang phân bổ...' : 'Auto Gán HĐ & Phản biện (No-Conflict)'}
            </button>
          </div>
        </div>

        {/* Conflict & Assignment Result Banner */}
        {assignResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 text-sm space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span>✅</span> Đã phân công thành công {assignResult.assigned_count} đề tài vào các Hội đồng & Giảng viên phản biện!
            </div>
            {assignResult.conflicts?.length > 0 && (
              <div className="mt-2 text-amber-400 text-xs space-y-1">
                <p className="font-semibold">Cảnh báo xung đột lợi ích ({assignResult.conflicts.length}):</p>
                {assignResult.conflicts.map((c: any, i: number) => (
                  <div key={i}>• SV {c.registration_no} ({c.student_name}): {c.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Councils Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Đang tải danh sách Hội đồng bảo vệ...</div>
        ) : councils.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Chưa có Hội đồng nào được thành lập cho đợt này.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {councils.map((c) => (
              <div key={c.id} className="bg-slate-950/50 rounded-xl border border-slate-800 p-5 space-y-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Hội đồng #{c.council_number}
                    </span>
                    <h4 className="font-bold text-base text-slate-100 mt-1">{c.council_name}</h4>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    Phòng: {c.defense_room || 'TBA'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-4">
                  <span>📅 Ngày: {c.session_date || 'Chưa định ngày'}</span>
                  <span>⏰ Ca: {c.session_time === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều'}</span>
                  <span className="text-emerald-400 font-semibold">📁 {c.project_count} Đồ án</span>
                </div>

                {/* Members list */}
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <p className="text-xs font-semibold text-slate-300">Thành viên Hội đồng ({c.members?.length || 0}):</p>
                  <div className="space-y-1.5">
                    {c.members?.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">{m.lecturer_name}</span>
                          {m.external_institution && (
                            <span className="text-slate-400 italic">({m.external_institution})</span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          m.role === 'CHAIR' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          m.role === 'SECRETARY' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {m.role === 'CHAIR' ? 'Chủ tịch' : m.role === 'SECRETARY' ? 'Thư ký' : m.role === 'EXTERNAL_MEMBER' ? 'UV Ngoài trường' : 'Ủy viên'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create Council */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Thành lập Hội đồng Chấm ĐATN</h3>
              <form onSubmit={handleCreateCouncil} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Số thứ tự HĐ</label>
                    <input
                      type="number"
                      required
                      value={councilNumber}
                      onChange={(e) => setCouncilNumber(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Phòng bảo vệ</label>
                    <input
                      type="text"
                      placeholder="VD: 502-A9, 401-A9"
                      value={defenseRoom}
                      onChange={(e) => setDefenseRoom(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tên Hội đồng</label>
                  <input
                    type="text"
                    required
                    value={councilName}
                    onChange={(e) => setCouncilName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Ngày bảo vệ</label>
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Ca bảo vệ</label>
                    <select
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="MORNING">Ca sáng (07h30 - 11h30)</option>
                      <option value="AFTERNOON">Ca chiều (13h30 - 17h30)</option>
                    </select>
                  </div>
                </div>

                {/* Member selection */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Danh sách thành viên (3-5 Thầy/Cô):</label>
                    <button
                      type="button"
                      onClick={addMemberRow}
                      className="text-xs px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30"
                    >
                      ➕ Thêm thành viên
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedMembers.map((m, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <select
                          value={m.user_id}
                          onChange={(e) => {
                            const newM = [...selectedMembers];
                            newM[idx].user_id = Number(e.target.value);
                            setSelectedMembers(newM);
                          }}
                          className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.first_name} {u.last_name} ({u.username})
                            </option>
                          ))}
                        </select>

                        <select
                          value={m.role}
                          onChange={(e) => {
                            const newM = [...selectedMembers];
                            newM[idx].role = e.target.value;
                            setSelectedMembers(newM);
                          }}
                          className="w-36 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                        >
                          <option value="CHAIR">Chủ tịch HĐ</option>
                          <option value="SECRETARY">Thư ký HĐ</option>
                          <option value="MEMBER">Ủy viên</option>
                          <option value="EXTERNAL_MEMBER">Ủy viên ngoài</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMembers(selectedMembers.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 text-rose-400 hover:bg-slate-800 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition"
                  >
                    Lưu Hội đồng
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

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './CouncilsPage.css';

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
      const [counRes, userRes] = await Promise.all([
        apiClient.get(`/admin/councils/?batch_id=${selectedBatchId}`),
        apiClient.get('/admin/users/?user_type=supervisor'),
      ]);
      setCouncils(Array.isArray(counRes.data) ? counRes.data : (counRes.data?.results || []));
      const userList = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.users || userRes.data?.results || []);
      setUsers(userList);
    } catch (err) {
      console.error(err);
      setCouncils([]);
      setUsers([]);
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

  const getRoleBadgeClass = (role: string) => {
    if (role === 'CHỦ TỊCH' || role === 'PRESIDENT') return 'utc-role-president';
    if (role === 'THƯ KÝ' || role === 'SECRETARY') return 'utc-role-secretary';
    if (role === 'PHẢN BIỆN' || role === 'REVIEWER') return 'utc-role-reviewer';
    return 'utc-role-member';
  };

  return (
    <AdminLayout>
      <div className="utc-councils-portal">
        {/* Header Bar */}
        <div className="utc-councils-header-bar">
          <div className="utc-batch-select-group">
            <label>⚖️ Chọn Đợt ĐATN:</label>
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

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setCouncilNumber(councils.length + 1);
                setCouncilName(`Hội đồng ${councils.length + 1} - Kỹ sư CNTT`);
                setShowCreateModal(true);
              }}
              className="utc-btn-primary"
            >
              <span>➕</span> Thành lập Hội đồng mới
            </button>
            <button
              onClick={handleAutoAssignReviewers}
              disabled={assigning}
              className="utc-btn-emerald"
            >
              <span>⚖️</span> {assigning ? 'Đang phân bổ...' : 'Auto Gán HĐ & Phản biện (No-Conflict)'}
            </button>
          </div>
        </div>

        {/* Conflict & Assignment Result Banner */}
        {assignResult && (
          <div className="utc-match-banner">
            <div className="utc-match-banner-title">
              <span>✅</span> Đã phân công thành công {assignResult.assigned_count} đề tài vào các Hội đồng & Giảng viên phản biện!
            </div>
            {assignResult.conflicts?.length > 0 && (
              <div style={{ marginTop: '0.5rem', color: '#d97706', fontSize: '0.82rem' }}>
                <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0' }}>Cảnh báo xung đột lợi ích ({assignResult.conflicts.length}):</p>
                {assignResult.conflicts.map((c: any, i: number) => (
                  <div key={i}>• SV {c.registration_no} ({c.student_name}): {c.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Councils Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Đang tải danh sách Hội đồng bảo vệ...</div>
        ) : councils.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#fff', borderRadius: '12px' }}>
            Chưa có Hội đồng nào được thành lập cho đợt này. Hãy nhấn nút "Thành lập Hội đồng mới".
          </div>
        ) : (
          <div className="utc-councils-grid">
            {councils.map((c) => (
              <div key={c.id} className="utc-council-card">
                <div className="utc-council-card-head">
                  <div>
                    <span className="utc-council-tag">Hội đồng #{c.council_number}</span>
                    <h4 className="utc-council-title">{c.council_name}</h4>
                  </div>
                  <span className="utc-council-room-tag">
                    Phòng: {c.defense_room || 'Chưa xếp'}
                  </span>
                </div>

                <div className="utc-council-meta-row">
                  <span>📅 Ngày: {c.session_date || 'Chưa định ngày'}</span>
                  <span>⏰ Ca: {c.session_time === 'MORNING' ? 'Sáng' : 'Chiều'}</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>📁 {c.project_count} Đồ án</span>
                </div>

                {/* Members list */}
                <div className="utc-council-members-list">
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    Thành viên Hội đồng ({c.members?.length || 0}):
                  </span>
                  {c.members && c.members.length > 0 ? (
                    c.members.map((m) => (
                      <div key={m.id} className="utc-council-member-item">
                        <div>
                          <strong style={{ color: '#0f172a' }}>{m.lecturer_name}</strong>
                          {m.academic_title && <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: '0.35rem' }}>({m.academic_title})</span>}
                          {m.external_institution && <span style={{ color: '#0284c7', fontSize: '0.75rem', display: 'block' }}>{m.external_institution}</span>}
                        </div>
                        <span className={`utc-member-role-badge ${getRoleBadgeClass(m.role)}`}>
                          {m.role}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Chưa có thành viên nào</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create Council */}
        {showCreateModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-box" style={{ maxWidth: '580px' }}>
              <h3>Thành Lập Hội Đồng Bảo Vệ Mới</h3>
              <p>Điền thông tin phòng bảo vệ, thời gian và chỉ định các thành viên.</p>

              <form onSubmit={handleCreateCouncil}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="utc-form-group">
                    <label>Số thứ tự HĐ</label>
                    <input
                      type="number"
                      required
                      value={councilNumber}
                      onChange={(e) => setCouncilNumber(Number(e.target.value))}
                      className="utc-form-input"
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Tên Hội đồng</label>
                    <input
                      type="text"
                      required
                      value={councilName}
                      onChange={(e) => setCouncilName(e.target.value)}
                      className="utc-form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="utc-form-group">
                    <label>Phòng bảo vệ</label>
                    <input
                      type="text"
                      placeholder="VD: P.402-A9"
                      value={defenseRoom}
                      onChange={(e) => setDefenseRoom(e.target.value)}
                      className="utc-form-input"
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Ngày bảo vệ</label>
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="utc-form-input"
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Ca bảo vệ</label>
                    <select
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      className="utc-form-select"
                    >
                      <option value="MORNING">Buổi sáng</option>
                      <option value="AFTERNOON">Buổi chiều</option>
                    </select>
                  </div>
                </div>

                {/* Members assignment */}
                <div style={{ margin: '1rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Thành viên & Vai trò:</label>
                    <button
                      type="button"
                      onClick={addMemberRow}
                      className="utc-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    >
                      + Thêm thành viên
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {selectedMembers.map((m, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          value={m.user_id}
                          onChange={(e) => {
                            const updated = [...selectedMembers];
                            updated[idx].user_id = Number(e.target.value);
                            setSelectedMembers(updated);
                          }}
                          className="utc-form-select"
                          style={{ flex: 2 }}
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.username} ({u.email})
                            </option>
                          ))}
                        </select>

                        <select
                          value={m.role}
                          onChange={(e) => {
                            const updated = [...selectedMembers];
                            updated[idx].role = e.target.value;
                            setSelectedMembers(updated);
                          }}
                          className="utc-form-select"
                          style={{ flex: 1 }}
                        >
                          <option value="CHỦ TỊCH">Chủ tịch</option>
                          <option value="THƯ KÝ">Thư ký</option>
                          <option value="ỦY VIÊN">Ủy viên</option>
                          <option value="PHẢN BIỆN">Phản biện</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setSelectedMembers(selectedMembers.filter((_, i) => i !== idx))}
                          style={{ background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="utc-modal-footer">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="utc-btn-cancel">
                    Hủy
                  </button>
                  <button type="submit" className="utc-btn-primary">
                    Thành lập Hội đồng
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

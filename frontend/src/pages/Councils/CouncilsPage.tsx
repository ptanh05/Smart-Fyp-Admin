import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import { formatFullName, formatDepartmentName } from '../../utils/nameHelper';
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
  is_finalized?: boolean;
  members: CouncilMember[];
  project_count: number;
  validity_info?: {
    is_valid: boolean;
    chair_count: number;
    secretary_count: number;
    member_count: number;
    total_count: number;
    expected_formula: string;
  };
}

export const CouncilsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'councils' | 'schedule'>('councils');
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [councils, setCouncils] = useState<DefenseCouncil[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<any>(null);
  // ⚡ Sinh Hội đồng tự động (1CT-2TK-2UV)
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [projectsPerCouncil, setProjectsPerCouncil] = useState(8);

  // Create Council Form (1 Chủ tịch, 2 Thư ký, 2 Ủy viên)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [councilNumber, setCouncilNumber] = useState(1);
  const [councilName, setCouncilName] = useState('');
  const [defenseRoom, setDefenseRoom] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('MORNING');
  const [selectedMembers, setSelectedMembers] = useState<Array<{ user_id: number; role: string; external_institution?: string }>>([]);

  // Auto Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [slotDuration, setSlotDuration] = useState(40);
  const [morningStart, setMorningStart] = useState('08:00');
  const [afternoonStart, setAfternoonStart] = useState('13:30');
  const [scheduling, setScheduling] = useState(false);

  // Manual Override Reviewer Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideProj, setOverrideProj] = useState<any>(null);
  const [overrideCouncilId, setOverrideCouncilId] = useState<number | ''>('');
  const [overrideReviewerId, setOverrideReviewerId] = useState<number | ''>('');

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
      const [counRes, userRes, projRes] = await Promise.all([
        apiClient.get(`/admin/councils/?batch_id=${selectedBatchId}`),
        apiClient.get('/admin/users/?user_type=supervisor'),
        apiClient.get(`/admin/projects/?batch_id=${selectedBatchId}`),
      ]);
      setCouncils(Array.isArray(counRes.data) ? counRes.data : (counRes.data?.results || []));
      const userList = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.users || userRes.data?.results || []);
      setUsers(userList);
      setProjects(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.results || []));
    } catch (err) {
      console.error(err);
      setCouncils([]);
      setUsers([]);
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

  const handleAutoGenerateCouncils = async () => {
    if (!selectedBatchId) return;
    if (!confirm(
      `Tự động sinh Hội đồng cho đợt này?\n\n` +
      `Mỗi Hội đồng gồm 5 giảng viên: 1 Chủ tịch, 2 Thư ký, 2 Ủy viên.\n` +
      `Hệ thống sẽ tự loại trừ GVHD của sinh viên khỏi hội đồng chấm đề tài đó ` +
      `và tự gán Giảng viên phản biện (GVPB ≠ GVHD).\n\n` +
      `Lưu ý: Các hội đồng cũ chưa chấm điểm sẽ bị thay thế.`
    )) return;

    try {
      setGenerating(true);
      setGenerateResult(null);
      const res = await apiClient.post('/admin/councils/auto-generate/', {
        batch_id: selectedBatchId,
        projects_per_council: projectsPerCouncil,
      });
      setGenerateResult(res.data);
      fetchData();
    } catch (err: any) {
      setGenerateResult({
        success: false,
        error: err.response?.data?.detail || err.response?.data?.error || err.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoAssignReviewers = async () => {
    if (!selectedBatchId) return;
    if (!confirm('Khởi chạy tự động phân bổ Hội đồng & Giảng viên phản biện (ràng buộc không trùng GVHD, cân bằng tải)?')) return;

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

  const handleRunAutoSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;

    try {
      setScheduling(true);
      const res = await apiClient.post('/admin/defense/auto-schedule/', {
        batch_id: selectedBatchId,
        slot_duration: slotDuration,
        morning_start: morningStart,
        afternoon_start: afternoonStart,
      });
      alert(`Đã tự động xếp lịch thành công cho ${res.data?.scheduled_projects_count} đồ án!`);
      setShowScheduleModal(false);
      setActiveTab('schedule');
      fetchData();
    } catch (err: any) {
      alert('Lỗi xếp lịch: ' + (err.response?.data?.detail || err.message));
    } finally {
      setScheduling(false);
    }
  };

  const handleOpenOverride = (proj: any) => {
    setOverrideProj(proj);
    setOverrideCouncilId(proj.council || '');
    setOverrideReviewerId(proj.reviewer || '');
    setShowOverrideModal(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideProj) return;

    try {
      const res = await apiClient.patch('/admin/defense/override-reviewer/', {
        project_id: overrideProj.id,
        council_id: overrideCouncilId ? Number(overrideCouncilId) : null,
        reviewer_id: overrideReviewerId ? Number(overrideReviewerId) : null,
      });
      alert(res.data?.message || 'Đã điều chỉnh thành công!');
      setShowOverrideModal(false);
      setOverrideProj(null);
      fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.response?.data?.error || err.message));
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
      setShowCreateModal(false);
      setCouncilName('');
      setDefenseRoom('');
      setSelectedMembers([]);
      fetchData();
    } catch (err: any) {
      alert('Lỗi tạo Hội đồng: ' + (err.response?.data?.detail || err.message));
    }
  };

  const addMemberSlot = () => {
    setSelectedMembers([...selectedMembers, { user_id: 0, role: 'MEMBER', external_institution: '' }]);
  };

  const updateMemberSlot = (index: number, field: string, val: any) => {
    const updated = [...selectedMembers];
    (updated[index] as any)[field] = val;
    setSelectedMembers(updated);
  };

  const removeMemberSlot = (index: number) => {
    setSelectedMembers(selectedMembers.filter((_, i) => i !== index));
  };

  return (
    <AdminLayout>
      <div className="utc-councils-portal">
        {/* Navigation Tabs */}
        <div className="utc-subnav-tabs">
          <button
            className={`utc-subnav-btn ${activeTab === 'councils' ? 'active' : ''}`}
            onClick={() => setActiveTab('councils')}
          >
            <span className="utc-tab-icon">🏛️</span>
            <span>Hội Đồng Bảo Vệ & Phản Biện (1CT-2TK-2UV)</span>
          </button>
          <button
            className={`utc-subnav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <span className="utc-tab-icon">⏱️</span>
            <span>Lịch Bảo Vệ Chi Tiết Từng Sinh Viên (Slot)</span>
          </button>
        </div>

        {/* Header Bar */}
        <div className="utc-councils-header-bar">
          <div className="utc-councils-filter-row">
            <div className="utc-batch-select-group">
              <label htmlFor="batch-select">
                <span className="utc-filter-icon">🎯</span>
                <span>Chọn Đợt ĐATN:</span>
              </label>
              <select
                id="batch-select"
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

            <div className="utc-batch-select-group">
              <label htmlFor="projects-per-council">
                <span className="utc-filter-icon">📦</span>
                <span>Số ĐT / Hội đồng:</span>
              </label>
              <select
                id="projects-per-council"
                value={projectsPerCouncil}
                onChange={(e) => setProjectsPerCouncil(Number(e.target.value))}
                className="utc-batch-dropdown"
              >
                {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} đề tài
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="utc-council-actions">
            <button
              onClick={handleAutoGenerateCouncils}
              disabled={generating}
              className="utc-btn-generate"
              title="Tự động lập Hội đồng chuẩn 1CT-2TK-2UV, gán đề tài & GVPB (loại trừ GVHD)"
            >
              <span className="utc-btn-icon">⚡</span>
              <span>{generating ? 'Đang sinh Hội đồng...' : 'Sinh Hội Đồng Tự Động'}</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="utc-btn-create"
              title="Tạo thủ công Hội đồng chuẩn 5 thành viên (1 Chủ tịch, 2 Thư ký, 2 Ủy viên)"
            >
              <span className="utc-btn-icon">➕</span>
              <span>Tạo Hội Đồng Chuẩn (1CT-2TK-2UV)</span>
            </button>
            <button
              onClick={handleAutoAssignReviewers}
              disabled={assigning}
              className="utc-btn-emerald"
              title="Phân bổ đề tài vào HĐ & gán phản biện không trùng GVHD"
            >
              <span className="utc-btn-icon">⚖️</span>
              <span>{assigning ? 'Đang phân bổ...' : 'Tự Động Phân HĐ & Phản Biện'}</span>
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="utc-btn-violet"
              title="Khoa nhập tham số ca/giờ/thời lượng để tự động xếp lịch"
            >
              <span className="utc-btn-icon">⏱️</span>
              <span>Tự Động Xếp Lịch Bảo Vệ</span>
            </button>
          </div>
        </div>

        {/* TAB 1: COUNCILS */}
        {activeTab === 'councils' && (
          <>
            {/* ⚡ Kết quả Sinh Hội đồng Tự động */}
            {generateResult && (
              <div className={`utc-generate-result-card ${generateResult.success ? 'is-success' : 'is-error'}`}>
                <div className="utc-gen-card-header">
                  <div className="utc-gen-header-left">
                    <div className="utc-gen-icon-badge">
                      {generateResult.success ? '⚡' : '❌'}
                    </div>
                    <div>
                      <h4 className="utc-gen-title">
                        {generateResult.success
                          ? 'Kết Quả Khởi Tạo Hội Đồng Tự Động (Chuẩn 1CT - 2TK - 2UV)'
                          : 'Không Thể Sinh Hội Đồng Tự Động'}
                      </h4>
                      <p className="utc-gen-message">
                        {generateResult.success ? generateResult.message : generateResult.error}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="utc-gen-close-btn"
                    onClick={() => setGenerateResult(null)}
                    title="Đóng thông báo"
                  >
                    ✕
                  </button>
                </div>

                {generateResult.success && (
                  <>
                    {/* Summary KPI Pills */}
                    <div className="utc-gen-kpi-bar">
                      <div className="utc-gen-kpi-pill">
                        <span className="utc-kpi-icon">🏛️</span>
                        <span className="utc-kpi-label">Hội đồng:</span>
                        <strong className="utc-kpi-val">{generateResult.councils?.length || 0}</strong>
                      </div>
                      <div className="utc-gen-kpi-pill">
                        <span className="utc-kpi-icon">📚</span>
                        <span className="utc-kpi-label">Đề tài đã gán:</span>
                        <strong className="utc-kpi-val">{generateResult.assigned_projects || 0}</strong>
                      </div>
                      <div className="utc-gen-kpi-pill">
                        <span className="utc-kpi-icon">👨‍🏫</span>
                        <span className="utc-kpi-label">GVPB đã gán:</span>
                        <strong className="utc-kpi-val">{generateResult.assigned_reviewers || 0}</strong>
                      </div>
                      <div className="utc-gen-kpi-pill highlight">
                        <span className="utc-kpi-icon">⚖️</span>
                        <span className="utc-kpi-label">Cơ cấu chuẩn:</span>
                        <strong className="utc-kpi-val">1 Chủ tịch · 2 Thư ký · 2 Ủy viên</strong>
                      </div>
                    </div>

                    {/* Detailed Council Cards Roster */}
                    {generateResult.councils && generateResult.councils.length > 0 && (
                      <div className="utc-generated-councils-container">
                        <div className="utc-generated-councils-header">
                          <div className="utc-gen-sec-title">
                            <span>🏛️</span> Cơ Cấu Thành Viên Hội Đồng Chuẩn UTC:
                          </div>
                          <span className="utc-gen-sec-count">
                            {generateResult.councils.length} Hội đồng được thành lập
                          </span>
                        </div>
                        <div className="utc-generated-councils-grid">
                          {generateResult.councils.map((c: any) => {
                            const rolePriority: Record<string, number> = { CHAIR: 1, SECRETARY: 2, MEMBER: 3, EXTERNAL_MEMBER: 4 };
                            const sortedMembers = [...(c.members || [])].sort(
                              (a: any, b: any) => (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5)
                            );

                            return (
                              <div key={c.id || c.council_name} className="utc-council-structure-card">
                                <div className="utc-council-structure-top">
                                  <div className="utc-council-structure-title">
                                    <span className="utc-c-tag">HĐ #{c.council_number || ''}</span>
                                    <strong>{c.council_name}</strong>
                                  </div>
                                  <span className="utc-council-room-badge">
                                    🚪 {c.defense_room ? `Phòng ${c.defense_room}` : 'Chưa xếp phòng'}
                                  </span>
                                </div>
                                <div className="utc-council-members-roster">
                                  {sortedMembers.map((m: any, mIdx: number) => {
                                    const isChair = m.role === 'CHAIR';
                                    const isSec = m.role === 'SECRETARY';
                                    const roleClass = isChair ? 'role-chair' : isSec ? 'role-secretary' : 'role-member';
                                    const roleLabel = isChair ? '👑 Chủ tịch' : isSec ? '📝 Thư ký' : '👥 Ủy viên';

                                    return (
                                      <div key={mIdx} className={`utc-council-member-row ${roleClass}`}>
                                        <span className={`utc-role-badge badge-${m.role?.toLowerCase() || 'member'}`}>
                                          {roleLabel}
                                        </span>
                                        <span className="utc-member-fullname">
                                          {m.academic_title ? `${m.academic_title} ` : ''}{m.name}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Conflicts detected */}
                {generateResult.conflicts && generateResult.conflicts.length > 0 && (
                  <div className="utc-conflicts-notice-box">
                    <div className="utc-conflicts-header">
                      <span>⚠️</span>
                      <strong>Xung đột lợi ích phát hiện ({generateResult.conflicts.length}):</strong>
                    </div>
                    <ul className="utc-conflicts-list">
                      {generateResult.conflicts.slice(0, 10).map((c: any, idx: number) => (
                        <li key={idx}>
                          {c.student_name ? <strong>{c.student_name} ({c.registration_no}): </strong> : ''}
                          <span>{c.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Auto-Assign Feedback */}
            {assignResult && (
              <div className="utc-generate-result-card is-success">
                <div className="utc-gen-card-header">
                  <div className="utc-gen-header-left">
                    <div className="utc-gen-icon-badge">🎉</div>
                    <div>
                      <h4 className="utc-gen-title">Kết Quả Phân Bổ Hội Đồng & Giảng Viên Phản Biện</h4>
                      <p className="utc-gen-message">
                        Hệ thống đã thực hiện gán đề tài vào Hội đồng và phân công GVPB theo tiêu chuẩn tải và hướng nghiên cứu.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="utc-gen-close-btn"
                    onClick={() => setAssignResult(null)}
                    title="Đóng thông báo"
                  >
                    ✕
                  </button>
                </div>

                <div className="utc-gen-kpi-bar">
                  <div className="utc-gen-kpi-pill">
                    <span className="utc-kpi-icon">✅</span>
                    <span className="utc-kpi-label">Đã gán thành công:</span>
                    <strong className="utc-kpi-val">{assignResult.assigned_count} đề tài</strong>
                  </div>
                  <div className="utc-gen-kpi-pill">
                    <span className="utc-kpi-icon">⚠️</span>
                    <span className="utc-kpi-label">Trùng xung đột / Chưa gán:</span>
                    <strong className="utc-kpi-val">{assignResult.unassigned_count}</strong>
                  </div>
                </div>

                {assignResult.conflicts && assignResult.conflicts.length > 0 && (
                  <div className="utc-conflicts-notice-box">
                    <div className="utc-conflicts-header">
                      <span>⚠️</span>
                      <strong>Xung đột lợi ích phát hiện ({assignResult.conflicts.length}):</strong>
                    </div>
                    <ul className="utc-conflicts-list">
                      {assignResult.conflicts.map((c: any, idx: number) => (
                        <li key={idx}>
                          {c.student_name ? <strong>{c.student_name} ({c.registration_no}): </strong> : ''}
                          <span>{c.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Councils Grid */}
            {loading ? (
              <div className="utc-loading-text">Đang tải danh sách Hội đồng...</div>
            ) : councils.length === 0 ? (
              <div className="utc-councils-empty-state">
                <div className="utc-empty-icon-circle">🏛️</div>
                <h4 className="utc-empty-title">Chưa Thành Lập Hội Đồng Nào Cho Đợt Này</h4>
                <p className="utc-empty-desc">
                  Đợt tốt nghiệp hiện tại chưa có Hội đồng bảo vệ nào. Bạn có thể bấm{' '}
                  <strong>"Sinh Hội Đồng Tự Động"</strong> để hệ thống tự phân vai chuẩn 1CT - 2TK - 2UV và gán đề tài,
                  hoặc bấm <strong>"Tạo Hội Đồng Chuẩn"</strong> để thêm thủ công.
                </p>
                <div className="utc-empty-actions">
                  <button
                    onClick={handleAutoGenerateCouncils}
                    disabled={generating}
                    className="utc-btn-generate"
                  >
                    <span className="utc-btn-icon">⚡</span>
                    <span>{generating ? 'Đang sinh Hội đồng...' : 'Sinh Hội Đồng Tự Động Ngay'}</span>
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="utc-btn-create"
                  >
                    <span className="utc-btn-icon">➕</span>
                    <span>Tạo Thủ Công (1CT-2TK-2UV)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="utc-councils-grid">
                {councils.map((council) => {
                  const val = council.validity_info;
                  return (
                    <div key={council.id} className="utc-council-card">
                      <div className="utc-council-card-head">
                        <div>
                          <span className="utc-council-tag">HĐ #{council.council_number}</span>
                          <h4>{council.council_name}</h4>
                        </div>
                        <span className={`utc-utc-model-badge ${val?.is_valid ? 'badge-utc-valid' : 'badge-utc-warn'}`}>
                          {val?.is_valid ? '✅ Chuẩn 1CT-2TK-2UV' : `⚠️ Thành phần (${council.members?.length || 0}/5)`}
                        </span>
                      </div>

                      <div className="utc-council-meta">
                        <div>📅 {council.session_date ? council.session_date : 'Chưa xếp ngày'}</div>
                        <div>⏰ {council.session_time === 'AFTERNOON' ? 'Ca Chiều (13:30)' : 'Ca Sáng (08:00)'}</div>
                        <div>🚪 Phòng: <strong>{council.defense_room || 'Chưa gán'}</strong></div>
                        <div>📚 Đề tài: <strong>{council.project_count || 0}</strong> sinh viên</div>
                      </div>

                      <div className="utc-members-list">
                        <h5>Thành phần Hội đồng:</h5>
                        {council.members && council.members.length > 0 ? (
                          council.members.map((m) => (
                            <div key={m.id} className="utc-member-row">
                              <span className="utc-member-role">{m.role === 'CHAIR' ? 'Chủ tịch' : m.role === 'SECRETARY' ? 'Thư ký' : 'Ủy viên'}</span>
                              <span className="utc-member-name">{m.academic_title} {m.lecturer_name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted text-xs">Chưa có thành viên nào.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB 2: DETAILED SCHEDULE (SLOTS) */}
        {activeTab === 'schedule' && (
          <div className="utc-schedule-section">
            <div className="utc-panel-head">
              <h4>⏱️ Lịch Bảo Vệ Chi Tiết Từng Sinh Viên (Theo Khung Giờ & Phòng)</h4>
              <span className="text-muted">Được tính toán tự động dựa trên thời lượng và ca bảo vệ của từng Hội đồng</span>
            </div>

            <div className="utc-table-container">
              <table className="utc-custom-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Hội Đồng</th>
                    <th>MSSV</th>
                    <th>Sinh Viên</th>
                    <th>Khung Giờ Bảo Vệ</th>
                    <th>Phòng</th>
                    <th>GV Hướng Dẫn</th>
                    <th>GV Phản Biện</th>
                    <th>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((proj, idx) => (
                    <tr key={proj.id}>
                      <td className="text-center font-bold">{proj.schedule_slot_info?.order || idx + 1}</td>
                      <td>
                        <span className="font-semibold text-slate-800">{proj.council_name || 'Chưa gán HĐ'}</span>
                      </td>
                      <td className="font-bold">{proj.student_reg_no}</td>
                      <td>
                        <div className="font-semibold">{formatFullName(proj.student_name)}</div>
                        <div className="text-xs text-muted">{proj.topic_title_vi}</div>
                      </td>
                      <td>
                        {proj.schedule_slot_info ? (
                          <span className="utc-time-slot-badge">
                            {proj.schedule_slot_info.start} - {proj.schedule_slot_info.end}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Chưa xếp slot</span>
                        )}
                      </td>
                      <td>
                        <span className="font-bold text-blue-700">{proj.schedule_slot_info?.room || '—'}</span>
                      </td>
                      <td>{formatFullName(proj.supervisor_name)}</td>
                      <td>
                        <span className="font-semibold text-purple-700">{formatFullName(proj.reviewer_name) || 'Chưa gán GVPB'}</span>
                      </td>
                      <td>
                        <button onClick={() => handleOpenOverride(proj)} className="utc-btn-override" title="Đổi HĐ hoặc Phản biện">
                          ✏️ Đổi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: CREATE COUNCIL (1CT - 2TK - 2UV) */}
        {showCreateModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card" style={{ maxWidth: '650px' }}>
              <div className="utc-modal-head">
                <h4>➕ Thành Lập Hội Đồng Bảo Vệ Chuẩn UTC (1CT-2TK-2UV)</h4>
                <button onClick={() => setShowCreateModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleCreateCouncil}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="utc-form-group">
                    <label>Số Hội Đồng:</label>
                    <input
                      type="number"
                      min={1}
                      value={councilNumber}
                      onChange={(e) => setCouncilNumber(Number(e.target.value))}
                      className="utc-input"
                      required
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Tên Hội Đồng:</label>
                    <input
                      type="text"
                      placeholder="VD: Hội đồng chấm đồ án tốt nghiệp 1"
                      value={councilName}
                      onChange={(e) => setCouncilName(e.target.value)}
                      className="utc-input"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="utc-form-group">
                    <label>Phòng Bảo Vệ:</label>
                    <input
                      type="text"
                      placeholder="VD: P.402-A9"
                      value={defenseRoom}
                      onChange={(e) => setDefenseRoom(e.target.value)}
                      className="utc-input"
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Ngày Bảo Vệ:</label>
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="utc-input"
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Ca Bảo Vệ:</label>
                    <select
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      className="utc-input"
                    >
                      <option value="MORNING">Ca Sáng (08:00)</option>
                      <option value="AFTERNOON">Ca Chiều (13:30)</option>
                    </select>
                  </div>
                </div>

                <div className="utc-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label>Thành Viên Hội Đồng (Chuẩn: 1 Chủ tịch, 2 Thư ký, 2 Ủy viên):</label>
                    <button type="button" onClick={addMemberSlot} className="utc-btn-sm-add">
                      + Thêm thành viên
                    </button>
                  </div>

                  {selectedMembers.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <select
                        style={{ flex: 2 }}
                        className="utc-input"
                        value={m.user_id}
                        onChange={(e) => updateMemberSlot(idx, 'user_id', Number(e.target.value))}
                        required
                      >
                        <option value={0}>-- Chọn giảng viên --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.username})
                          </option>
                        ))}
                      </select>

                      <select
                        style={{ flex: 1.5 }}
                        className="utc-input"
                        value={m.role}
                        onChange={(e) => updateMemberSlot(idx, 'role', e.target.value)}
                      >
                        <option value="CHAIR">Chủ tịch (CT)</option>
                        <option value="SECRETARY">Ủy viên, Thư ký (TK)</option>
                        <option value="MEMBER">Ủy viên (UV)</option>
                        <option value="EXTERNAL_MEMBER">Ủy viên ngoài trường</option>
                      </select>

                      <button type="button" onClick={() => removeMemberSlot(idx)} className="utc-btn-sm-del">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Lưu Hội Đồng</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: AUTO SCHEDULE */}
        {showScheduleModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>⏱️ Tự Động Xếp Lịch Bảo Vệ Chi Tiết (Bước 41)</h4>
                <button onClick={() => setShowScheduleModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleRunAutoSchedule}>
                <div className="utc-form-group">
                  <label>Thời lượng mỗi đồ án (phút):</label>
                  <input
                    type="number"
                    min={20}
                    max={90}
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}
                    className="utc-input"
                    required
                  />
                  <small style={{ color: '#64748b' }}>Tiêu chuẩn UTC: 40 - 45 phút cho mỗi đồ án bảo vệ.</small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="utc-form-group">
                    <label>Giờ bắt đầu ca sáng:</label>
                    <input
                      type="text"
                      value={morningStart}
                      onChange={(e) => setMorningStart(e.target.value)}
                      className="utc-input"
                      placeholder="08:00"
                      required
                    />
                  </div>
                  <div className="utc-form-group">
                    <label>Giờ bắt đầu ca chiều:</label>
                    <input
                      type="text"
                      value={afternoonStart}
                      onChange={(e) => setAfternoonStart(e.target.value)}
                      className="utc-input"
                      placeholder="13:30"
                      required
                    />
                  </div>
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowScheduleModal(false)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" disabled={scheduling} className="utc-btn-violet">
                    {scheduling ? 'Đang phân slot...' : 'Khởi Chạy Xếp Lịch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: MANUAL OVERRIDE REVIEWER / COUNCIL */}
        {showOverrideModal && overrideProj && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>✏️ Điều Chỉnh Thủ Công Hội Đồng & Phản Biện</h4>
                <button onClick={() => setShowOverrideModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleSaveOverride}>
                <div className="utc-form-group">
                  <p>Sinh viên: <strong>{formatFullName(overrideProj.student_name)}</strong> ({overrideProj.student_reg_no})</p>
                  <p>GVHD: <strong>{formatFullName(overrideProj.supervisor_name)}</strong> (Ràng buộc: Không được trùng với GVPB)</p>
                </div>

                <div className="utc-form-group">
                  <label>Chọn Hội Đồng Bảo Vệ:</label>
                  <select
                    className="utc-input"
                    value={overrideCouncilId}
                    onChange={(e) => setOverrideCouncilId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">-- Chọn Hội Đồng --</option>
                    {councils.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.council_name} ({c.defense_room || 'Phòng ?'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="utc-form-group">
                  <label>Chọn Giảng Viên Phản Biện (Reviewer):</label>
                  <select
                    className="utc-input"
                    value={overrideReviewerId}
                    onChange={(e) => setOverrideReviewerId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">-- Chọn Giảng Viên Phản Biện --</option>
                    {users.map((u) => {
                      const sup = u.supervisor_profile;
                      if (!sup) return null;
                      return (
                        <option key={sup.id} value={sup.id}>
                          {sup.academic_title} {u.full_name} ({formatDepartmentName(sup.department_name)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowOverrideModal(false)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Xác Nhận Điều Chỉnh</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

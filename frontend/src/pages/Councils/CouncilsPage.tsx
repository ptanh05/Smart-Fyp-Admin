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

const formatMemberDisplayName = (academicTitle?: string, lecturerName?: string): string => {
  const title = (academicTitle || '').trim();
  const name = (lecturerName || '').trim();
  if (!title) return name;
  if (!name) return title;
  if (name.toLowerCase().startsWith(title.toLowerCase())) {
    return name;
  }
  return `${title} ${name}`;
};

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

  // Create / Edit Council Form (1 Chủ tịch, 2 Thư ký, 2 Ủy viên)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCouncilId, setEditingCouncilId] = useState<number | null>(null);
  const [councilNumber, setCouncilNumber] = useState(1);
  const [councilName, setCouncilName] = useState('');
  const [defenseRoom, setDefenseRoom] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('MORNING');
  const [selectedMembers, setSelectedMembers] = useState<Array<{ user_id: number; role: string; external_institution?: string }>>([]);

  // Workflow Lock Gate (Item 9: Phân chia -> Điều chỉnh thủ công -> Chốt -> Xếp lịch)
  const [isAllocationLocked, setIsAllocationLocked] = useState(false);
  const [lockingAllocation, setLockingAllocation] = useState(false);
  const [togglingEligibilityId, setTogglingEligibilityId] = useState<number | 'bulk' | null>(null);
  const [studentFilter, setStudentFilter] = useState<'ALL' | 'ELIGIBLE' | 'INELIGIBLE'>('ALL');

  // Auto Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [startDate, setStartDate] = useState('');
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
      const counList = Array.isArray(counRes.data) ? counRes.data : (counRes.data?.results || []);
      setCouncils(counList);
      const userList = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.users || userRes.data?.results || []);
      setUsers(userList);
      const projList = Array.isArray(projRes.data) ? projRes.data : (projRes.data?.results || []);
      setProjects(projList);
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
      const currBatch = batches.find((b) => b.id === selectedBatchId);
      setIsAllocationLocked(
        Boolean(currBatch && ['PHASE_6_DEFENSE', 'COMPLETED'].includes(currBatch.current_stage))
      );
      fetchData();
    }
  }, [selectedBatchId]);

  const isProjectDefenseEligible = (proj: any): boolean => {
    if (!proj || proj.is_unassigned || !proj.student) return false;
    if (proj.deferral_status === 'APPROVED' || ['DEFERRED', 'DISQUALIFIED'].includes(proj.status)) {
      return false;
    }
    if (proj.final_academic_eligibility === 'INELIGIBLE') return false;
    return Boolean(
      proj.is_eligible_for_defense ||
      proj.supervisor_defense_confirmed ||
      ['DEFENSE_READY', 'DEFENDING', 'PASSED', 'FAILED'].includes(proj.status)
    );
  };

  const getProjectStageBadgeText = (proj: any): string => {
    if (proj.deferral_status === 'APPROVED' || proj.status === 'DEFERRED') return 'Bảo lưu';
    if (proj.status === 'DISQUALIFIED') return 'Bị loại';
    if (isProjectDefenseEligible(proj)) return 'Đủ ĐK Bảo vệ (GĐ6)';
    if (proj.status === 'IN_PROGRESS' || proj.status === 'OUTLINE_APPROVED') return 'Đang ở GĐ4–GĐ5 (Chưa chốt ĐK BV)';
    if (['OUTLINE_PENDING', 'OUTLINE_REVISION'].includes(proj.status) || proj.topic_review_status === 'APPROVED') {
      return 'Đang ở GĐ3 (Đề cương)';
    }
    return 'Đang ở GĐ2 (Phân công GVHD)';
  };

  const activeBatchProjects = projects.filter(
    (p) => p.student && !p.is_unassigned && p.deferral_status !== 'APPROVED' && !['DEFERRED', 'DISQUALIFIED'].includes(p.status)
  );
  const eligibleProjects = activeBatchProjects.filter(isProjectDefenseEligible);
  const ineligibleProjects = activeBatchProjects.filter((p) => !isProjectDefenseEligible(p));
  const assignedEligibleCount = eligibleProjects.filter((p) => p.council && p.reviewer).length;

  const handleToggleLockAllocation = async (willLock: boolean) => {
    if (!selectedBatchId) return;
    if (willLock) {
      if (councils.length === 0) {
        alert('Vui lòng thành lập Hội đồng trước khi chốt phân chia!');
        return;
      }
      if (
        !confirm(
          'Xác nhận KHOA CHỐT PHÂN CHIA HỘI ĐỒNG & GIẢNG VIÊN PHẢN BIỆN?\n\n' +
          'Sau khi chốt:\n' +
          '• Danh sách Hội đồng và Giảng viên phản biện sẽ được khóa.\n' +
          '• Đợt đồ án sẽ chuyển sang Giai đoạn 6 (Mở chấm phản biện & Hội đồng).\n' +
          '• Bước tiếp theo "Tự Động Xếp Lịch Bảo Vệ" sẽ được mở khóa.'
        )
      ) {
        return;
      }
    } else {
      if (!confirm('Mở khóa phân chia Hội đồng & Phản biện để tiếp tục điều chỉnh thủ công?')) {
        return;
      }
    }

    try {
      setLockingAllocation(true);
      const res = await apiClient.post('/admin/councils/lock-allocation/', {
        batch_id: selectedBatchId,
        lock: willLock,
      });
      setIsAllocationLocked(Boolean(res.data?.is_council_allocation_locked));
      alert(res.data?.message || (willLock ? 'Đã chốt Hội đồng & Phản biện!' : 'Đã mở khóa điều chỉnh!'));
      await fetchBatches();
      await fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.error || err.response?.data?.detail || err.message));
    } finally {
      setLockingAllocation(false);
    }
  };

  const handleToggleProjectEligibility = async (proj: any, nextEligible: boolean) => {
    if (!proj?.id) return;
    try {
      setTogglingEligibilityId(proj.id);
      await apiClient.patch(`/admin/projects/${proj.id}/defense-eligibility/`, {
        is_eligible_for_defense: nextEligible,
      });
      if (!nextEligible) {
        setIsAllocationLocked(false);
      }
      await fetchData();
    } catch (err: any) {
      alert('Lỗi cập nhật điều kiện bảo vệ: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTogglingEligibilityId(null);
    }
  };

  const handleBulkApproveDefenseEligibility = async () => {
    if (!selectedBatchId || ineligibleProjects.length === 0) return;
    if (
      !confirm(
        `Xác nhận duyệt ĐỦ ĐIỀU KIỆN BẢO VỆ (GĐ6) cho toàn bộ ${ineligibleProjects.length} sinh viên còn lại trong đợt này?`
      )
    ) {
      return;
    }
    try {
      setTogglingEligibilityId('bulk');
      const res = await apiClient.post('/admin/projects/defense-eligibility/', {
        batch_id: selectedBatchId,
        project_ids: ineligibleProjects.map((p) => p.id),
        is_eligible_for_defense: true,
      });
      setIsAllocationLocked(false);
      alert(res.data?.message || 'Đã xác nhận đủ điều kiện bảo vệ thành công!');
      await fetchData();
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTogglingEligibilityId(null);
    }
  };

  const handleOpenCreateCouncil = () => {
    setEditingCouncilId(null);
    setCouncilNumber(councils.length + 1);
    setCouncilName(`Hội đồng ${councils.length + 1}`);
    setDefenseRoom(`P${String(councils.length + 1).padStart(2, '0')}`);
    setSessionDate('');
    setSessionTime('MORNING');
    setSelectedMembers([
      { user_id: 0, role: 'CHAIR', external_institution: '' },
      { user_id: 0, role: 'SECRETARY', external_institution: '' },
      { user_id: 0, role: 'SECRETARY', external_institution: '' },
      { user_id: 0, role: 'MEMBER', external_institution: '' },
      { user_id: 0, role: 'MEMBER', external_institution: '' },
    ]);
    setShowCreateModal(true);
  };

  const handleOpenEditCouncil = (council: DefenseCouncil) => {
    setEditingCouncilId(council.id);
    setCouncilNumber(council.council_number);
    setCouncilName(council.council_name);
    setDefenseRoom(council.defense_room || '');
    setSessionDate(council.session_date || '');
    setSessionTime(council.session_time || 'MORNING');
    setSelectedMembers(
      (council.members || []).map((m) => ({
        user_id: m.user,
        role: m.role,
        external_institution: m.external_institution || '',
      }))
    );
    setShowCreateModal(true);
  };

  const handleDeleteCouncil = async (council: DefenseCouncil) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa ${council.council_name}?\nCác sinh viên thuộc hội đồng này sẽ được gỡ về trạng thái chờ phân hội đồng.`
      )
    ) {
      return;
    }
    try {
      await apiClient.delete(`/admin/councils/${council.id}/`);
      setIsAllocationLocked(false);
      await fetchData();
    } catch (err: any) {
      alert('Lỗi xóa Hội đồng: ' + (err.response?.data?.error || err.response?.data?.detail || err.message));
    }
  };

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
      setIsAllocationLocked(false);
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
      setIsAllocationLocked(false);
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
      const payload: Record<string, any> = {
        batch_id: selectedBatchId,
        slot_duration: slotDuration,
        morning_start: morningStart,
        afternoon_start: afternoonStart,
      };
      if (startDate) {
        payload.start_date = startDate;
      }
      const res = await apiClient.post('/admin/defense/auto-schedule/', payload);
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
      if (editingCouncilId) {
        await apiClient.patch(`/admin/councils/${editingCouncilId}/`, {
          council_number: councilNumber,
          council_name: councilName,
          defense_room: defenseRoom,
          session_date: sessionDate || null,
          session_time: sessionTime,
          members: selectedMembers,
        });
      } else {
        await apiClient.post('/admin/councils/', {
          batch_id: selectedBatchId,
          council_number: councilNumber,
          council_name: councilName,
          defense_room: defenseRoom,
          session_date: sessionDate || null,
          session_time: sessionTime,
          members: selectedMembers,
        });
      }
      setShowCreateModal(false);
      setEditingCouncilId(null);
      setCouncilName('');
      setDefenseRoom('');
      setSelectedMembers([]);
      setIsAllocationLocked(false);
      fetchData();
    } catch (err: any) {
      alert('Lỗi lưu Hội đồng: ' + (err.response?.data?.error || err.response?.data?.detail || err.message));
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
              disabled={generating || isAllocationLocked}
              className="utc-btn-generate"
              title={
                isAllocationLocked
                  ? 'Phân chia Hội đồng đã chốt. Bấm "Mở khóa điều chỉnh" nếu muốn sinh lại.'
                  : 'Bước 1: Tự động lập Hội đồng chuẩn 1CT-2TK-2UV, gán đề tài đủ ĐK bảo vệ & GVPB (loại trừ GVHD)'
              }
            >
              <span className="utc-btn-icon">⚡</span>
              <span>{generating ? 'Đang sinh Hội đồng...' : '1. Sinh Hội Đồng Tự Động'}</span>
            </button>
            <button
              onClick={handleOpenCreateCouncil}
              disabled={isAllocationLocked}
              className="utc-btn-create"
              title="Tạo thủ công Hội đồng chuẩn 5 thành viên (1 Chủ tịch, 2 Thư ký, 2 Ủy viên)"
            >
              <span className="utc-btn-icon">➕</span>
              <span>Tạo Hội Đồng Chuẩn</span>
            </button>
            <button
              onClick={handleAutoAssignReviewers}
              disabled={assigning || isAllocationLocked}
              className="utc-btn-emerald"
              title="Phân bổ đề tài đủ ĐK bảo vệ vào HĐ & gán phản biện không trùng GVHD"
            >
              <span className="utc-btn-icon">⚖️</span>
              <span>{assigning ? 'Đang phân bổ...' : 'Tự Động Phân HĐ & Phản Biện'}</span>
            </button>
            {isAllocationLocked ? (
              <button
                onClick={() => handleToggleLockAllocation(false)}
                disabled={lockingAllocation}
                className="utc-btn-lock-council is-locked"
                title="Mở khóa để tiếp tục điều chỉnh thủ công Hội đồng & Giảng viên phản biện"
              >
                <span className="utc-btn-icon">🔓</span>
                <span>{lockingAllocation ? 'Đang xử lý...' : 'Đã Chốt HĐ (Mở Khóa)'}</span>
              </button>
            ) : (
              <button
                onClick={() => handleToggleLockAllocation(true)}
                disabled={lockingAllocation || councils.length === 0}
                className="utc-btn-lock-council"
                title="Bước 2: Sau khi kiểm tra & điều chỉnh thủ công, bấm Chốt để mở khóa bước Xếp lịch bảo vệ"
              >
                <span className="utc-btn-icon">🔒</span>
                <span>{lockingAllocation ? 'Đang chốt...' : '2. Khoa Chốt HĐ & Phản Biện'}</span>
              </button>
            )}
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={!isAllocationLocked}
              className="utc-btn-violet"
              title={
                !isAllocationLocked
                  ? "Vui lòng kiểm tra, điều chỉnh thủ công (nếu cần) và bấm '2. Khoa Chốt HĐ & Phản Biện' trước khi sang bước Xếp lịch bảo vệ!"
                  : 'Bước 3: Khoa nhập tham số ca/giờ/thời lượng để tự động xếp lịch bảo vệ'
              }
            >
              <span className="utc-btn-icon">⏱️</span>
              <span>3. Tự Động Xếp Lịch Bảo Vệ</span>
            </button>
          </div>
        </div>

        {/* Workflow & Defense Eligibility Status Bar */}
        <div className="utc-council-workflow-strip">
          <div className="utc-workflow-metrics">
            <div className="utc-wf-pill pill-eligible">
              <span>✅ Đủ điều kiện bảo vệ (GĐ6):</span>
              <strong>{eligibleProjects.length} / {activeBatchProjects.length} SV</strong>
            </div>
            <div className="utc-wf-pill pill-assigned">
              <span>🏛️ Đã gán HĐ & GVPB:</span>
              <strong>{assignedEligibleCount} / {eligibleProjects.length} SV</strong>
            </div>
            {ineligibleProjects.length > 0 && (
              <div className="utc-wf-pill pill-ineligible">
                <span>⏳ Chưa đủ ĐK (đang ở GĐ1–GĐ5):</span>
                <strong>{ineligibleProjects.length} SV (không xếp vào HĐ)</strong>
              </div>
            )}
            <div className={`utc-wf-pill ${isAllocationLocked ? 'pill-locked' : 'pill-unlocked'}`}>
              <span>{isAllocationLocked ? '🔒 Trạng thái:' : '✏️ Trạng thái:'}</span>
              <strong>
                {isAllocationLocked
                  ? 'Đã chốt HĐ & Phản biện (Sẵn sàng xếp lịch)'
                  : 'Đang mở điều chỉnh thủ công (Cần chốt trước khi xếp lịch)'}
              </strong>
            </div>
          </div>

          {ineligibleProjects.length > 0 && !isAllocationLocked && (
            <button
              type="button"
              onClick={handleBulkApproveDefenseEligibility}
              disabled={togglingEligibilityId === 'bulk'}
              className="utc-btn-approve-elig-bulk"
              title="Xác nhận đủ điều kiện bảo vệ (GĐ6) cho toàn bộ sinh viên còn lại trong đợt để đưa vào chia Hội đồng"
            >
              {togglingEligibilityId === 'bulk'
                ? 'Đang duyệt...'
                : `✅ Duyệt ĐK Bảo Vệ Cho ${ineligibleProjects.length} SV Còn Lại`}
            </button>
          )}
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
                                          {formatMemberDisplayName(m.academic_title, m.name)}
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
                    onClick={handleOpenCreateCouncil}
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
                  const councilProjects = eligibleProjects.filter((p) => Number(p.council) === Number(council.id));
                  return (
                    <div key={council.id} className="utc-council-card">
                      <div className="utc-council-card-head">
                        <div>
                          <span className="utc-council-tag">HĐ #{council.council_number}</span>
                          <h4>{council.council_name}</h4>
                        </div>
                        <div className="utc-council-card-head-right">
                          <span className={`utc-utc-model-badge ${val?.is_valid ? 'badge-utc-valid' : 'badge-utc-warn'}`}>
                            {val?.is_valid ? '✅ Chuẩn 1CT-2TK-2UV' : `⚠️ Thành phần (${council.members?.length || 0}/5)`}
                          </span>
                          {!council.is_finalized && !isAllocationLocked && (
                            <div className="utc-council-card-tools">
                              <button
                                type="button"
                                onClick={() => handleOpenEditCouncil(council)}
                                className="utc-btn-card-tool"
                                title="Sửa thành viên, phòng hoặc ca bảo vệ của Hội đồng này"
                              >
                                ✏️ Sửa HĐ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCouncil(council)}
                                className="utc-btn-card-tool is-danger"
                                title="Xóa Hội đồng này"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="utc-council-meta">
                        <div>📅 {council.session_date ? council.session_date : 'Chưa xếp ngày'}</div>
                        <div>⏰ {council.session_time === 'AFTERNOON' ? 'Ca Chiều (13:30)' : 'Ca Sáng (08:00)'}</div>
                        <div>🚪 Phòng: <strong>{council.defense_room || 'Chưa gán'}</strong></div>
                        <div>📚 Đề tài: <strong>{councilProjects.length}</strong> sinh viên</div>
                      </div>

                      <div className="utc-members-list">
                        <h5>Thành phần Hội đồng:</h5>
                        {council.members && council.members.length > 0 ? (
                          [...council.members]
                            .sort((a, b) => {
                              const order: Record<string, number> = { CHAIR: 1, SECRETARY: 2, MEMBER: 3, EXTERNAL_MEMBER: 4 };
                              return (order[a.role] || 5) - (order[b.role] || 5);
                            })
                            .map((m) => {
                              const roleClass =
                                m.role === 'CHAIR'
                                  ? 'role-chair'
                                  : m.role === 'SECRETARY'
                                  ? 'role-secretary'
                                  : 'role-member';
                              const roleLabel =
                                m.role === 'CHAIR'
                                  ? 'Chủ tịch'
                                  : m.role === 'SECRETARY'
                                  ? 'Thư ký'
                                  : m.role === 'EXTERNAL_MEMBER'
                                  ? 'Ủy viên ngoài'
                                  : 'Ủy viên';
                              return (
                                <div key={m.id} className="utc-member-row">
                                  <span className={`utc-member-role ${roleClass}`}>{roleLabel}</span>
                                  <span className="utc-member-name">
                                    {formatMemberDisplayName(m.academic_title, m.lecturer_name)}
                                  </span>
                                </div>
                              );
                            })
                        ) : (
                          <div className="utc-members-empty">Chưa có thành viên nào.</div>
                        )}
                      </div>

                      {/* Danh sách SV thuộc Hội đồng này + nút Đổi nhanh */}
                      <div className="utc-council-students-box">
                        <div className="utc-council-students-head">
                          <span>👨‍🎓 Sinh viên bảo vệ ({councilProjects.length}):</span>
                        </div>
                        {councilProjects.length === 0 ? (
                          <div className="utc-members-empty">Chưa có sinh viên đủ ĐK bảo vệ trong HĐ này.</div>
                        ) : (
                          <div className="utc-council-students-list">
                            {councilProjects.map((proj) => (
                              <div key={proj.id} className="utc-council-student-item">
                                <div className="utc-cs-info">
                                  <strong>{formatFullName(proj.student_name)}</strong>
                                  <span className="utc-cs-reg">({proj.student_reg_no})</span>
                                  <div className="utc-cs-sub">
                                    GVHD: {formatFullName(proj.supervisor_name)} • GVPB:{' '}
                                    <b>{formatFullName(proj.reviewer_name) || 'Chưa gán'}</b>
                                  </div>
                                </div>
                                {!isAllocationLocked && !council.is_finalized && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOverride(proj)}
                                    className="utc-btn-override"
                                    title="Điều chỉnh thủ công Hội đồng hoặc Giảng viên phản biện"
                                  >
                                    ✏️ Đổi
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BẢNG ĐIỀU CHỈNH THỦ CÔNG HỘI ĐỒNG & PHẢN BIỆN TRƯỚC KHI CHỐT (ITEM 9, 20, 23) */}
            <div className="utc-schedule-section" style={{ marginTop: '1.5rem' }}>
              <div className="utc-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4>⚖️ Bảng Rà Soát & Điều Chỉnh Thủ Công Hội Đồng / Giảng Viên Phản Biện</h4>
                  <span className="text-muted">
                    Chỉ những sinh viên <strong>Đủ ĐK Bảo vệ (GĐ6)</strong> mới được phân vào Hội đồng và xếp lịch bảo vệ.
                    Sau khi điều chỉnh xong, bấm <strong>"2. Khoa Chốt HĐ & Phản Biện"</strong> để sang bước Xếp lịch.
                  </span>
                </div>
                <div className="utc-filter-tabs-inline">
                  <button
                    type="button"
                    className={`utc-filter-chip ${studentFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setStudentFilter('ALL')}
                  >
                    Tất cả ({activeBatchProjects.length})
                  </button>
                  <button
                    type="button"
                    className={`utc-filter-chip ${studentFilter === 'ELIGIBLE' ? 'active' : ''}`}
                    onClick={() => setStudentFilter('ELIGIBLE')}
                  >
                    ✅ Đủ ĐK Bảo vệ ({eligibleProjects.length})
                  </button>
                  <button
                    type="button"
                    className={`utc-filter-chip ${studentFilter === 'INELIGIBLE' ? 'active' : ''}`}
                    onClick={() => setStudentFilter('INELIGIBLE')}
                  >
                    ⏳ Đang ở GĐ1–GĐ5 ({ineligibleProjects.length})
                  </button>
                </div>
              </div>

              <div className="utc-table-container">
                <table className="utc-custom-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>MSSV</th>
                      <th>Sinh Viên & Đề Tài</th>
                      <th>Trạng Thái / Giai Đoạn</th>
                      <th>GV Hướng Dẫn</th>
                      <th>Hội Đồng Bảo Vệ</th>
                      <th>GV Phản Biện</th>
                      <th>Điều Chỉnh Thủ Công</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(studentFilter === 'ELIGIBLE'
                      ? eligibleProjects
                      : studentFilter === 'INELIGIBLE'
                      ? ineligibleProjects
                      : activeBatchProjects
                    ).map((proj, idx) => {
                      const eligible = isProjectDefenseEligible(proj);
                      return (
                        <tr key={proj.id}>
                          <td className="text-center font-bold">{idx + 1}</td>
                          <td className="font-bold">{proj.student_reg_no}</td>
                          <td>
                            <div className="font-semibold">{formatFullName(proj.student_name)}</div>
                            <div className="text-xs text-muted">{proj.topic_title_vi || 'Chưa cập nhật tên đề tài'}</div>
                          </td>
                          <td>
                            <span className={`utc-elig-stage-badge ${eligible ? 'is-ready' : 'is-pending'}`}>
                              {eligible ? '✅ ' : '⏳ '}
                              {getProjectStageBadgeText(proj)}
                            </span>
                          </td>
                          <td>{formatFullName(proj.supervisor_name)}</td>
                          <td>
                            {eligible ? (
                              <span className="font-semibold text-slate-800">{proj.council_name || '⚠️ Chưa gán HĐ'}</span>
                            ) : (
                              <span className="text-xs text-muted">Chưa xét vào HĐ</span>
                            )}
                          </td>
                          <td>
                            {eligible ? (
                              <span className="font-semibold text-purple-700">{formatFullName(proj.reviewer_name) || '⚠️ Chưa gán GVPB'}</span>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {eligible && (
                                <button
                                  type="button"
                                  disabled={isAllocationLocked}
                                  onClick={() => handleOpenOverride(proj)}
                                  className="utc-btn-override"
                                  title={
                                    isAllocationLocked
                                      ? 'Đã chốt phân chia. Mở khóa để điều chỉnh.'
                                      : 'Đổi Hội đồng hoặc Giảng viên phản biện'
                                  }
                                >
                                  ✏️ Đổi HĐ / GVPB
                                </button>
                              )}
                              {!isAllocationLocked && (
                                <button
                                  type="button"
                                  disabled={togglingEligibilityId === proj.id}
                                  onClick={() => handleToggleProjectEligibility(proj, !eligible)}
                                  className={`utc-btn-override ${eligible ? 'is-muted' : 'is-promote'}`}
                                  title={
                                    eligible
                                      ? 'Thu hồi xác nhận đủ điều kiện bảo vệ (đưa về giai đoạn trước)'
                                      : 'Xác nhận sinh viên này đủ điều kiện bảo vệ (GĐ6) để xếp vào Hội đồng'
                                  }
                                >
                                  {eligible ? '↩️ Hủy ĐK' : '✅ Duyệt ĐK BV'}
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
            </div>
          </>
        )}

        {/* TAB 2: DETAILED SCHEDULE (SLOTS) */}
        {activeTab === 'schedule' && (
          <div className="utc-schedule-section">
            <div className="utc-panel-head">
              <h4>⏱️ Lịch Bảo Vệ Chi Tiết Từng Sinh Viên Đủ Điều Kiện Bảo Vệ ({eligibleProjects.length} SV)</h4>
              <span className="text-muted">
                Chỉ hiển thị và xếp lịch cho các sinh viên đã đủ điều kiện bảo vệ GĐ6
                {ineligibleProjects.length > 0
                  ? ` (Đã loại trừ ${ineligibleProjects.length} sinh viên đang ở GĐ1–GĐ5 chưa đủ điều kiện).`
                  : '.'}
              </span>
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
                  {eligibleProjects.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        Chưa có sinh viên nào đủ điều kiện bảo vệ (GĐ6) trong đợt này.
                      </td>
                    </tr>
                  ) : (
                    eligibleProjects.map((proj, idx) => (
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
                              {proj.schedule_slot_info.date ? `${proj.schedule_slot_info.date} • ` : ''}
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
                          <button
                            onClick={() => handleOpenOverride(proj)}
                            disabled={isAllocationLocked}
                            className="utc-btn-override"
                            title={isAllocationLocked ? 'Mở khóa chốt HĐ để điều chỉnh' : 'Đổi HĐ hoặc Phản biện'}
                          >
                            ✏️ Đổi
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: CREATE / EDIT COUNCIL (1CT - 2TK - 2UV) */}
        {showCreateModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card" style={{ maxWidth: '650px' }}>
              <div className="utc-modal-head">
                <h4>
                  {editingCouncilId
                    ? '✏️ Điều Chỉnh Thủ Công Hội Đồng Bảo Vệ (1CT-2TK-2UV)'
                    : '➕ Thành Lập Hội Đồng Bảo Vệ Chuẩn UTC (1CT-2TK-2UV)'}
                </h4>
                <button onClick={() => setShowCreateModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleCreateCouncil}>
                <div className="utc-modal-body">
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
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
                <div className="utc-modal-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="utc-form-group">
                      <label htmlFor="auto-schedule-start-date">Ngày bắt đầu bảo vệ:</label>
                      <input
                        id="auto-schedule-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="utc-input"
                      />
                      <small>Để trống để giữ ngày bảo vệ đã gán cho từng Hội đồng.</small>
                    </div>
                    <div className="utc-form-group">
                      <label htmlFor="auto-schedule-duration">Thời lượng mỗi đồ án (phút):</label>
                      <input
                        id="auto-schedule-duration"
                        type="number"
                        min={20}
                        max={90}
                        value={slotDuration}
                        onChange={(e) => setSlotDuration(Number(e.target.value))}
                        className="utc-input"
                        required
                      />
                      <small>Tiêu chuẩn UTC: 40 - 45 phút cho mỗi đồ án bảo vệ.</small>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="utc-form-group">
                      <label htmlFor="auto-schedule-morning">Giờ bắt đầu ca sáng:</label>
                      <input
                        id="auto-schedule-morning"
                        type="text"
                        value={morningStart}
                        onChange={(e) => setMorningStart(e.target.value)}
                        className="utc-input"
                        placeholder="08:00"
                        required
                      />
                    </div>
                    <div className="utc-form-group">
                      <label htmlFor="auto-schedule-afternoon">Giờ bắt đầu ca chiều:</label>
                      <input
                        id="auto-schedule-afternoon"
                        type="text"
                        value={afternoonStart}
                        onChange={(e) => setAfternoonStart(e.target.value)}
                        className="utc-input"
                        placeholder="13:30"
                        required
                      />
                    </div>
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
                <div className="utc-modal-body">
                  <div className="utc-override-summary">
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
                            {formatMemberDisplayName(sup.academic_title, u.full_name)} ({formatDepartmentName(sup.department_name)})
                          </option>
                        );
                      })}
                    </select>
                  </div>
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

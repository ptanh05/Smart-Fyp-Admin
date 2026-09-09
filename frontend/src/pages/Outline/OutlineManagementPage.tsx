import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './OutlineManagementPage.css';

interface OutlineGroup {
  id: number;
  batch: number;
  name: string;
  department: string;
  members: number[];
  members_detail: Array<{ id: number; name: string; title: string }>;
  total_projects: number;
}

interface OutlineReviewItem {
  id: number;
  project: number;
  student_name: string;
  student_reg_no: string;
  student_class?: string;
  supervisor_name?: string;
  topic_title: string;
  review_group: number | null;
  group_name: string;
  reviewer: number | null;
  reviewer_name: string;
  outline_file?: string;
  outline_file_url?: string;
  verdict: 'PENDING' | 'APPROVED' | 'REVISION_REQUIRED' | 'REJECTED';
  verdict_display?: string;
  comments: string;
  submitted_at?: string;
  reviewed_at?: string;
}

interface SupervisorItem {
  id: number; // user id
  supervisor_id_db: number; // supervisor profile id
  name: string;
  title: string;
  department: string;
}

export const OutlineManagementPage: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'outlines' | 'groups'>('outlines');
  
  // Reviews, Groups & Supervisors State
  const [reviews, setReviews] = useState<OutlineReviewItem[]>([]);
  const [groups, setGroups] = useState<OutlineGroup[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Multi-Selection State (for bulk assignment)
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  // Filters & Search
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [nameSortOrder, setNameSortOrder] = useState<'none' | 'asc' | 'desc'>('none');

  // Modal: Create Group
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [department, setDepartment] = useState('Bộ môn Công nghệ phần mềm');

  // Modal: Edit Group
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OutlineGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDept, setEditGroupDept] = useState('');
  const [editGroupMemberIds, setEditGroupMemberIds] = useState<number[]>([]);

  // Modal: Assign Group (Bulk or Single)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<number | null>(null);

  // Modal: Review Outline (Detailed Review)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<OutlineReviewItem | null>(null);
  const [modalVerdict, setModalVerdict] = useState<'PENDING' | 'APPROVED' | 'REVISION_REQUIRED' | 'REJECTED'>('APPROVED');
  const [modalComments, setModalComments] = useState('');

  // 1. Fetch Academic Batches
  const fetchBatches = async () => {
    try {
      const res = await apiClient.get('/admin/batches/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch batches:', err);
      setBatches([]);
    }
  };

  // 2. Fetch Outline Groups
  const fetchGroups = async () => {
    if (!selectedBatchId) return;
    try {
      const res = await apiClient.get(`/admin/outline-groups/?batch_id=${selectedBatchId}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setGroups(list);
      if (list.length > 0 && !targetGroupId) {
        setTargetGroupId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch outline groups:', err);
      setGroups([]);
    }
  };

  // 3. Fetch Outline Reviews
  const fetchReviews = async () => {
    if (!selectedBatchId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/outline-reviews/?batch_id=${selectedBatchId}`);
      setReviews(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch outline reviews:', err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  // 4. Fetch Supervisors list for Group membership selection
  const fetchSupervisors = async () => {
    try {
      const res = await apiClient.get('/admin/users/?user_type=supervisor');
      const list = res.data?.users || [];
      const parsed: SupervisorItem[] = list
        .filter((u: any) => u.supervisor_profile)
        .map((u: any) => ({
          id: u.id,
          supervisor_id_db: u.supervisor_profile.id,
          name: u.full_name || u.username,
          title: u.supervisor_profile.academic_title || 'ThS.',
          department: u.supervisor_profile.department_name || '',
        }));
      setSupervisors(parsed);
    } catch (err) {
      console.error('Failed to fetch supervisors:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchSupervisors();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchGroups();
      fetchReviews();
      setSelectedProjectIds([]);
    }
  }, [selectedBatchId]);

  // Vietnamese collation sort helper
  const sortVietnameseReviews = (list: OutlineReviewItem[], order: 'asc' | 'desc') => {
    return [...list].sort((a, b) => {
      const getParts = (name: string) => {
        const full = (name || '').trim();
        const parts = full.split(/\s+/);
        const given = parts.length > 0 ? parts[parts.length - 1] : '';
        const family = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        return { given, family };
      };
      const aP = getParts(a.student_name);
      const bP = getParts(b.student_name);
      let cmp = aP.given.localeCompare(bP.given, 'vi', { sensitivity: 'base' });
      if (cmp === 0) {
        cmp = aP.family.localeCompare(bP.family, 'vi', { sensitivity: 'base' });
      }
      return order === 'asc' ? cmp : -cmp;
    });
  };

  const handleToggleNameSort = () => {
    setNameSortOrder((prev) => {
      const next = prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none';
      return next;
    });
  };

  // Filtered & Sorted Reviews
  const displayedReviews = useMemo(() => {
    let result = [...reviews];

    // Filter by Verdict
    if (verdictFilter !== 'ALL') {
      result = result.filter((r) => r.verdict === verdictFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          r.student_reg_no.toLowerCase().includes(q) ||
          r.topic_title.toLowerCase().includes(q) ||
          (r.group_name && r.group_name.toLowerCase().includes(q))
      );
    }

    // Sort by Vietnamese Student Name
    if (nameSortOrder !== 'none') {
      result = sortVietnameseReviews(result, nameSortOrder);
    }

    return result;
  }, [reviews, verdictFilter, searchQuery, nameSortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter((r) => r.verdict === 'PENDING').length;
    const approved = reviews.filter((r) => r.verdict === 'APPROVED').length;
    const revision = reviews.filter((r) => r.verdict === 'REVISION_REQUIRED').length;
    const unassigned = reviews.filter((r) => !r.review_group).length;
    return { total, pending, approved, revision, unassigned };
  }, [reviews]);

  // Checkbox toggle single
  const handleToggleSelectOne = (projectId: number) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  // Checkbox select all / deselect all
  const handleToggleSelectAll = () => {
    if (selectedProjectIds.length === displayedReviews.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(displayedReviews.map((r) => r.project));
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !groupName) return;

    try {
      setActionLoading(true);
      await apiClient.post('/admin/outline-groups/', {
        batch_id: selectedBatchId,
        name: groupName,
        department: department,
      });
      alert('Thành lập Nhóm xét duyệt đề cương thành công!');
      setShowCreateModal(false);
      setGroupName('');
      fetchGroups();
    } catch (err: any) {
      alert('Lỗi tạo nhóm: ' + (err.response?.data?.detail || err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Group Modal
  const openEditGroupModal = (g: OutlineGroup) => {
    setEditingGroup(g);
    setEditGroupName(g.name);
    setEditGroupDept(g.department);
    setEditGroupMemberIds(g.members || []);
    setShowEditGroupModal(true);
  };

  // Save Edit Group
  const handleSaveEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    try {
      setActionLoading(true);
      await apiClient.put(`/admin/outline-groups/${editingGroup.id}/`, {
        name: editGroupName,
        department: editGroupDept,
        members: editGroupMemberIds,
      });
      alert('Cập nhật Nhóm xét duyệt thành công!');
      setShowEditGroupModal(false);
      setEditingGroup(null);
      fetchGroups();
      fetchReviews();
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (groupId: number, groupTitle: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${groupTitle}"?`)) return;

    try {
      setActionLoading(true);
      await apiClient.delete(`/admin/outline-groups/${groupId}/`);
      alert('Đã xóa nhóm xét duyệt thành công!');
      fetchGroups();
      fetchReviews();
    } catch (err: any) {
      alert('Lỗi xóa nhóm: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Assign Group (Bulk or Single)
  const handleConfirmAssignGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGroupId || selectedProjectIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đề cương và chọn nhóm xét duyệt.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/admin/outline-reviews/assign/', {
        project_ids: selectedProjectIds,
        group_id: targetGroupId,
      });
      alert(res.data?.message || `Đã phân công ${res.data?.updated_count || selectedProjectIds.length} đề tài vào nhóm!`);
      setShowAssignModal(false);
      setSelectedProjectIds([]);
      fetchReviews();
      fetchGroups();
    } catch (err: any) {
      alert('Lỗi gán nhóm: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Approve Single Outline
  const handleQuickApprove = async (review: OutlineReviewItem) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/admin/outline-reviews/${review.id}/`, {
        verdict: 'APPROVED',
        comments: review.comments || 'Đề cương đạt chuẩn kỹ sư CNTT. Mục tiêu và cấu trúc hợp lý.',
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === review.id
            ? { ...r, verdict: 'APPROVED', comments: review.comments || 'Đề cương đạt chuẩn kỹ sư CNTT.' }
            : r
        )
      );
    } catch (err: any) {
      alert('Lỗi duyệt: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Revision Request
  const handleQuickRevision = async (review: OutlineReviewItem) => {
    try {
      setActionLoading(true);
      await apiClient.patch(`/admin/outline-reviews/${review.id}/`, {
        verdict: 'REVISION_REQUIRED',
        comments: review.comments || 'Cần bổ sung mô hình kiến trúc hệ thống và phân công kế hoạch theo tuần.',
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === review.id
            ? { ...r, verdict: 'REVISION_REQUIRED', comments: review.comments || 'Cần bổ sung mô hình kiến trúc hệ thống.' }
            : r
        )
      );
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Open Detailed Review Modal
  const openReviewModal = (review: OutlineReviewItem) => {
    setSelectedReview(review);
    setModalVerdict(review.verdict || 'APPROVED');
    setModalComments(review.comments || '');
    setShowReviewModal(true);
  };

  // Save Detailed Review Modal
  const handleSaveDetailedReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/admin/outline-reviews/${selectedReview.id}/`, {
        verdict: modalVerdict,
        comments: modalComments,
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedReview.id ? { ...r, verdict: modalVerdict, comments: modalComments } : r
        )
      );
      setShowReviewModal(false);
      setSelectedReview(null);
    } catch (err: any) {
      alert('Lỗi lưu kết quả: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Auto-Assign all projects to existing groups
  const handleAutoAssign = async () => {
    if (groups.length === 0) {
      alert('Chưa có Nhóm xét duyệt nào! Vui lòng bấm "Thành lập Nhóm mới" trước khi phân nhóm.');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn tự động chia đều toàn bộ đề cương vào ${groups.length} nhóm xét duyệt hiện có?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/admin/outline-reviews/assign/', {
        action: 'auto_assign',
        batch_id: selectedBatchId,
      });
      alert(res.data?.message || 'Phân nhóm thẩm định thành công!');
      fetchReviews();
      fetchGroups();
    } catch (err: any) {
      alert('Lỗi phân nhóm: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Approve all outlines in batch (or selected)
  const handleBulkApprove = async () => {
    const isSelected = selectedProjectIds.length > 0;
    const msg = isSelected
      ? `Xác nhận Duyệt ĐẠT cho ${selectedProjectIds.length} đề cương đã chọn?`
      : 'Xác nhận Duyệt nhanh: Đánh dấu TẤT CẢ các đề cương trong đợt này là ĐẠT YÊU CẦU?';

    if (!window.confirm(msg)) return;

    try {
      setActionLoading(true);
      const res = await apiClient.post('/admin/outline-reviews/assign/', {
        action: 'bulk_approve',
        batch_id: selectedBatchId,
        project_ids: isSelected ? selectedProjectIds : undefined,
      });
      alert(res.data?.message || 'Đã duyệt đạt thành công!');
      setSelectedProjectIds([]);
      fetchReviews();
    } catch (err: any) {
      alert('Lỗi duyệt: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="utc-outlines-portal">
        {/* Top Control Bar */}
        <div className="utc-outlines-header-bar">
          <div className="utc-batch-select-group">
            <label>📋 Chọn Đợt ĐATN:</label>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              className="utc-form-select"
              style={{ minWidth: '260px' }}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_name} ({b.batch_code}) {b.is_active ? '🟢' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setGroupName(`Nhóm Thẩm định ${groups.length + 1} - CNTT`);
                setShowCreateModal(true);
              }}
              className="utc-btn-primary"
            >
              <span>➕</span> Thành lập Nhóm mới
            </button>
            <button
              onClick={handleAutoAssign}
              disabled={actionLoading}
              className="utc-btn-secondary"
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b' }}
              title="Tự động chia đều các đề cương vào các nhóm thẩm định"
            >
              <span>⚡</span> Tự động chia đều nhóm
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={actionLoading}
              className="utc-btn-success"
              style={{ background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.6rem 1rem', fontWeight: 600, cursor: 'pointer' }}
              title="Đánh dấu toàn bộ đề cương là Đạt yêu cầu"
            >
              <span>✅</span> Duyệt nhanh tất cả
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="utc-outline-stats-grid">
          <div className="utc-stat-card" style={{ borderLeftColor: '#0284c7' }}>
            <span className="utc-stat-label">Tổng số Đề cương</span>
            <strong className="utc-stat-value" style={{ color: '#0284c7' }}>{stats.total}</strong>
          </div>
          <div className="utc-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
            <span className="utc-stat-label">Chờ thẩm định</span>
            <strong className="utc-stat-value" style={{ color: '#f59e0b' }}>{stats.pending}</strong>
          </div>
          <div className="utc-stat-card" style={{ borderLeftColor: '#16a34a' }}>
            <span className="utc-stat-label">Đã duyệt (Đạt)</span>
            <strong className="utc-stat-value" style={{ color: '#16a34a' }}>{stats.approved}</strong>
          </div>
          <div className="utc-stat-card" style={{ borderLeftColor: '#dc2626' }}>
            <span className="utc-stat-label">Yêu cầu chỉnh sửa</span>
            <strong className="utc-stat-value" style={{ color: '#dc2626' }}>{stats.revision}</strong>
          </div>
          <div className="utc-stat-card" style={{ borderLeftColor: '#64748b' }}>
            <span className="utc-stat-label">Nhóm Thẩm định</span>
            <strong className="utc-stat-value" style={{ color: '#334155' }}>{groups.length}</strong>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="utc-tabs-header">
          <button
            className={`utc-tab-btn ${activeViewTab === 'outlines' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('outlines')}
          >
            📄 1. Phân bổ & Duyệt Đề cương ({reviews.length})
          </button>
          <button
            className={`utc-tab-btn ${activeViewTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('groups')}
          >
            👥 2. Quản lý Nhóm Thẩm định ({groups.length})
          </button>
        </div>

        {/* Tab 1: Outlines List & Bulk Assign */}
        {activeViewTab === 'outlines' && (
          <div className="utc-table-container">
            {/* Filter and Search Bar */}
            <div className="utc-filter-bar">
              <div className="utc-filter-pills">
                <button
                  className={`utc-pill ${verdictFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setVerdictFilter('ALL')}
                >
                  Tất cả ({reviews.length})
                </button>
                <button
                  className={`utc-pill ${verdictFilter === 'PENDING' ? 'active pending' : ''}`}
                  onClick={() => setVerdictFilter('PENDING')}
                >
                  ⏳ Chờ duyệt ({stats.pending})
                </button>
                <button
                  className={`utc-pill ${verdictFilter === 'APPROVED' ? 'active approved' : ''}`}
                  onClick={() => setVerdictFilter('APPROVED')}
                >
                  ✅ Đạt yêu cầu ({stats.approved})
                </button>
                <button
                  className={`utc-pill ${verdictFilter === 'REVISION_REQUIRED' ? 'active revision' : ''}`}
                  onClick={() => setVerdictFilter('REVISION_REQUIRED')}
                >
                  ⚠️ Yêu cầu sửa ({stats.revision})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="🔍 Tìm MSSV, Họ tên, Tên đề tài..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="utc-search-input"
                  style={{ minWidth: '240px' }}
                />

                <button
                  type="button"
                  onClick={handleToggleNameSort}
                  className="utc-btn-sort"
                  title="Sắp xếp danh sách theo bảng chữ cái Tiếng Việt A-Z"
                >
                  🔤 {nameSortOrder === 'asc' ? 'Tên VN: A ➔ Z ▲' : nameSortOrder === 'desc' ? 'Tên VN: Z ➔ A ▼' : 'Sắp xếp Tên A-Z ↕'}
                </button>
              </div>
            </div>

            {/* Bulk Selection Action Bar */}
            {selectedProjectIds.length > 0 && (
              <div className="utc-bulk-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="utc-bulk-count">
                    ✓ Đã chọn <strong>{selectedProjectIds.length}</strong> đề tài
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="utc-btn-primary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                  >
                    👥 Gán vào Nhóm duyệt
                  </button>
                  <button
                    onClick={handleBulkApprove}
                    className="utc-btn-success"
                    style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✅ Duyệt đạt đã chọn
                  </button>
                  <button
                    onClick={() => setSelectedProjectIds([])}
                    className="utc-btn-secondary"
                    style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    ✕ Bỏ chọn
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Đang tải danh sách đề cương...</div>
            ) : displayedReviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                Không tìm thấy đề cương nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <table className="utc-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={displayedReviews.length > 0 && selectedProjectIds.length === displayedReviews.length}
                        onChange={handleToggleSelectAll}
                        title="Chọn tất cả"
                      />
                    </th>
                    <th style={{ width: '110px' }}>MSSV</th>
                    <th
                      onClick={handleToggleNameSort}
                      style={{ cursor: 'pointer', userSelect: 'none', minWidth: '160px', background: nameSortOrder !== 'none' ? '#eff6ff' : undefined }}
                      title="Nhấn để sắp xếp theo Tên Tiếng Việt A-Z"
                    >
                      Họ và Tên {nameSortOrder === 'asc' ? '▲ (A-Z)' : nameSortOrder === 'desc' ? '▼ (Z-A)' : '↕'}
                    </th>
                    <th style={{ minWidth: '220px' }}>Tên Đề tài ĐATN</th>
                    <th>GV Hướng dẫn</th>
                    <th>Nhóm Thẩm định</th>
                    <th>Tệp Đề cương</th>
                    <th>Trạng thái</th>
                    <th style={{ minWidth: '180px' }}>Nhận xét / Đánh giá</th>
                    <th style={{ textAlign: 'center', minWidth: '150px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReviews.map((r) => {
                    const isChecked = selectedProjectIds.includes(r.project);
                    return (
                      <tr key={r.id} className={isChecked ? 'row-selected' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectOne(r.project)}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: '#0284c7' }}>{r.student_reg_no}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.student_name}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.topic_title}</div>
                          {r.student_class && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lớp: {r.student_class}</span>
                          )}
                        </td>
                        <td>
                          {r.group_name ? (
                            <span style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600, background: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              {r.group_name}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedProjectIds([r.project]);
                                setShowAssignModal(true);
                              }}
                              className="utc-action-btn edit"
                              style={{ fontSize: '0.75rem' }}
                            >
                              + Gán nhóm
                            </button>
                          )}
                        </td>
                        <td>
                          <a
                            href={r.outline_file_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!r.outline_file_url) {
                                e.preventDefault();
                                alert(`Xem bản xem trước Đề cương của sinh viên ${r.student_name} (${r.student_reg_no}):\nĐề tài: ${r.topic_title}\nTrạng thái: ${r.verdict}`);
                              }
                            }}
                            className="utc-file-link"
                            title="Tải về / Xem bản đề cương PDF"
                          >
                            📄 Xem Đề cương
                          </a>
                        </td>
                        <td>
                          <span className={`utc-badge ${
                            r.verdict === 'APPROVED' ? 'approved' :
                            r.verdict === 'REVISION_REQUIRED' ? 'revision' :
                            r.verdict === 'REJECTED' ? 'rejected' : 'pending'
                          }`}>
                            {r.verdict === 'APPROVED' ? 'Đã duyệt đạt' :
                             r.verdict === 'REVISION_REQUIRED' ? 'Yêu cầu sửa' :
                             r.verdict === 'REJECTED' ? 'Không đạt' : 'Chờ xét duyệt'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem', color: '#475569', maxHeight: '60px', overflowY: 'auto' }}>
                            {r.comments || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có nhận xét</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            {r.verdict !== 'APPROVED' && (
                              <button
                                onClick={() => handleQuickApprove(r)}
                                disabled={actionLoading}
                                className="utc-action-btn approve"
                                title="Duyệt Đạt yêu cầu ngay"
                              >
                                Duyệt
                              </button>
                            )}
                            {r.verdict !== 'REVISION_REQUIRED' && (
                              <button
                                onClick={() => handleQuickRevision(r)}
                                disabled={actionLoading}
                                className="utc-action-btn revision"
                                title="Yêu cầu sinh viên chỉnh sửa"
                              >
                                Cần sửa
                              </button>
                            )}
                            <button
                              onClick={() => openReviewModal(r)}
                              className="utc-action-btn edit"
                              title="Thẩm định chi tiết & Viết góp ý"
                            >
                              Đánh giá
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Review Groups Management */}
        {activeViewTab === 'groups' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Đang tải danh sách nhóm xét duyệt...</div>
            ) : groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#fff', borderRadius: '12px' }}>
                Chưa có Nhóm xét duyệt nào được thành lập. Vui lòng bấm "Thành lập Nhóm mới" phía trên.
              </div>
            ) : (
              <div className="utc-outlines-grid">
                {groups.map((g) => (
                  <div key={g.id} className="utc-outline-card">
                    <div className="utc-outline-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 className="utc-outline-title">{g.name}</h4>
                        <span className="utc-outline-dept">{g.department}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          onClick={() => openEditGroupModal(g)}
                          className="utc-icon-btn"
                          title="Chỉnh sửa thông tin nhóm & Phân giảng viên"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(g.id, g.name)}
                          className="utc-icon-btn delete"
                          title="Xóa nhóm xét duyệt này"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="utc-outline-meta-row">
                      <span style={{ color: '#0284c7', fontWeight: 700 }}>
                        📁 {g.total_projects} Đề tài phân công thẩm định
                      </span>
                    </div>
                    <div className="utc-outline-members-list">
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                        Thành viên nhóm ({g.members_detail?.length || 0} cán bộ):
                      </span>
                      {g.members_detail && g.members_detail.length > 0 ? (
                        g.members_detail.map((m) => (
                          <div key={m.id} className="utc-outline-member-item">
                            <strong style={{ color: '#0f172a' }}>{m.title} {m.name}</strong>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem' }}>
                          Chưa có giảng viên. Nhấn nút ✏️ để thêm giảng viên vào nhóm.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Create Group */}
      {showCreateModal && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-content">
            <div className="utc-modal-header">
              <h3>Thành lập Nhóm xét duyệt đề cương</h3>
              <button onClick={() => setShowCreateModal(false)} className="utc-btn-close">×</button>
            </div>
            <form onSubmit={handleCreateGroup} className="utc-modal-form">
              <div className="utc-form-group">
                <label>Tên Nhóm xét duyệt</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="utc-form-input"
                  placeholder="Ví dụ: Nhóm Thẩm định Đề cương 1 - CNTT"
                />
              </div>
              <div className="utc-form-group">
                <label>Đơn vị (Bộ môn / Khoa)</label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="utc-form-input"
                  placeholder="Ví dụ: Bộ môn Công nghệ phần mềm"
                />
              </div>
              <div className="utc-modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="utc-btn-secondary">Hủy</button>
                <button type="submit" disabled={actionLoading} className="utc-btn-primary">
                  {actionLoading ? 'Đang tạo...' : 'Tạo Nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Group & Members */}
      {showEditGroupModal && editingGroup && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-content" style={{ maxWidth: '560px' }}>
            <div className="utc-modal-header">
              <h3>Chỉnh sửa Nhóm xét duyệt & Phân Giảng viên</h3>
              <button onClick={() => setShowEditGroupModal(false)} className="utc-btn-close">×</button>
            </div>
            <form onSubmit={handleSaveEditGroup} className="utc-modal-form">
              <div className="utc-form-group">
                <label>Tên Nhóm</label>
                <input
                  type="text"
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="utc-form-input"
                />
              </div>
              <div className="utc-form-group">
                <label>Đơn vị / Bộ môn</label>
                <input
                  type="text"
                  required
                  value={editGroupDept}
                  onChange={(e) => setEditGroupDept(e.target.value)}
                  className="utc-form-input"
                />
              </div>
              <div className="utc-form-group">
                <label>Chọn Giảng viên tham gia nhóm ({editGroupMemberIds.length} đã chọn)</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem' }}>
                  {supervisors.map((spv) => {
                    const isMember = editGroupMemberIds.includes(spv.supervisor_id_db);
                    return (
                      <label key={spv.supervisor_id_db} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditGroupMemberIds([...editGroupMemberIds, spv.supervisor_id_db]);
                            } else {
                              setEditGroupMemberIds(editGroupMemberIds.filter((id) => id !== spv.supervisor_id_db));
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.85rem' }}>
                          <strong>{spv.title} {spv.name}</strong> {spv.department ? `(${spv.department})` : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="utc-modal-actions">
                <button type="button" onClick={() => setShowEditGroupModal(false)} className="utc-btn-secondary">Hủy</button>
                <button type="submit" disabled={actionLoading} className="utc-btn-primary">
                  {actionLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Selected Projects to Group */}
      {showAssignModal && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-content">
            <div className="utc-modal-header">
              <h3>Phân công Nhóm Thẩm định Đề cương</h3>
              <button onClick={() => setShowAssignModal(false)} className="utc-btn-close">×</button>
            </div>
            <form onSubmit={handleConfirmAssignGroup} className="utc-modal-form">
              <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 0.5rem 0' }}>
                Bạn đang phân công <strong>{selectedProjectIds.length}</strong> đề tài tốt nghiệp vào nhóm thẩm định:
              </p>
              <div className="utc-form-group">
                <label>Chọn Nhóm Thẩm định</label>
                <select
                  value={targetGroupId || ''}
                  onChange={(e) => setTargetGroupId(Number(e.target.value))}
                  className="utc-form-input"
                  required
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.department}) - Đã có {g.total_projects} đề tài
                    </option>
                  ))}
                </select>
              </div>
              <div className="utc-modal-actions">
                <button type="button" onClick={() => setShowAssignModal(false)} className="utc-btn-secondary">Hủy</button>
                <button type="submit" disabled={actionLoading} className="utc-btn-primary">
                  {actionLoading ? 'Đang phân công...' : 'Xác nhận Phân công'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detailed Review */}
      {showReviewModal && selectedReview && (
        <div className="utc-modal-overlay">
          <div className="utc-modal-content" style={{ maxWidth: '600px' }}>
            <div className="utc-modal-header">
              <h3>Thẩm định & Đánh giá Đề cương</h3>
              <button onClick={() => setShowReviewModal(false)} className="utc-btn-close">×</button>
            </div>
            <form onSubmit={handleSaveDetailedReview} className="utc-modal-form">
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.88rem' }}>
                  <strong>Sinh viên:</strong> {selectedReview.student_name} ({selectedReview.student_reg_no})
                </p>
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.88rem' }}>
                  <strong>Đề tài:</strong> {selectedReview.topic_title}
                </p>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  <strong>GV Hướng dẫn:</strong> {selectedReview.supervisor_name || 'Chưa phân công'}
                </p>
              </div>

              <div className="utc-form-group">
                <label>Kết quả Thẩm định</label>
                <select
                  value={modalVerdict}
                  onChange={(e: any) => setModalVerdict(e.target.value)}
                  className="utc-form-input"
                  style={{ fontWeight: 600 }}
                >
                  <option value="APPROVED">✅ Đạt yêu cầu (Cho phép thực hiện ĐATN)</option>
                  <option value="REVISION_REQUIRED">⚠️ Yêu cầu chỉnh sửa đề cương</option>
                  <option value="REJECTED">❌ Không đạt / Hủy đề tài</option>
                  <option value="PENDING">⏳ Chờ xét duyệt</option>
                </select>
              </div>

              <div className="utc-form-group">
                <label>Ý kiến Nhận xét & Đánh giá của Hội đồng / Cán bộ thẩm định</label>
                <textarea
                  rows={4}
                  value={modalComments}
                  onChange={(e) => setModalComments(e.target.value)}
                  className="utc-form-input"
                  placeholder="Nhập nội dung nhận xét chi tiết về đề cương: phương pháp, phạm vi, tính khả thi..."
                />
              </div>

              <div className="utc-modal-actions">
                <button type="button" onClick={() => setShowReviewModal(false)} className="utc-btn-secondary">Hủy</button>
                <button type="submit" disabled={actionLoading} className="utc-btn-primary">
                  {actionLoading ? 'Đang lưu...' : 'Lưu kết quả thẩm định'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

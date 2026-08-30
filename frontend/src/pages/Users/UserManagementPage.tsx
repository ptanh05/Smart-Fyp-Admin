import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usersApi, type CreateUserPayload } from '../../api/users';
import { batchesApi, type AcademicBatch, type CourseClass } from '../../api/batches';
import type {
  AdminUser,
  UserType,
  MajorType,
  ProgramType,
  PasswordStrategy,
  UserCounts,
  ImportResult
} from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import './UserManagementPage.css';
import '../../components/common/Modal.css';

export const UserManagementPage: React.FC = () => {
  // Data state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<UserCounts>({
    total: 0,
    students: 0,
    supervisors: 0,
    committee: 0,
    external: 0,
    admins: 0,
    cntt_students: 0,
    khmt_students: 0,
  });
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<AcademicBatch[]>([]);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<UserType>('student');

  // Filters
  const [majorFilter, setMajorFilter] = useState<'ALL' | MajorType>('ALL');
  const [programFilter, setProgramFilter] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmActionType, setConfirmActionType] = useState<'status' | 'delete'>('status');

  // Single User Create Form state
  const [createRole, setCreateRole] = useState<UserType>('student');
  const [createUsername, setCreateUsername] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createFirstName, setCreateFirstName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createMajor, setCreateMajor] = useState<MajorType>('CNTT');
  const [createProgram, setCreateProgram] = useState<ProgramType>('DAI_TRA');
  const [createClassName, setCreateClassName] = useState('');
  const [createBatchId, setCreateBatchId] = useState<number | ''>('');
  const [createPasswordStrategy, setCreatePasswordStrategy] = useState<PasswordStrategy>('MSSV');
  const [createCustomPassword, setCreateCustomPassword] = useState('');
  // Supervisor specific
  const [createAcademicTitle, setCreateAcademicTitle] = useState('TS.');
  const [createDepartment, setCreateDepartment] = useState('Khoa CNTT - ĐHGTVT');
  const [createIsExternal, setCreateIsExternal] = useState(false);
  const [createMaxQuota, setCreateMaxQuota] = useState(5);
  const [createVietAnhQuota, setCreateVietAnhQuota] = useState(2);
  const [createGeneralQuota, setCreateGeneralQuota] = useState(3);
  // Council specific
  const [createInstitution, setCreateInstitution] = useState('');

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSuccessInfo, setCreatedSuccessInfo] = useState<{ username: string; password: string } | null>(null);

  // Bulk Import Modal state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBatchId, setImportBatchId] = useState<number | ''>('');
  const [importMajor, setImportMajor] = useState<MajorType>('CNTT');
  const [importPasswordStrategy, setImportPasswordStrategy] = useState<PasswordStrategy>('MSSV');
  const [importFixedPassword, setImportFixedPassword] = useState('UTC@2026');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Reset Password Modal state
  const [resetStrategy, setResetStrategy] = useState<PasswordStrategy>('MSSV');
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessInfo, setResetSuccessInfo] = useState<{ username: string; password: string } | null>(null);

  // Load Batches & Classes
  useEffect(() => {
    batchesApi.getBatches()
      .then((res) => {
        setBatches(res || []);
        const active = res.find((b) => b.is_active);
        if (active) {
          setCreateBatchId(active.id);
          setImportBatchId(active.id);
        }
      })
      .catch((err) => console.error('Failed to load batches:', err));
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        user_type: activeTab,
        q: searchQuery.trim(),
      };

      if (activeTab === 'student') {
        if (majorFilter !== 'ALL') params.major = majorFilter;
        if (programFilter) params.program_type = programFilter;
        if (batchFilter) params.batch_id = batchFilter;
        if (classFilter) params.class_id = classFilter;
        if (supervisorFilter === 'assigned') params.has_supervisor = 'true';
        if (supervisorFilter === 'unassigned') params.has_supervisor = 'false';
      }

      if (isActiveFilter) params.is_active = isActiveFilter;

      const res = await usersApi.getUsers(params);
      setUsers(res.users || []);
      setTotal(res.total || 0);
      if (res.counts) setCounts(res.counts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    majorFilter,
    programFilter,
    batchFilter,
    classFilter,
    supervisorFilter,
    isActiveFilter,
    searchQuery,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Extract available classes for current filter
  const availableClasses = useMemo(() => {
    const classesList: CourseClass[] = [];
    batches.forEach((b) => {
      if (!batchFilter || b.id.toString() === batchFilter) {
        if (b.classes) {
          b.classes.forEach((c) => {
            if (!programFilter || c.program_type === programFilter) {
              classesList.push(c);
            }
          });
        }
      }
    });
    return classesList;
  }, [batches, batchFilter, programFilter]);

  // Handle Tab Switch
  const handleTabSwitch = (role: UserType) => {
    setActiveTab(role);
    setSearchQuery('');
    setProgramFilter('');
    setClassFilter('');
    setSupervisorFilter('');
  };

  // Handle Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreatedSuccessInfo(null);
    setCreateLoading(true);

    try {
      const payload: CreateUserPayload = {
        username: createUsername.trim(),
        user_type: createRole,
        first_name: createFirstName.trim(),
        last_name: createLastName.trim(),
        email: createEmail.trim(),
        phone_number: createPhone.trim(),
        is_active: true,
      };

      if (createRole === 'student') {
        payload.registration_no = createUsername.trim();
        payload.major = createMajor;
        payload.program_type = createProgram;
        payload.class_name = createClassName.trim();
        payload.academic_batch_id = createBatchId ? Number(createBatchId) : null;
        payload.password_strategy = createPasswordStrategy;
        payload.custom_password = createCustomPassword.trim();
      } else if (createRole === 'supervisor') {
        payload.supervisor_id = createUsername.trim();
        payload.academic_title = createAcademicTitle;
        payload.department_name = createDepartment.trim();
        payload.is_external = createIsExternal;
        payload.max_total_quota = createMaxQuota;
        payload.viet_anh_quota = createVietAnhQuota;
        payload.general_cntt_quota = createGeneralQuota;
        payload.password_strategy = createPasswordStrategy;
        payload.custom_password = createCustomPassword.trim();
      } else {
        payload.external_institution = createInstitution.trim();
        payload.custom_password = createCustomPassword.trim();
        payload.password_strategy = 'CUSTOM';
      }

      const res = await usersApi.createUser(payload);
      setCreatedSuccessInfo({
        username: res.user.username,
        password: res.plain_password || '(Theo cấu hình)',
      });

      // Clear input fields
      setCreateUsername('');
      setCreateLastName('');
      setCreateFirstName('');
      setCreateEmail('');
      setCreatePhone('');
      setCreateClassName('');
      setCreateCustomPassword('');

      fetchUsers();
    } catch (err: any) {
      const msg =
        err.response?.data?.username?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Tạo tài khoản thất bại. Vui lòng kiểm tra lại thông tin.';
      setCreateError(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Bulk Import Submit
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportError('Vui lòng chọn file Excel để import.');
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      if (importBatchId) formData.append('batch_id', importBatchId.toString());
      formData.append('default_major', importMajor);
      formData.append('password_strategy', importPasswordStrategy);
      if (importPasswordStrategy === 'FIXED') {
        formData.append('custom_fixed_password', importFixedPassword.trim());
      }

      const res = await usersApi.importUsersExcel(formData);
      setImportResult(res);
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Import thất bại.';
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Quick Password Reset Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setResetLoading(true);
    setResetSuccessInfo(null);

    try {
      const res = await usersApi.resetPassword(selectedUser.id, {
        password_strategy: resetStrategy,
        custom_password: resetCustomPassword.trim(),
      });
      setResetSuccessInfo({
        username: res.username,
        password: res.new_password,
      });
      setResetCustomPassword('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setResetLoading(false);
    }
  };

  // Handle Status Toggle & Delete
  const handleToggleStatus = (u: AdminUser) => {
    setSelectedUser(u);
    setConfirmActionType('status');
    setShowConfirmModal(true);
  };

  const handleDeleteUser = (u: AdminUser) => {
    setSelectedUser(u);
    setConfirmActionType('delete');
    setShowConfirmModal(true);
  };

  const confirmAction = async () => {
    if (!selectedUser) return;
    try {
      if (confirmActionType === 'status') {
        await usersApi.updateUser(selectedUser.id, { is_active: !selectedUser.is_active });
      } else if (confirmActionType === 'delete') {
        await usersApi.deleteUser(selectedUser.id);
      }
      setShowConfirmModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  // Download Template
  const handleDownloadTemplate = async () => {
    try {
      const blob = await usersApi.downloadTemplate('student');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Import_Sinh_Vien_UTC.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template error:', err);
    }
  };

  // Export Users to Excel
  const handleExportUsers = async () => {
    try {
      const params: any = {
        user_type: activeTab,
        q: searchQuery.trim(),
      };
      if (activeTab === 'student') {
        if (majorFilter !== 'ALL') params.major = majorFilter;
        if (programFilter) params.program_type = programFilter;
        if (batchFilter) params.batch_id = batchFilter;
        if (classFilter) params.class_id = classFilter;
      }
      const blob = await usersApi.exportUsersExcel(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DS_${activeTab.toUpperCase()}_UTC.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        {/* Header Title & Actions */}
        <div className="user-mgmt-header">
          <div className="user-mgmt-title">
            <h2>👥 Quản Trị Định Danh & Cấp Phát Tài Khoản UTC ({total})</h2>
            <p>Admin toàn quyền tạo, phân loại theo ngành/lớp, import danh sách hàng loạt và cấp tài khoản cho người dùng</p>
          </div>

          <div className="user-mgmt-actions">
            <button
              className="btn-action-primary"
              onClick={() => {
                setCreateError(null);
                setCreatedSuccessInfo(null);
                setCreateRole(activeTab);
                setShowCreateModal(true);
              }}
            >
              <span>➕</span> Tạo Tài Khoản Mới
            </button>

            <button
              className="btn-action-success"
              onClick={() => {
                setImportError(null);
                setImportResult(null);
                setImportFile(null);
                setShowImportModal(true);
              }}
            >
              <span>📥</span> Import Excel Hàng Loạt
            </button>

            <button className="btn-action-outline" onClick={handleDownloadTemplate} title="Tải file Excel mẫu">
              <span>📋</span> File Mẫu (.xlsx)
            </button>

            <button className="btn-action-outline" onClick={handleExportUsers} title="Xuất dữ liệu hiện tại ra file Excel">
              <span>📤</span> Xuất Excel
            </button>
          </div>
        </div>

        {/* Role Tabs Header Bar (Matching user screenshot) */}
        <div className="role-tabs-container">
          <button
            className={`role-tab-item ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('student')}
          >
            <span>🎓</span> Sinh Viên UTC
            <span className="tab-badge">{counts.students}</span>
          </button>

          <button
            className={`role-tab-item ${activeTab === 'supervisor' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('supervisor')}
          >
            <span>👨‍🏫</span> Giảng Viên Hướng Dẫn
            <span className="tab-badge">{counts.supervisors}</span>
          </button>

          <button
            className={`role-tab-item ${activeTab === 'committee_member' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('committee_member')}
          >
            <span>⚖️</span> Thành Viên Hội Đồng
            <span className="tab-badge">{counts.committee}</span>
          </button>

          <button
            className={`role-tab-item ${activeTab === 'external_examiner' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('external_examiner')}
          >
            <span>📝</span> Cán Bộ Phản Biện / Chấm Ngoài
            <span className="tab-badge">{counts.external}</span>
          </button>

          <button
            className={`role-tab-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('admin')}
          >
            <span>🛡️</span> Quản Trị Viên
            <span className="tab-badge">{counts.admins}</span>
          </button>
        </div>

        {/* Sub-Filter Area (When Sinh Viên UTC is active) */}
        {activeTab === 'student' && (
          <div className="student-sub-filter-card">
            {/* Major Pills Row */}
            <div className="major-pills-row">
              <span className="major-pills-label">Ngành Đào Tạo:</span>
              <button
                className={`major-pill ${majorFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setMajorFilter('ALL')}
              >
                Tất Cả ({counts.students})
              </button>
              <button
                className={`major-pill ${majorFilter === 'CNTT' ? 'active' : ''}`}
                onClick={() => setMajorFilter('CNTT')}
              >
                💻 Công Nghệ Thông Tin ({counts.cntt_students})
              </button>
              <button
                className={`major-pill ${majorFilter === 'KHMT' ? 'active' : ''}`}
                onClick={() => setMajorFilter('KHMT')}
              >
                🧠 Khoa Học Máy Tính ({counts.khmt_students})
              </button>
            </div>

            {/* Grid Filters */}
            <div className="filters-grid">
              <div>
                <select
                  className="filter-select"
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                >
                  <option value="">-- Tất cả chương trình & lớp --</option>
                  <option value="VIET_ANH">⭐ CNTT Việt - Anh</option>
                  <option value="DAI_TRA">🏢 CNTT Đại trà / Kỹ sư (Lớp CNTT 1, 2, 3...)</option>
                  <option value="KHMT">🔬 Khoa học máy tính (Lớp KHMT 1, 2...)</option>
                  <option value="KHOA_CU">⏱️ Sinh viên Khóa cũ</option>
                </select>
              </div>

              <div>
                <select
                  className="filter-select"
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                >
                  <option value="">-- Tất cả Khóa / Đợt ĐATN --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id.toString()}>
                      {b.batch_name} ({b.batch_code}) {b.is_active ? '🟢' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {availableClasses.length > 0 && (
                <div>
                  <select
                    className="filter-select"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                  >
                    <option value="">-- Lọc theo Lớp học phần --</option>
                    {availableClasses.map((c) => (
                      <option key={c.id} value={c.id.toString()}>
                        {c.class_name} ({c.class_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <select
                  className="filter-select"
                  value={supervisorFilter}
                  onChange={(e) => setSupervisorFilter(e.target.value)}
                >
                  <option value="">-- Tình trạng phân GVHD --</option>
                  <option value="assigned">Đã phân công GVHD</option>
                  <option value="unassigned">Chưa phân công GVHD</option>
                </select>
              </div>

              <div>
                <select
                  className="filter-select"
                  value={isActiveFilter}
                  onChange={(e) => setIsActiveFilter(e.target.value)}
                >
                  <option value="">-- Trạng thái tài khoản --</option>
                  <option value="true">Đang hoạt động</option>
                  <option value="false">Bị vô hiệu hóa</option>
                </select>
              </div>

              <div>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="🔍 Tìm MSSV, Họ tên, Lớp, SĐT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* General Filter for Non-Student Tabs */}
        {activeTab !== 'student' && (
          <div className="student-sub-filter-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="filter-input"
                placeholder="🔍 Tìm kiếm theo Mã, Họ tên, Email, Bộ môn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <select
                className="filter-select"
                value={isActiveFilter}
                onChange={(e) => setIsActiveFilter(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Bị vô hiệu hóa</option>
              </select>
            </div>
          </div>
        )}

        {/* Main User Table */}
        <div className="user-table-container">
          {loading ? (
            <SkeletonTable rows={6} columns={7} />
          ) : users.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <p style={{ margin: 0, fontWeight: 600 }}>Không tìm thấy người dùng nào phù hợp với bộ lọc hiện tại.</p>
              <small>Bạn có thể nhấn nút "Tạo Tài Khoản Mới" hoặc "Import Excel Hàng Loạt" để thêm tài khoản vào hệ thống.</small>
            </div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  {activeTab === 'student' ? (
                    <>
                      <th>Mã SV (MSSV)</th>
                      <th>Họ và Tên</th>
                      <th>Ngành</th>
                      <th>Chương Trình & Lớp</th>
                      <th>Khóa Học</th>
                      <th>Giảng Viên Hướng Dẫn</th>
                      <th>Email / SĐT</th>
                      <th>Trạng Thái</th>
                      <th>Thao Tác</th>
                    </>
                  ) : activeTab === 'supervisor' ? (
                    <>
                      <th>Mã Giảng Viên</th>
                      <th>Họ và Tên</th>
                      <th>Học Hàm / Học Vị</th>
                      <th>Bộ Môn / Đơn Vị</th>
                      <th>Quota HD (VA / Đại trà / Tổng)</th>
                      <th>Email / SĐT</th>
                      <th>Trạng Thái</th>
                      <th>Thao Tác</th>
                    </>
                  ) : (
                    <>
                      <th>Username</th>
                      <th>Họ và Tên</th>
                      <th>Vai Trò</th>
                      <th>Đơn Vị Công Tác</th>
                      <th>Email</th>
                      <th>Trạng Thái</th>
                      <th>Thao Tác</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const std = u.student_profile;
                  const spv = u.supervisor_profile;

                  return (
                    <tr key={u.id}>
                      {activeTab === 'student' ? (
                        <>
                          <td style={{ fontWeight: 700, color: '#0284c7' }}>
                            {std?.registration_no || u.username}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {u.full_name || u.username}
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: std?.major === 'KHMT' ? '#be185d' : '#0369a1' }}>
                              {std?.major || 'CNTT'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span
                                className={`badge-program ${
                                  std?.program_type === 'VIET_ANH'
                                    ? 'badge-viet-anh'
                                    : std?.program_type === 'KHMT'
                                    ? 'badge-khmt'
                                    : std?.program_type === 'KHOA_CU'
                                    ? 'badge-khoa-cu'
                                    : 'badge-dai-tra'
                                }`}
                              >
                                {std?.program_type === 'VIET_ANH'
                                  ? 'CNTT Việt - Anh'
                                  : std?.program_type === 'KHMT'
                                  ? 'Khoa học máy tính'
                                  : std?.program_type === 'KHOA_CU'
                                  ? 'Khóa cũ'
                                  : 'CNTT Đại trà'}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {std?.department || std?.class_name || 'Chưa cập nhật lớp'}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {std?.batch_name || 'Mặc định'}
                          </td>
                          <td>
                            {std?.supervisor_name ? (
                              <span className="badge-spv-assigned" title={std.topic_title || 'Đã phân công'}>
                                <span>👨‍🏫</span> {std.supervisor_name}
                              </span>
                            ) : (
                              <span className="badge-spv-unassigned">
                                <span>⚠️</span> Chưa phân GVHD
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            <div>{u.email}</div>
                            {std?.phone_number && <div style={{ color: '#64748b' }}>📞 {std.phone_number}</div>}
                          </td>
                        </>
                      ) : activeTab === 'supervisor' ? (
                        <>
                          <td style={{ fontWeight: 700, color: '#0284c7' }}>
                            {spv?.supervisor_id || u.username}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {u.full_name}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#475569' }}>
                              {spv?.academic_title || 'Giảng viên'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {spv?.department_name || 'Khoa CNTT'}
                            {spv?.is_external && <span style={{ marginLeft: 4, color: '#d97706', fontSize: '0.75rem' }}>(Ngoài trường)</span>}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: '#0369a1' }}>
                              {spv?.quota_info
                                ? `${spv.quota_info.current_assigned} / ${spv.quota_info.max_total_quota} SV (VA: ${spv.quota_info.viet_anh_quota}, Đại trà: ${spv.quota_info.general_cntt_quota})`
                                : '0 / 5 SV'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            <div>{u.email}</div>
                            {spv?.phone_number && <div style={{ color: '#64748b' }}>📞 {spv.phone_number}</div>}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 700, color: '#0284c7' }}>
                            {u.username}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {u.full_name}
                          </td>
                          <td>
                            <span style={{ textTransform: 'capitalize' }}>
                              {u.user_type === 'committee_member'
                                ? 'Ủy viên HĐ'
                                : u.user_type === 'external_examiner'
                                ? 'Cán bộ ngoài'
                                : 'Quản trị viên'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {u.council_roles?.[0]?.external_institution || 'ĐH Giao thông Vận tải'}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {u.email}
                          </td>
                        </>
                      )}

                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: u.is_active ? '#dcfce7' : '#fee2e2',
                            color: u.is_active ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {u.is_active ? 'Hoạt động' : 'Vô hiệu'}
                        </span>
                      </td>

                      <td>
                        <div className="action-btn-group">
                          <button
                            className="btn-icon key"
                            onClick={() => {
                              setSelectedUser(u);
                              setResetStrategy('MSSV');
                              setResetCustomPassword('');
                              setResetSuccessInfo(null);
                              setShowResetModal(true);
                            }}
                            title="Đặt lại / Reset mật khẩu"
                          >
                            🔑
                          </button>

                          <button
                            className={`btn-icon ${u.is_active ? 'lock' : 'unlock'}`}
                            onClick={() => handleToggleStatus(u)}
                            title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {u.is_active ? '🔒' : '🔓'}
                          </button>

                          <button
                            className="btn-icon"
                            onClick={() => handleDeleteUser(u)}
                            title="Xóa tài khoản"
                            style={{ color: '#ef4444' }}
                          >
                            🗑️
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

        {/* Modal 1: Create Single User */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-container" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>➕ Tạo Tài Khoản Người Dùng Mới</h2>
                <button className="close-button" onClick={() => setShowCreateModal(false)}>✕</button>
              </div>

              <form onSubmit={handleCreateUserSubmit}>
                <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {createError && (
                    <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 6, fontSize: '0.9rem' }}>
                      {createError}
                    </div>
                  )}

                  {createdSuccessInfo && (
                    <div style={{ color: '#15803d', background: '#dcfce7', padding: '0.85rem', borderRadius: 8, fontSize: '0.9rem', border: '1px solid #86efac' }}>
                      <strong>🎉 Tạo tài khoản thành công!</strong>
                      <div style={{ marginTop: 4 }}>
                        Tên đăng nhập: <strong>{createdSuccessInfo.username}</strong> | Mật khẩu: <strong>{createdSuccessInfo.password}</strong>
                      </div>
                      <small style={{ color: '#166534', display: 'block', marginTop: 4 }}>
                        * Người dùng có thể dùng thông tin này để đăng nhập ngay trên hệ thống cổng sinh viên / giảng viên.
                      </small>
                    </div>
                  )}

                  {/* Role Selector */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>
                      Vai Trò Cần Cấp Tài Khoản
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { role: 'student', label: '🎓 Sinh Viên' },
                        { role: 'supervisor', label: '👨‍🏫 Giảng Viên' },
                        { role: 'committee_member', label: '⚖️ Hội Đồng' },
                        { role: 'external_examiner', label: '📝 Cán Bộ Ngoài' },
                        { role: 'admin', label: '🛡️ Quản Trị Viên' },
                      ].map((item) => (
                        <button
                          key={item.role}
                          type="button"
                          onClick={() => setCreateRole(item.role as UserType)}
                          style={{
                            padding: '0.6rem 0.8rem',
                            borderRadius: 8,
                            border: createRole === item.role ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: createRole === item.role ? '#f0f9ff' : '#fff',
                            color: createRole === item.role ? '#0284c7' : '#334155',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Common fields: Username / MSSV / Mã GV */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                        {createRole === 'student' ? 'Mã sinh viên (MSSV) *' : createRole === 'supervisor' ? 'Mã giảng viên (Mã GV) *' : 'Tên đăng nhập (Username) *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={createRole === 'student' ? 'vd: 201200123' : 'vd: gv_nguyenan'}
                        value={createUsername}
                        onChange={(e) => {
                          setCreateUsername(e.target.value);
                          if (createRole === 'student' && !createEmail) {
                            setCreateEmail(`${e.target.value.trim().toLowerCase()}@lms.utc.edu.vn`);
                          }
                        }}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                        Email liên hệ
                      </label>
                      <input
                        type="email"
                        placeholder="vd: student@lms.utc.edu.vn"
                        value={createEmail}
                        onChange={(e) => setCreateEmail(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* Name fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Họ và Tên đệm</label>
                      <input
                        type="text"
                        placeholder="vd: Nguyễn Văn"
                        value={createLastName}
                        onChange={(e) => setCreateLastName(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Tên *</label>
                      <input
                        type="text"
                        required
                        placeholder="vd: An"
                        value={createFirstName}
                        onChange={(e) => setCreateFirstName(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* Student Specific Fields */}
                  {createRole === 'student' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Ngành đào tạo</label>
                          <select
                            value={createMajor}
                            onChange={(e) => {
                              const m = e.target.value as MajorType;
                              setCreateMajor(m);
                              if (m === 'KHMT') setCreateProgram('KHMT');
                              else if (createProgram === 'KHMT') setCreateProgram('DAI_TRA');
                            }}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            <option value="CNTT">💻 Công nghệ thông tin (CNTT)</option>
                            <option value="KHMT">🧠 Khoa học máy tính (KHMT)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Chương trình đào tạo</label>
                          <select
                            value={createProgram}
                            onChange={(e) => setCreateProgram(e.target.value as ProgramType)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            {createMajor === 'CNTT' ? (
                              <>
                                <option value="VIET_ANH">⭐ CNTT Việt - Anh</option>
                                <option value="DAI_TRA">🏢 CNTT Kỹ sư / Đại trà</option>
                                <option value="KHOA_CU">⏱️ Khóa cũ</option>
                              </>
                            ) : (
                              <option value="KHMT">🔬 Khoa học máy tính</option>
                            )}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Lớp sinh hoạt / Lớp HP</label>
                          <input
                            type="text"
                            placeholder="vd: CNTT 1 - K62 hoặc CNTT Việt Anh K62"
                            value={createClassName}
                            onChange={(e) => setCreateClassName(e.target.value)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Khóa học / Đợt ĐATN</label>
                          <select
                            value={createBatchId}
                            onChange={(e) => setCreateBatchId(e.target.value ? Number(e.target.value) : '')}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            <option value="">-- Mặc định --</option>
                            {batches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batch_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Supervisor Specific Fields */}
                  {createRole === 'supervisor' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Học hàm / Học vị</label>
                          <select
                            value={createAcademicTitle}
                            onChange={(e) => setCreateAcademicTitle(e.target.value)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            <option value="TS.">TS.</option>
                            <option value="PGS.TS.">PGS.TS.</option>
                            <option value="GS.TS.">GS.TS.</option>
                            <option value="ThS.">ThS.</option>
                            <option value="GV.">GV.</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Bộ môn / Khoa</label>
                          <input
                            type="text"
                            value={createDepartment}
                            onChange={(e) => setCreateDepartment(e.target.value)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: 4 }}>Quota Việt Anh</label>
                          <input
                            type="number"
                            min={0}
                            value={createVietAnhQuota}
                            onChange={(e) => setCreateVietAnhQuota(Number(e.target.value))}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: 4 }}>Quota Đại Trà</label>
                          <input
                            type="number"
                            min={0}
                            value={createGeneralQuota}
                            onChange={(e) => setCreateGeneralQuota(Number(e.target.value))}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: 4 }}>Tổng tối đa</label>
                          <input
                            type="number"
                            min={1}
                            value={createMaxQuota}
                            onChange={(e) => setCreateMaxQuota(Number(e.target.value))}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                        <input
                          type="checkbox"
                          id="isExternalSpv"
                          checked={createIsExternal}
                          onChange={(e) => setCreateIsExternal(e.target.checked)}
                        />
                        <label htmlFor="isExternalSpv" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                          Giảng viên / Chuyên gia ngoài trường UTC
                        </label>
                      </div>
                    </>
                  )}

                  {/* Council & External Examiner Specific Fields */}
                  {(createRole === 'committee_member' || createRole === 'external_examiner') && (
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                        Cơ quan / Đơn vị công tác
                      </label>
                      <input
                        type="text"
                        placeholder="vd: Viện Công nghệ Thông tin - Viện Hàn lâm KH&CN VN"
                        value={createInstitution}
                        onChange={(e) => setCreateInstitution(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  )}

                  {/* Password Strategy Options */}
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>
                      🔑 Cơ Chế Mật Khẩu Khởi Tạo
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="createPwdStrategy"
                          checked={createPasswordStrategy === 'MSSV'}
                          onChange={() => setCreatePasswordStrategy('MSSV')}
                        />
                        <span>Mật khẩu = {createRole === 'student' ? 'MSSV' : 'Mã GV / Username'} <em>(Khuyên dùng)</em></span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="createPwdStrategy"
                          checked={createPasswordStrategy === 'CUSTOM'}
                          onChange={() => setCreatePasswordStrategy('CUSTOM')}
                        />
                        <span>Tự nhập mật khẩu</span>
                      </label>
                    </div>

                    {createPasswordStrategy === 'CUSTOM' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Nhập mật khẩu (tối thiểu 4 ký tự)..."
                          value={createCustomPassword}
                          onChange={(e) => setCreateCustomPassword(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={() => setShowCreateModal(false)}>Đóng</button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="btn-action-primary"
                    style={{ border: 'none' }}
                  >
                    {createLoading ? 'Đang tạo...' : 'Tạo Tài Khoản Ngay'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Bulk Import Excel */}
        {showImportModal && (
          <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
            <div className="modal-container" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📥 Import Danh Sách Hàng Loạt Từ Excel</h2>
                <button className="close-button" onClick={() => setShowImportModal(false)}>✕</button>
              </div>

              {!importResult ? (
                <form onSubmit={handleImportSubmit}>
                  <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {importError && (
                      <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '0.75rem', borderRadius: 6, fontSize: '0.9rem' }}>
                        {importError}
                      </div>
                    )}

                    {/* File Upload Dropzone */}
                    <div
                      className="import-dropzone"
                      onClick={() => document.getElementById('excelFileInput')?.click()}
                    >
                      <input
                        id="excelFileInput"
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setImportFile(e.target.files[0]);
                          }
                        }}
                      />
                      <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📄</div>
                      {importFile ? (
                        <div>
                          <strong style={{ color: '#0284c7', fontSize: '1rem' }}>{importFile.name}</strong>
                          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
                            Kích thước: {(importFile.size / 1024).toFixed(1)} KB (Nhấn để chọn file khác)
                          </div>
                        </div>
                      ) : (
                        <div>
                          <strong style={{ color: '#1e293b' }}>Kéo thả file Excel (.xlsx, .xls) hoặc bấm để chọn file</strong>
                          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                            Hệ thống tự động nhận diện multi-sheet danh sách lớp đào tạo UTC (CNTT, KHMT, Việt Anh, Đại trà)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Batch & Major Defaults */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                          Áp dụng cho Khóa / Đợt ĐATN *
                        </label>
                        <select
                          required
                          value={importBatchId}
                          onChange={(e) => setImportBatchId(e.target.value ? Number(e.target.value) : '')}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          <option value="">-- Chọn Khóa học --</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batch_name} ({b.batch_code}) {b.is_active ? '🟢' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                          Ngành mặc định (nếu file không ghi)
                        </label>
                        <select
                          value={importMajor}
                          onChange={(e) => setImportMajor(e.target.value as MajorType)}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                        >
                          <option value="CNTT">💻 Công nghệ thông tin (CNTT)</option>
                          <option value="KHMT">🧠 Khoa học máy tính (KHMT)</option>
                        </select>
                      </div>
                    </div>

                    {/* Password Strategy Options */}
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>
                        ⚙️ Chọn Cơ Chế Thiết Lập Mật Khẩu Khi Tạo Tài Khoản
                      </label>

                      <div
                        className={`password-strategy-card ${importPasswordStrategy === 'MSSV' ? 'selected' : ''}`}
                        onClick={() => setImportPasswordStrategy('MSSV')}
                      >
                        <input
                          type="radio"
                          name="importPwdStrategy"
                          checked={importPasswordStrategy === 'MSSV'}
                          onChange={() => setImportPasswordStrategy('MSSV')}
                        />
                        <div>
                          <strong>1. Mật khẩu = Mã sinh viên (MSSV)</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Mỗi sinh viên đăng nhập lần đầu bằng chính mã số sinh viên của mình (Khuyên dùng).
                          </div>
                        </div>
                      </div>

                      <div
                        className={`password-strategy-card ${importPasswordStrategy === 'FIXED' ? 'selected' : ''}`}
                        onClick={() => setImportPasswordStrategy('FIXED')}
                      >
                        <input
                          type="radio"
                          name="importPwdStrategy"
                          checked={importPasswordStrategy === 'FIXED'}
                          onChange={() => setImportPasswordStrategy('FIXED')}
                        />
                        <div style={{ flex: 1 }}>
                          <strong>2. Mật khẩu chung cố định do Admin chỉ định</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>
                            Tất cả tài khoản trong danh sách được cấp chung 1 mật khẩu khởi tạo.
                          </div>
                          {importPasswordStrategy === 'FIXED' && (
                            <input
                              type="text"
                              value={importFixedPassword}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setImportFixedPassword(e.target.value)}
                              placeholder="vd: UTC@2026"
                              style={{ width: 220, padding: '0.4rem 0.6rem', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                          )}
                        </div>
                      </div>

                      <div
                        className={`password-strategy-card ${importPasswordStrategy === 'RANDOM' ? 'selected' : ''}`}
                        onClick={() => setImportPasswordStrategy('RANDOM')}
                      >
                        <input
                          type="radio"
                          name="importPwdStrategy"
                          checked={importPasswordStrategy === 'RANDOM'}
                          onChange={() => setImportPasswordStrategy('RANDOM')}
                        />
                        <div>
                          <strong>3. Sinh mật khẩu ngẫu nhiên an toàn (8 ký tự)</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Hệ thống tự động sinh ngẫu nhiên mật khẩu mạnh và trả về danh sách để xuất file Excel.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button type="button" onClick={handleDownloadTemplate} className="btn-action-outline">
                      <span>📋</span> Tải File Mẫu Chuẩn UTC
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => setShowImportModal(false)}>Hủy</button>
                      <button
                        type="submit"
                        disabled={importLoading || !importFile}
                        className="btn-action-success"
                        style={{ border: 'none' }}
                      >
                        {importLoading ? 'Đang Import & Tạo TK...' : 'Bắt Đầu Import'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Import Result Screen */
                <div>
                  <div className="modal-content">
                    <div className="import-stats-summary">
                      <div className="stat-box">
                        <div className="num">{importResult.total}</div>
                        <div className="label">Tổng Bản Ghi</div>
                      </div>
                      <div className="stat-box success">
                        <div className="num">+{importResult.created}</div>
                        <div className="label">Tạo Mới Thành Công</div>
                      </div>
                      <div className="stat-box updated">
                        <div className="num">{importResult.updated}</div>
                        <div className="label">Đã Cập Nhật</div>
                      </div>
                      <div className="stat-box error">
                        <div className="num">{importResult.skipped}</div>
                        <div className="label">Bỏ Qua / Lỗi</div>
                      </div>
                    </div>

                    <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.95rem' }}>
                      📋 Danh Sách Tài Khoản Vừa Được Cấp Phát ({importResult.created_accounts.length})
                    </h4>

                    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <table className="user-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Tên đăng nhập (MSSV)</th>
                            <th>Họ và Tên</th>
                            <th>Lớp</th>
                            <th>Ngành</th>
                            <th>Mật Khẩu Khởi Tạo</th>
                            <th>Trạng Thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.created_accounts.map((acc, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 700, color: '#0284c7' }}>{acc.username}</td>
                              <td>{acc.full_name}</td>
                              <td>{acc.class_name}</td>
                              <td>{acc.major}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>
                                {acc.plain_password}
                              </td>
                              <td>
                                <span style={{ color: acc.status === 'created' ? '#16a34a' : '#2563eb', fontWeight: 600 }}>
                                  {acc.status === 'created' ? 'Mới' : 'Cập nhật'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button type="button" onClick={handleExportUsers} className="btn-action-primary">
                      <span>📥</span> Xuất Danh Sách Ra Excel
                    </button>
                    <button type="button" onClick={() => setShowImportModal(false)}>
                      Hoàn Tất & Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal 3: Quick Reset Password */}
        {showResetModal && selectedUser && (
          <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
            <div className="modal-container" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔑 Đặt Lại Mật Khẩu (Reset Password)</h2>
                <button className="close-button" onClick={() => setShowResetModal(false)}>✕</button>
              </div>

              <form onSubmit={handleResetPasswordSubmit}>
                <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    Tài khoản: <strong>{selectedUser.username}</strong> ({selectedUser.full_name || selectedUser.username})
                  </div>

                  {resetSuccessInfo && (
                    <div style={{ color: '#15803d', background: '#dcfce7', padding: '0.85rem', borderRadius: 8, fontSize: '0.9rem', border: '1px solid #86efac' }}>
                      <strong>🎉 Đặt lại mật khẩu thành công!</strong>
                      <div style={{ marginTop: 4 }}>
                        Mật khẩu mới: <strong>{resetSuccessInfo.password}</strong>
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>
                      Chọn phương thức đặt lại:
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="resetStrategy"
                          checked={resetStrategy === 'MSSV'}
                          onChange={() => setResetStrategy('MSSV')}
                        />
                        <span>Theo {selectedUser.user_type === 'student' ? 'Mã sinh viên (MSSV)' : 'Mã GV / Username'}</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="resetStrategy"
                          checked={resetStrategy === 'RANDOM'}
                          onChange={() => setResetStrategy('RANDOM')}
                        />
                        <span>Sinh mật khẩu ngẫu nhiên mới (8 ký tự)</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="resetStrategy"
                          checked={resetStrategy === 'CUSTOM'}
                          onChange={() => setResetStrategy('CUSTOM')}
                        />
                        <span>Tự nhập mật khẩu mới</span>
                      </label>
                    </div>

                    {resetStrategy === 'CUSTOM' && (
                      <input
                        type="text"
                        required
                        placeholder="Nhập mật khẩu mới..."
                        value={resetCustomPassword}
                        onChange={(e) => setResetCustomPassword(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #cbd5e1', marginTop: '0.5rem' }}
                      />
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={() => setShowResetModal(false)}>Đóng</button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-action-primary"
                    style={{ border: 'none' }}
                  >
                    {resetLoading ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Confirmation Modal */}
        {showConfirmModal && selectedUser && (
          <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
            <div className="modal-container" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Xác Nhận Thao Tác</h2>
                <button className="close-button" onClick={() => setShowConfirmModal(false)}>✕</button>
              </div>
              <div className="modal-content">
                {confirmActionType === 'status' ? (
                  <p>
                    Bạn có chắc chắn muốn{' '}
                    <strong>{selectedUser.is_active ? 'vô hiệu hóa (khóa)' : 'kích hoạt lại'}</strong> tài khoản{' '}
                    <strong>{selectedUser.username}</strong> ({selectedUser.full_name})?
                  </p>
                ) : (
                  <p style={{ color: '#b91c1c' }}>
                    ⚠️ Bạn có chắc chắn muốn <strong>xóa hoàn toàn</strong> tài khoản{' '}
                    <strong>{selectedUser.username}</strong> ({selectedUser.full_name}) khỏi hệ thống? Thao tác này không thể hoàn tác!
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowConfirmModal(false)}>Hủy</button>
                <button
                  type="button"
                  onClick={confirmAction}
                  style={{
                    background: confirmActionType === 'delete' ? '#ef4444' : '#0284c7',
                    color: '#fff',
                    padding: '6px 14px',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Xác Nhận
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default UserManagementPage;

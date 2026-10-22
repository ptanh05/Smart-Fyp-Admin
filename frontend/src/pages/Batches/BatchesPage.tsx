import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './BatchesPage.css';
import '../../components/common/Modal.css';

interface AcademicBatch {
  id: number;
  batch_code: string;
  batch_name: string;
  program_type: 'BACHELOR' | 'ENGINEER' | 'BOTH';
  current_stage: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_closed: boolean;
  student_count: number;
  project_count: number;
  classes: Array<{
    id: number;
    class_code: string;
    class_name: string;
    program_type: string;
    education_program: string;
    class_group: string;
    student_count: number;
  }>;
}

interface Department {
  id: number;
  code: string;
  name: string;
  description: string;
  supervisor_count: number;
}

interface SupervisorItem {
  id: number;
  supervisor_id: string;
  academic_title: string;
  department_name: string;
  department_obj: number | null;
  department_code?: string;
  academic_rank_multiplier: number;
  phone_number: string;
  research_interest: string;
  user_full_name?: string;
  username?: string;
}

export const BatchesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'departments' | 'supervisors'>('batches');
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Subtabs inside selected batch: 'students' or 'classes'
  const [batchDetailTab, setBatchDetailTab] = useState<'students' | 'classes'>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Toast Notification State
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // New batch form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBatchCode, setNewBatchCode] = useState('');
  const [newBatchName, setNewBatchName] = useState('');
  const [newProgramType, setNewProgramType] = useState<'BACHELOR' | 'ENGINEER' | 'BOTH'>('BACHELOR');

  // Import Excel form
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Add Manual Student Modal form
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addMssv, setAddMssv] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addClassId, setAddClassId] = useState<number | ''>('');
  const [addClassName, setAddClassName] = useState('');
  const [addEduProgram, setAddEduProgram] = useState<'BACHELOR' | 'ENGINEER'>('BACHELOR');
  const [addMajor, setAddMajor] = useState<'CNTT' | 'KHMT'>('CNTT');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // New Department Modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  // Edit Supervisor Modal
  const [editingSupervisor, setEditingSupervisor] = useState<SupervisorItem | null>(null);
  const [supTitle, setSupTitle] = useState('');
  const [supDeptId, setSupDeptId] = useState<number | ''>('');
  const [supMultiplier, setSupMultiplier] = useState(1.0);
  const [supInterest, setSupInterest] = useState('');

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/batches/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/admin/departments/');
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const res = await apiClient.get('/admin/users/?user_type=supervisor');
      const users = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.results || []);
      const supList: SupervisorItem[] = [];
      users.forEach((u: any) => {
        if (u.supervisor_profile) {
          supList.push({
            ...u.supervisor_profile,
            user_full_name: u.full_name || u.username,
            username: u.username
          });
        }
      });
      setSupervisors(supList);
    } catch (err) {
      console.error('Error fetching supervisors:', err);
    }
  };

  const fetchStudents = async (batchId: number) => {
    try {
      setStudentsLoading(true);
      const res = await apiClient.get(`/admin/users/?user_type=student&batch_id=${batchId}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.results || []);
      setStudents(list);
    } catch (err) {
      console.error('Error fetching students of batch:', err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchDepartments();
    fetchSupervisors();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchStudents(selectedBatchId);
      const curr = batches.find((b) => b.id === selectedBatchId);
      if (curr) {
        if (curr.program_type === 'ENGINEER') {
          setAddEduProgram('ENGINEER');
        } else {
          setAddEduProgram('BACHELOR');
        }
      }
    }
  }, [selectedBatchId, batches]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchCode || !newBatchName) return;

    try {
      await apiClient.post('/admin/batches/', {
        batch_code: newBatchCode,
        batch_name: newBatchName,
        program_type: newProgramType,
        is_active: true
      });
      setShowCreateModal(false);
      setNewBatchCode('');
      setNewBatchName('');
      setNewProgramType('BACHELOR');
      showToast('✓ Tạo đợt đồ án tốt nghiệp mới thành công!', 'success');
      fetchBatches();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi tạo đợt đồ án';
      showToast(`❌ ${msg}`, 'error');
    }
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedBatchId) return;

    try {
      setImporting(true);
      setImportResult(null);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('batch_id', selectedBatchId.toString());

      const res = await apiClient.post('/admin/students/import-excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data);
      showToast('✓ Import file Excel sinh viên thành công!', 'success');
      fetchBatches();
      fetchStudents(selectedBatchId);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Lỗi import Excel';
      showToast(`❌ ${msg}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  // Export Students in the exact format of Import Excel
  const handleExportStudents = async () => {
    if (!selectedBatchId) {
      showToast('Vui lòng chọn một đợt đồ án để xuất danh sách sinh viên!', 'info');
      return;
    }
    const currBatch = batches.find((b) => b.id === selectedBatchId);
    try {
      showToast('Đang kết xuất file Excel sinh viên chuẩn định dạng import...', 'info');
      const res = await apiClient.get(`/admin/students/export-excel/?batch_id=${selectedBatchId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Danh_Sach_Sinh_Vien_Dot_${currBatch?.batch_code || selectedBatchId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('✓ Đã xuất file Excel sinh viên thành công!', 'success');
    } catch (err: any) {
      showToast('❌ Lỗi xuất file Excel: ' + (err.message || 'Không thể tải file'), 'error');
    }
  };

  // Add Manual Student Handler
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMssv.trim() || !addFullName.trim()) {
      showToast('Mã sinh viên và Họ tên là các trường bắt buộc!', 'error');
      return;
    }
    if (!selectedBatchId) {
      showToast('Vui lòng chọn một đợt đồ án trước khi thêm sinh viên!', 'error');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    const parts = addFullName.trim().split(' ');
    const firstName = parts.length > 1 ? parts.pop()! : parts[0];
    const lastName = parts.join(' ');

    const payload: any = {
      user_type: 'student',
      username: addMssv.trim(),
      registration_no: addMssv.trim(),
      first_name: firstName,
      last_name: lastName,
      academic_batch_id: selectedBatchId,
      education_program: addEduProgram,
      major: addMajor,
      email: addEmail.trim() || `${addMssv.trim().toLowerCase()}@sv.utc.edu.vn`,
      phone_number: addPhone.trim(),
      password: 'Sv@123456',
    };

    if (addClassId) {
      payload.course_class_id = Number(addClassId);
    }
    if (addClassName.trim()) {
      payload.class_name = addClassName.trim();
    }

    try {
      await apiClient.post('/admin/users/', payload);
      setShowAddStudentModal(false);
      setAddMssv('');
      setAddFullName('');
      setAddClassId('');
      setAddClassName('');
      setAddEmail('');
      setAddPhone('');
      showToast(`✓ Đã thêm sinh viên ${addMssv.trim()} - ${addFullName.trim()} thành công!`, 'success');
      // Refetch table data
      fetchBatches();
      fetchStudents(selectedBatchId);
    } catch (err: any) {
      const errData = err.response?.data;
      const errMsg =
        errData?.username?.[0] ||
        errData?.registration_no?.[0] ||
        errData?.email?.[0] ||
        errData?.detail ||
        err.message ||
        'Không thể thêm sinh viên';
      setAddError(errMsg);
      showToast(`❌ Thêm sinh viên thất bại: ${errMsg}`, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode || !deptName) return;
    try {
      await apiClient.post('/admin/departments/', {
        code: deptCode,
        name: deptName,
        description: deptDesc
      });
      setShowDeptModal(false);
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      showToast('✓ Thêm bộ môn mới thành công!', 'success');
      fetchDepartments();
    } catch (err: any) {
      showToast('❌ Lỗi tạo bộ môn: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleOpenEditSupervisor = (sup: SupervisorItem) => {
    setEditingSupervisor(sup);
    setSupTitle(sup.academic_title || 'ThS');
    setSupDeptId(sup.department_obj || '');
    setSupMultiplier(sup.academic_rank_multiplier || 1.0);
    setSupInterest(sup.research_interest || '');
  };

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupervisor) return;
    try {
      await apiClient.patch(`/admin/supervisors/${editingSupervisor.id}/profile/`, {
        academic_title: supTitle,
        department_id: supDeptId ? Number(supDeptId) : null,
        academic_rank_multiplier: supMultiplier,
        research_interest: supInterest
      });
      setEditingSupervisor(null);
      fetchSupervisors();
      showToast('✓ Đã cập nhật học vị & hệ số capacity của Giảng viên thành công!', 'success');
    } catch (err: any) {
      showToast('❌ Lỗi cập nhật giảng viên: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleCloseBatch = async (batchId: number) => {
    if (!confirm('Bạn có chắc chắn muốn KẾT THÚC đợt đồ án này? Sau khi kết thúc, trạng thái đợt sẽ hoàn tất.')) return;
    try {
      await apiClient.post(`/admin/batches/${batchId}/close/`);
      showToast('✓ Đã kết thúc đợt đồ án thành công!', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast('❌ Lỗi kết thúc đợt: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  // Filter students for table display
  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.trim().toLowerCase();
    const fullName = (s.full_name || `${s.last_name || ''} ${s.first_name || ''}`).toLowerCase();
    const regNo = (s.student_profile?.registration_no || s.username || '').toLowerCase();
    const cls = (s.student_profile?.course_class?.class_name || s.student_profile?.department || '').toLowerCase();
    const eml = (s.email || '').toLowerCase();
    return fullName.includes(q) || regNo.includes(q) || cls.includes(q) || eml.includes(q);
  });

  const currBatch = batches.find((b) => b.id === selectedBatchId);

  return (
    <AdminLayout>
      <div className="utc-batches-portal">
        {/* Navigation Tabs */}
        <div className="utc-subnav-tabs">
          <button
            className={`utc-subnav-btn ${activeTab === 'batches' ? 'active' : ''}`}
            onClick={() => setActiveTab('batches')}
          >
            📅 Đợt Đồ Án & Sinh Viên Thuộc Đợt
          </button>
          <button
            className={`utc-subnav-btn ${activeTab === 'departments' ? 'active' : ''}`}
            onClick={() => setActiveTab('departments')}
          >
            🏢 Danh Mục Bộ Môn Khoa CNTT
          </button>
          <button
            className={`utc-subnav-btn ${activeTab === 'supervisors' ? 'active' : ''}`}
            onClick={() => setActiveTab('supervisors')}
          >
            👨‍🏫 Học Vị & Hướng Nghiên Cứu GV
          </button>
        </div>

        {/* TAB 1: BATCHES & STUDENTS */}
        {activeTab === 'batches' && (
          <>
            <div className="utc-batches-header-bar">
              <div className="utc-batches-header-info">
                <h3>Giai Đoạn 1: Khởi Tạo Đợt Đồ Án & Quản Lý Sinh Viên UTC</h3>
                <p>Khởi tạo đợt đồ án, thêm sinh viên thủ công hoặc import/export danh sách Excel chuẩn format đào tạo UTC</p>
              </div>
              <div className="utc-batches-actions">
                <button
                  type="button"
                  onClick={() => {
                    setAddError(null);
                    if (currBatch && currBatch.program_type !== 'BOTH') {
                      setAddEduProgram(currBatch.program_type);
                    }
                    setShowAddStudentModal(true);
                  }}
                  className="utc-btn-primary"
                  title="Thêm sinh viên thủ công vào đợt ĐATN"
                >
                  <span>👤➕</span> Thêm Sinh Viên
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="utc-btn-emerald"
                  title="Import sinh viên từ file Excel UTC"
                >
                  <span>📊</span> Import Sinh Viên (Excel)
                </button>

                <button
                  type="button"
                  onClick={handleExportStudents}
                  className="utc-btn-outline"
                  title="Xuất danh sách sinh viên đợt này ra file Excel đúng định dạng file mẫu import"
                >
                  <span>📤</span> Export Sinh Viên (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="utc-btn-primary"
                  style={{ background: '#475569' }}
                  title="Tạo đợt làm đồ án mới"
                >
                  <span>➕</span> Tạo đợt ĐATN mới
                </button>
              </div>
            </div>

            {loading ? (
              <div className="utc-loading-box">Đang tải danh sách đợt đồ án...</div>
            ) : batches.length === 0 ? (
              <div className="utc-empty-box">Chưa có đợt làm ĐATN nào. Hãy nhấn nút "Tạo đợt ĐATN mới".</div>
            ) : (
              <div className="utc-batches-grid">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`utc-batch-card ${selectedBatchId === batch.id ? 'selected' : ''}`}
                  >
                    <div className="utc-batch-card-head">
                      <div>
                        <span className="utc-batch-code-tag">{batch.batch_code}</span>
                        <span className={`utc-prog-tag prog-${batch.program_type.toLowerCase()}`}>
                          {batch.program_type === 'ENGINEER' ? '⚙️ Kỹ Sư' : batch.program_type === 'BACHELOR' ? '🎓 Cử Nhân' : '🔄 Cả Hai'}
                        </span>
                      </div>
                      <span className={`utc-status-pill ${batch.is_closed ? 'pill-gray' : 'pill-green'}`}>
                        {batch.is_closed ? '🔒 Đã kết thúc' : '🟢 Đang mở'}
                      </span>
                    </div>

                    <h4 className="utc-batch-name">{batch.batch_name}</h4>
                    <div className="utc-batch-stage-text">
                      <strong>Vòng đời:</strong> {batch.current_stage}
                    </div>

                    <div className="utc-batch-stats">
                      <div className="utc-stat-item">
                        <span className="utc-stat-label">Sinh viên</span>
                        <span className="utc-stat-value">{batch.student_count || 0}</span>
                      </div>
                      <div className="utc-stat-item">
                        <span className="utc-stat-label">Lớp học phần</span>
                        <span className="utc-stat-value">{batch.classes?.length || 0}</span>
                      </div>
                      <div className="utc-stat-item">
                        <span className="utc-stat-label">Đề tài đồ án</span>
                        <span className="utc-stat-value">{batch.project_count || 0}</span>
                      </div>
                    </div>

                    <div className="utc-batch-footer">
                      <span>{batch.is_closed ? 'Đợt đã lưu trữ' : 'Nhấp để xem sinh viên & lớp học'}</span>
                      {!batch.is_closed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseBatch(batch.id);
                          }}
                          className="utc-btn-close-batch"
                          title="Kết thúc đợt đồ án"
                        >
                          Kết thúc đợt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Batch Details */}
            {selectedBatchId && (
              <div className="utc-classes-section">
                <div className="utc-classes-header">
                  <h4>Quản lý Dữ liệu Đợt ĐATN: #{selectedBatchId} - {currBatch?.batch_name}</h4>
                  <span className="utc-classes-subtitle">Rà soát danh sách sinh viên & các lớp học phần được phân công trong đợt</span>
                </div>

                <div className="utc-batch-subtabs">
                  <button
                    type="button"
                    className={`utc-batch-subtab-btn ${batchDetailTab === 'students' ? 'active' : ''}`}
                    onClick={() => setBatchDetailTab('students')}
                  >
                    <span>🎓</span> Danh Sách Sinh Viên Thuộc Đợt
                    <span className="utc-batch-subtab-badge">{students.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`utc-batch-subtab-btn ${batchDetailTab === 'classes' ? 'active' : ''}`}
                    onClick={() => setBatchDetailTab('classes')}
                  >
                    <span>🏫</span> Danh Sách Lớp Học Phần
                    <span className="utc-batch-subtab-badge">{currBatch?.classes?.length || 0}</span>
                  </button>
                </div>

                {/* Subtab Content: Students */}
                {batchDetailTab === 'students' && (
                  <div>
                    <div className="utc-student-search-bar">
                      <input
                        type="text"
                        placeholder="🔍 Tìm kiếm sinh viên theo MSSV, Họ tên, Lớp..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="utc-search-input"
                      />
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          Hiển thị <strong>{filteredStudents.length}</strong> / {students.length} sinh viên
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddError(null);
                            setShowAddStudentModal(true);
                          }}
                          className="utc-btn-sm-edit"
                          style={{ background: '#0284c7', color: '#fff', borderColor: '#0284c7', padding: '0.45rem 0.85rem' }}
                        >
                          ➕ Thêm Sinh Viên Mới
                        </button>
                      </div>
                    </div>

                    {studentsLoading ? (
                      <div className="utc-loading-box">Đang tải danh sách sinh viên...</div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="utc-empty-classes">
                        {students.length === 0
                          ? 'Đợt này chưa có sinh viên nào. Bạn có thể nhấn nút "Thêm Sinh Viên" hoặc "Import Sinh Viên (Excel)" phía trên.'
                          : 'Không tìm thấy sinh viên nào khớp với từ khóa tìm kiếm.'}
                      </div>
                    ) : (
                      <div className="utc-classes-table-wrapper">
                        <table className="utc-classes-table">
                          <thead>
                            <tr>
                              <th style={{ width: '50px' }}>STT</th>
                              <th>Mã Sinh Viên (MSSV)</th>
                              <th>Họ và Tên</th>
                              <th>Lớp Sinh Hoạt / HP</th>
                              <th>Hệ Đào Tạo</th>
                              <th>Email</th>
                              <th>Số Điện Thoại</th>
                              <th>Trạng Thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((st, idx) => {
                              const stdProf = st.student_profile || {};
                              const regNo = stdProf.registration_no || st.username;
                              const fullName = st.full_name || `${st.last_name || ''} ${st.first_name || ''}`.trim() || st.username;
                              const className = stdProf.course_class?.class_name || stdProf.department || stdProf.batch_no || '—';
                              const eduProg = stdProf.education_program || stdProf.degree_program || (stdProf.course_class?.education_program) || 'BACHELOR';
                              const phone = stdProf.phone_number || st.phone_number || '—';
                              const email = st.email || `${regNo}@sv.utc.edu.vn`;

                              return (
                                <tr key={st.id || idx}>
                                  <td className="text-center font-bold text-gray-500">{idx + 1}</td>
                                  <td className="font-bold text-blue-700">{regNo}</td>
                                  <td className="font-semibold">{fullName}</td>
                                  <td>{className}</td>
                                  <td>
                                    <span className={`utc-badge-edu ${eduProg === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                                      {eduProg === 'ENGINEER' ? '⚙️ Kỹ sư' : '🎓 Cử nhân'}
                                    </span>
                                  </td>
                                  <td>{email}</td>
                                  <td>{phone}</td>
                                  <td>
                                    <span className="utc-badge-active">
                                      {st.is_active ? '🟢 Hoạt động' : '🔴 Khóa'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab Content: Classes */}
                {batchDetailTab === 'classes' && (
                  <div>
                    {(!currBatch || !currBatch.classes || currBatch.classes.length === 0) ? (
                      <div className="utc-empty-classes">Đợt này chưa có dữ liệu lớp học phần. Hãy nhấn nút Import Excel để tạo lớp tự động.</div>
                    ) : (
                      <div className="utc-classes-table-wrapper">
                        <table className="utc-classes-table">
                          <thead>
                            <tr>
                              <th>Mã Lớp HP</th>
                              <th>Tên Lớp Học Phần</th>
                              <th>Chương trình</th>
                              <th>Hệ đào tạo</th>
                              <th>Nhóm</th>
                              <th>Số Sinh Viên</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currBatch.classes.map((cls) => (
                              <tr key={cls.id}>
                                <td className="font-bold">{cls.class_code}</td>
                                <td>{cls.class_name}</td>
                                <td>
                                  <span className="utc-badge-prog">{cls.program_type}</span>
                                </td>
                                <td>
                                  <span className={`utc-badge-edu ${cls.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                                    {cls.education_program === 'ENGINEER' ? '⚙️ Kỹ sư' : '🎓 Cử nhân'}
                                  </span>
                                </td>
                                <td>{cls.class_group || '—'}</td>
                                <td className="text-center font-bold text-blue-600">{cls.student_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 2: DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="utc-dept-section">
            <div className="utc-batches-header-bar">
              <div className="utc-batches-header-info">
                <h3>Thiết Lập Quan Hệ Khoa – Bộ Môn – Giảng Viên (Bước 6)</h3>
                <p>Quản lý các bộ môn chuyên môn trực thuộc Khoa CNTT phục vụ phân chia đề tài & hội đồng</p>
              </div>
              <button onClick={() => setShowDeptModal(true)} className="utc-btn-primary">
                <span>➕</span> Thêm Bộ Môn Mới
              </button>
            </div>

            <div className="utc-dept-grid">
              {departments.length === 0 ? (
                <div className="utc-empty-box">Chưa có bộ môn nào. Hãy thêm bộ môn mới.</div>
              ) : (
                departments.map((dept) => (
                  <div key={dept.id} className="utc-dept-card">
                    <div className="utc-dept-head">
                      <span className="utc-dept-code">{dept.code}</span>
                      <span className="utc-dept-count">👨‍🏫 {dept.supervisor_count || 0} Giảng viên</span>
                    </div>
                    <h4>{dept.name}</h4>
                    <p>{dept.description || 'Chuyên ngành kỹ thuật thuộc Khoa CNTT UTC.'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUPERVISORS */}
        {activeTab === 'supervisors' && (
          <div className="utc-sup-section">
            <div className="utc-batches-header-bar">
              <div className="utc-batches-header-info">
                <h3>Cập Nhật Hướng Nghiên Cứu, Học Vị & Hệ Số Capacity GV (Bước 7)</h3>
                <p>Khoa thiết lập học vị (GS/PGS/TS/ThS), hệ số định mức và bộ môn chuyên môn cho từng giảng viên</p>
              </div>
            </div>

            <div className="utc-classes-table-wrapper">
              <table className="utc-classes-table">
                <thead>
                  <tr>
                    <th>Mã GV</th>
                    <th>Họ và Tên Giảng Viên</th>
                    <th>Học Vị / Chức Danh</th>
                    <th>Bộ Môn</th>
                    <th>Hệ Số Capacity</th>
                    <th>Hướng Nghiên Cứu</th>
                    <th>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisors.map((s) => (
                    <tr key={s.id}>
                      <td className="font-bold">{s.supervisor_id || s.username}</td>
                      <td>{s.user_full_name}</td>
                      <td>
                        <span className={`utc-title-badge title-${(s.academic_title || '').toLowerCase()}`}>
                          {s.academic_title || 'ThS'}
                        </span>
                      </td>
                      <td>{s.department_name || 'Khoa CNTT'}</td>
                      <td className="text-center font-bold text-emerald-600">x{s.academic_rank_multiplier || 1.0}</td>
                      <td style={{ maxWidth: '250px' }}>{s.research_interest || 'Chưa cập nhật'}</td>
                      <td>
                        <button onClick={() => handleOpenEditSupervisor(s)} className="utc-btn-sm-edit">
                          ✏️ Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: CREATE BATCH */}
        {showCreateModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>➕ Tạo Đợt Đồ Án Tốt Nghiệp Mới</h4>
                <button onClick={() => setShowCreateModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleCreateBatch}>
                <div className="utc-form-group">
                  <label>Mã Đợt Đồ Án (Batch Code):</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 2026-DOT1-CNTT"
                    value={newBatchCode}
                    onChange={(e) => setNewBatchCode(e.target.value)}
                    className="utc-input"
                  />
                </div>

                <div className="utc-form-group">
                  <label>Tên Đợt Đồ Án:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đồ án tốt nghiệp Học kỳ 2 Năm 2025-2026"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    className="utc-input"
                  />
                </div>

                <div className="utc-form-group">
                  <label>Chương Trình Đào Tạo (Nút quyết định quy trình):</label>
                  <div className="utc-radio-group">
                    <label className={`utc-radio-card ${newProgramType === 'BACHELOR' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="prog"
                        value="BACHELOR"
                        checked={newProgramType === 'BACHELOR'}
                        onChange={() => setNewProgramType('BACHELOR')}
                      />
                      <div>
                        <strong>🎓 Cử Nhân (Bachelor)</strong>
                        <p>Quy chuẩn đồ án cử nhân, không bắt buộc GVHD học vị TS.</p>
                      </div>
                    </label>

                    <label className={`utc-radio-card ${newProgramType === 'ENGINEER' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="prog"
                        value="ENGINEER"
                        checked={newProgramType === 'ENGINEER'}
                        onChange={() => setNewProgramType('ENGINEER')}
                      />
                      <div>
                        <strong>⚙️ Kỹ Sư (Engineer)</strong>
                        <p>Ràng buộc cứng: GVHD bắt buộc phải đạt học vị Tiến sĩ (TS) trở lên.</p>
                      </div>
                    </label>

                    <label className={`utc-radio-card ${newProgramType === 'BOTH' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="prog"
                        value="BOTH"
                        checked={newProgramType === 'BOTH'}
                        onChange={() => setNewProgramType('BOTH')}
                      />
                      <div>
                        <strong>🔄 Cả Hai (Hỗn hợp)</strong>
                        <p>Kiểm tra ràng buộc theo từng lớp học phần của sinh viên.</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Khởi Tạo Đợt</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: IMPORT EXCEL */}
        {showImportModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>📊 Import Danh Sách Sinh Viên Theo File Excel UTC</h4>
                <button onClick={() => setShowImportModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleImportExcel}>
                <div className="utc-form-group">
                  <label>Chọn Đợt Đồ Án áp dụng:</label>
                  <select
                    className="utc-input"
                    value={selectedBatchId || ''}
                    onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                    required
                  >
                    <option value="">-- Chọn đợt --</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_code} - {b.batch_name} ({b.program_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="utc-form-group">
                  <label>Chọn File Excel (.xlsx):</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    required
                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                    className="utc-input"
                  />
                  <small style={{ color: '#64748b', display: 'block', marginTop: '0.4rem' }}>
                    File Excel xuất từ Cổng đào tạo UTC hoặc file xuất từ nút "Export Sinh Viên" đều được hỗ trợ.
                  </small>
                </div>

                {importResult && (
                  <div className="utc-alert-box" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: 8, margin: '1rem 0' }}>
                    <strong style={{ color: '#065f46' }}>✅ Kết quả import Excel:</strong>
                    <div style={{ marginTop: '0.25rem' }}>Tổng số dòng dữ liệu: <strong>{importResult.total}</strong></div>
                    <div style={{ color: '#059669' }}>Tạo mới thành công: <strong>{importResult.created}</strong> sinh viên</div>
                    <div style={{ color: '#2563eb' }}>Cập nhật: <strong>{importResult.updated}</strong> sinh viên</div>
                    {importResult.skipped > 0 && <div style={{ color: '#d97706' }}>Bỏ qua: <strong>{importResult.skipped}</strong></div>}
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="utc-btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                        onClick={() => {
                          setShowImportModal(false);
                          setBatchDetailTab('students');
                          if (selectedBatchId) fetchStudents(selectedBatchId);
                        }}
                      >
                        👥 Xem danh sách sinh viên đợt
                      </button>
                    </div>
                  </div>
                )}

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowImportModal(false)} className="utc-btn-cancel">Đóng</button>
                  <button type="submit" disabled={importing} className="utc-btn-emerald">
                    {importing ? 'Đang phân tích & import...' : 'Bắt Đầu Import'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: MANUAL ADD STUDENT FORM */}
        {showAddStudentModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card" style={{ maxWidth: '580px' }}>
              <div className="utc-modal-head">
                <h4>👤➕ Thêm Sinh Viên Thủ Công Vào Đợt ĐATN</h4>
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="utc-btn-close"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit}>
                <div style={{ padding: '1.25rem' }}>
                  {addError && (
                    <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #f87171', padding: '0.65rem 0.9rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.88rem' }}>
                      ❌ {addError}
                    </div>
                  )}

                  {/* Required Fields: MSSV & Họ và Tên */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.85rem', marginBottom: '0.9rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Mã Sinh Viên (MSSV) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: 201200021"
                        value={addMssv}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setAddMssv(val);
                          if (!addEmail || addEmail.endsWith('@sv.utc.edu.vn')) {
                            setAddEmail(val ? `${val.toLowerCase()}@sv.utc.edu.vn` : '');
                          }
                        }}
                        className="utc-input"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Họ và Tên <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Nguyễn Hoàng Minh"
                        value={addFullName}
                        onChange={(e) => setAddFullName(e.target.value)}
                        className="utc-input"
                      />
                    </div>
                  </div>

                  {/* Program & Major Selection */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.9rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Hệ đào tạo <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        className="utc-input"
                        value={addEduProgram}
                        onChange={(e) => setAddEduProgram(e.target.value as 'BACHELOR' | 'ENGINEER')}
                      >
                        <option value="BACHELOR">🎓 Cử nhân (Bachelor)</option>
                        <option value="ENGINEER">⚙️ Kỹ sư (Engineer)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Ngành đào tạo
                      </label>
                      <select
                        className="utc-input"
                        value={addMajor}
                        onChange={(e) => setAddMajor(e.target.value as 'CNTT' | 'KHMT')}
                      >
                        <option value="CNTT">💻 Công nghệ thông tin</option>
                        <option value="KHMT">🧠 Khoa học máy tính</option>
                      </select>
                    </div>
                  </div>

                  {/* Class Selection */}
                  <div style={{ marginBottom: '0.9rem' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                      Lớp sinh hoạt / Lớp học phần
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: currBatch?.classes?.length ? '1.2fr 1fr' : '1fr', gap: '0.5rem' }}>
                      {currBatch?.classes && currBatch.classes.length > 0 && (
                        <select
                          className="utc-input"
                          value={addClassId}
                          onChange={(e) => {
                            const cid = e.target.value ? Number(e.target.value) : '';
                            setAddClassId(cid);
                            const found = currBatch.classes.find((c) => c.id === cid);
                            if (found) {
                              setAddClassName(found.class_name);
                              setAddEduProgram(found.education_program as any || addEduProgram);
                            }
                          }}
                        >
                          <option value="">-- Chọn lớp có sẵn trong đợt --</option>
                          {currBatch.classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.class_code} - {c.class_name} ({c.education_program})
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder="Hoặc nhập tên lớp (vd: CNTT1-K62)"
                        value={addClassName}
                        onChange={(e) => setAddClassName(e.target.value)}
                        className="utc-input"
                      />
                    </div>
                  </div>

                  {/* Email & Phone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Email sinh viên
                      </label>
                      <input
                        type="email"
                        placeholder="vd: 201200021@sv.utc.edu.vn"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        className="utc-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        placeholder="vd: 0912345678"
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        className="utc-input"
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
                    💡 <strong>Ghi chú:</strong> Mật khẩu ban đầu mặc định là <code>Sv@123456</code> (hoặc MSSV). Sinh viên có thể đổi mật khẩu sau khi đăng nhập vào hệ thống.
                  </div>
                </div>

                <div className="utc-modal-foot">
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(false)}
                    className="utc-btn-cancel"
                    disabled={addLoading}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="utc-btn-primary"
                    disabled={addLoading}
                  >
                    {addLoading ? 'Đang lưu...' : 'Lưu Sinh Viên'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: CREATE DEPARTMENT */}
        {showDeptModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>🏢 Thêm Bộ Môn Chuyên Môn Trực Thuộc Khoa CNTT</h4>
                <button onClick={() => setShowDeptModal(false)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleCreateDepartment}>
                <div className="utc-form-group">
                  <label>Mã Bộ Môn:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: CNPM, MHTTT, KHMT, HTTT"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    className="utc-input"
                  />
                </div>
                <div className="utc-form-group">
                  <label>Tên Bộ Môn:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Bộ môn Công nghệ Phần mềm"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="utc-input"
                  />
                </div>
                <div className="utc-form-group">
                  <label>Mô tả chuyên môn:</label>
                  <textarea
                    rows={3}
                    placeholder="Mô tả các hướng nghiên cứu trọng tâm..."
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    className="utc-input"
                  />
                </div>
                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setShowDeptModal(false)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Lưu Bộ Môn</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: EDIT SUPERVISOR */}
        {editingSupervisor && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <h4>✏️ Cập Nhật Hồ Sơ Giảng Viên: {editingSupervisor.user_full_name}</h4>
                <button onClick={() => setEditingSupervisor(null)} className="utc-btn-close">✕</button>
              </div>
              <form onSubmit={handleSaveSupervisor}>
                <div className="utc-form-group">
                  <label>Học vị / Học hàm:</label>
                  <select
                    className="utc-input"
                    value={supTitle}
                    onChange={(e) => {
                      const t = e.target.value;
                      setSupTitle(t);
                      if (t === 'GS.TS') setSupMultiplier(2.0);
                      else if (t === 'PGS.TS') setSupMultiplier(1.5);
                      else if (t === 'TS') setSupMultiplier(1.2);
                      else setSupMultiplier(1.0);
                    }}
                  >
                    <option value="ThS">ThS - Thạc sĩ (Hệ số x1.0)</option>
                    <option value="TS">TS - Tiến sĩ (Hệ số x1.2 - Đủ chuẩn Kỹ sư)</option>
                    <option value="PGS.TS">PGS.TS - Phó Giáo sư (Hệ số x1.5 - Đủ chuẩn Kỹ sư)</option>
                    <option value="GS.TS">GS.TS - Giáo sư (Hệ số x2.0 - Đủ chuẩn Kỹ sư)</option>
                  </select>
                </div>

                <div className="utc-form-group">
                  <label>Bộ Môn Chuyên Môn:</label>
                  <select
                    className="utc-input"
                    value={supDeptId}
                    onChange={(e) => setSupDeptId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">-- Chưa gán bộ môn --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div className="utc-form-group">
                  <label>Hệ số Capacity (Tự động nhân với chỉ tiêu cơ sở):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={supMultiplier}
                    onChange={(e) => setSupMultiplier(parseFloat(e.target.value) || 1.0)}
                    className="utc-input"
                  />
                  <small style={{ color: '#64748b' }}>
                    Chỉ tiêu tối đa của GV = Base Quota * Hệ số ({supMultiplier}).
                  </small>
                </div>

                <div className="utc-form-group">
                  <label>Hướng nghiên cứu chuyên sâu:</label>
                  <textarea
                    rows={3}
                    value={supInterest}
                    onChange={(e) => setSupInterest(e.target.value)}
                    placeholder="VD: Trí tuệ nhân tạo, Big Data, Phát triển phần mềm doanh nghiệp..."
                    className="utc-input"
                  />
                </div>

                <div className="utc-modal-foot">
                  <button type="button" onClick={() => setEditingSupervisor(null)} className="utc-btn-cancel">Hủy</button>
                  <button type="submit" className="utc-btn-primary">Lưu Thay Đổi</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION POPUP */}
        {toast && (
          <div className="utc-toast-container">
            <div className={`utc-toast-item ${toast.type}`}>
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="utc-toast-close"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

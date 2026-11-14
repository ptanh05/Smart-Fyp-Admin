import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import SelectedBatchProgress from '../../components/SelectedBatchProgress';
import QuotaRow from './QuotaRow';
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
  const [activeTab, setActiveTab] = useState<'batches' | 'archived' | 'departments' | 'supervisors'>('batches');
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [showBatchConfigModal, setShowBatchConfigModal] = useState(false);

  // Subtabs inside selected batch: 'students' | 'classes' | 'supervisors'
  const [batchDetailTab, setBatchDetailTab] = useState<'students' | 'classes' | 'supervisors'>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Quota của giảng viên trong đợt (GĐ1 - cấu hình chỉ tiêu hướng dẫn)
  const [quotas, setQuotas] = useState<any[]>([]);
  const [quotasLoading, setQuotasLoading] = useState(false);
  const [quotaSearch, setQuotaSearch] = useState('');
  const [showSupervisorPicker, setShowSupervisorPicker] = useState(false);
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<number[]>([]);
  const [savingSupervisors, setSavingSupervisors] = useState(false);

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
  // Cơ chế mật khẩu khi import sinh viên vào đợt
  const [importPasswordStrategy, setImportPasswordStrategy] = useState<'MSSV' | 'FIXED' | 'RANDOM'>('FIXED');
  const [importFixedPassword, setImportFixedPassword] = useState('Password@123');

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
  const [addErrors, setAddErrors] = useState<{ mssv?: string; fullName?: string; email?: string; phone?: string }>({});
  const [addTouched, setAddTouched] = useState<{ mssv?: boolean; fullName?: boolean; email?: boolean; phone?: boolean }>({});

  const validateMssv = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return 'Mã sinh viên không được để trống';
    if (!/^\d{9}$/.test(trimmed)) return 'Mã sinh viên UTC phải gồm đúng 9 chữ số (Ví dụ: 201200021)';
    return undefined;
  };

  const validateFullName = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return 'Họ và tên không được để trống';
    if (trimmed.length < 2) return 'Họ và tên phải có ít nhất 2 ký tự';
    return undefined;
  };

  const validateEmail = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Email không đúng định dạng';
    return undefined;
  };

  const validatePhone = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (!/^0\d{9}$/.test(trimmed)) return 'Số điện thoại phải gồm 10 chữ số (bắt đầu bằng 0)';
    return undefined;
  };

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
  const [supTopicAreaIds, setSupTopicAreaIds] = useState<number[]>([]);
  const [topicAreas, setTopicAreas] = useState<any[]>([]);

  // View Students in Batch Modal
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [studentsModalBatch, setStudentsModalBatch] = useState<AcademicBatch | null>(null);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [studentsModalLoading, setStudentsModalLoading] = useState(false);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsFilterClass, setStudentsFilterClass] = useState<string>('ALL');

  const handleOpenStudentsModal = async (batch: AcademicBatch, filterClass: string = 'ALL') => {
    setStudentsModalBatch(batch);
    setStudentsFilterClass(filterClass);
    setStudentsSearch('');
    setShowStudentsModal(true);
    setStudentsModalLoading(true);
    try {
      const res = await apiClient.get('/admin/users/', {
        params: {
          user_type: 'student',
          batch_id: batch.id,
        },
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.results || []);
      setStudentsList(list);
    } catch (err) {
      console.error('Lỗi tải danh sách sinh viên đợt:', err);
      setStudentsList([]);
    } finally {
      setStudentsModalLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/batches/?_t=${Date.now()}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBatches(list);
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

  const fetchTopicAreas = async () => {
    try {
      const res = await apiClient.get('/admin/topic-areas/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setTopicAreas(list);
    } catch (err) {
      console.error('Error fetching topic areas:', err);
      setTopicAreas([]);
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

  const fetchQuotas = async (batchId: number) => {
    try {
      setQuotasLoading(true);
      const res = await apiClient.get(`/admin/quotas/?batch_id=${batchId}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setQuotas(list);
    } catch (err) {
      console.error('Error fetching quotas of batch:', err);
      setQuotas([]);
    } finally {
      setQuotasLoading(false);
    }
  };

  const handleSaveQuota = async (quota: any, maxTotal: number) => {
    try {
      await apiClient.put('/admin/quotas/', [
        {
          id: quota.id,
          max_total_quota: maxTotal,
          viet_anh_quota: quota.viet_anh_quota,
          general_cntt_quota: quota.general_cntt_quota,
        },
      ]);
      showToast(`✓ Đã cập nhật quota của ${quota.supervisor_name || 'giảng viên'}: ${maxTotal} SV`, 'success');
      fetchQuotas(selectedBatchId!);
    } catch (err: any) {
      showToast('❌ Lỗi cập nhật quota: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const openSupervisorPicker = () => {
    setSelectedSupervisorIds(quotas.map((quota) => Number(quota.supervisor)));
    setShowSupervisorPicker(true);
  };

  const handleSaveBatchSupervisors = async () => {
    if (!selectedBatchId) return;
    if (selectedSupervisorIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một giảng viên tham gia đợt.', 'error');
      return;
    }
    try {
      setSavingSupervisors(true);
      const res = await apiClient.post('/admin/quotas/', {
        batch_id: selectedBatchId,
        supervisor_ids: selectedSupervisorIds,
      });
      setQuotas(Array.isArray(res.data) ? res.data : []);
      setShowSupervisorPicker(false);
      showToast(`✓ Đã cập nhật ${selectedSupervisorIds.length} giảng viên tham gia đợt.`, 'success');
    } catch (err: any) {
      showToast('❌ Không thể cập nhật giảng viên: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setSavingSupervisors(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchBatches(), fetchDepartments(), fetchSupervisors(), fetchTopicAreas()]);
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchStudents(selectedBatchId);
      fetchQuotas(selectedBatchId);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId && batches.length > 0) {
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
      formData.append('password_strategy', importPasswordStrategy);
      if (importPasswordStrategy === 'FIXED') {
        formData.append('custom_fixed_password', importFixedPassword || 'Password@123');
      }

      const res = await apiClient.post('/admin/students/import-excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data);
      if (res.data?.success) {
        showToast(`✓ Import sinh viên thành công! (${res.data.created || 0} mới, ${res.data.updated || 0} cập nhật)`, 'success');
      } else {
        showToast(res.data?.detail || 'Import hoàn tất với một số cảnh báo.', 'info');
      }
      fetchBatches();
      fetchStudents(selectedBatchId);
    } catch (err: any) {
      let msg = err.response?.data?.detail || err.response?.data?.error || err.response?.data?.message;
      if (!msg) {
        if (err.message === 'Network Error' || !err.response) {
          msg = 'Không thể kết nối đến máy chủ backend (lỗi mạng hoặc quá thời gian xử lý file). Vui lòng thử lại.';
        } else {
          msg = err.message || 'Lỗi xử lý file Excel sinh viên';
        }
      }
      showToast(`❌ ${msg}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  // Tải file danh sách sinh viên MẪU (dùng để test chức năng Import)
  const handleDownloadSampleRoster = async () => {
    try {
      showToast('Đang tải file danh sách sinh viên mẫu...', 'info');
      const res = await apiClient.get('/admin/students/sample-roster/', {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Danh_Sach_Sinh_Vien_Mau_Import_UTC_K62.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('✓ Đã tải file danh sách sinh viên mẫu (216 SV, 9 lớp)!', 'success');
    } catch (err: any) {
      showToast('❌ Lỗi tải file mẫu: ' + (err.message || 'Không thể tải file'), 'error');
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
    const mssvErr = validateMssv(addMssv);
    const nameErr = validateFullName(addFullName);
    const emailErr = validateEmail(addEmail);
    const phoneErr = validatePhone(addPhone);

    const newErrors = {
      mssv: mssvErr,
      fullName: nameErr,
      email: emailErr,
      phone: phoneErr,
    };
    setAddErrors(newErrors);
    setAddTouched({ mssv: true, fullName: true, email: true, phone: true });

    if (mssvErr || nameErr || emailErr || phoneErr) {
      showToast(mssvErr || nameErr || emailErr || phoneErr || 'Vui lòng kiểm tra lại thông tin nhập!', 'error');
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
    setSupTopicAreaIds((sup as any).topic_area_ids || []);
  };

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupervisor) return;
    try {
      await apiClient.patch(`/admin/supervisors/${editingSupervisor.id}/profile/`, {
        academic_title: supTitle,
        department_id: supDeptId ? Number(supDeptId) : null,
        academic_rank_multiplier: supMultiplier,
        research_interest: supInterest,
        topic_area_ids: supTopicAreaIds
      });
      setEditingSupervisor(null);
      fetchSupervisors();
      showToast('✓ Đã cập nhật học vị & hệ số capacity của Giảng viên thành công!', 'success');
    } catch (err: any) {
      showToast('❌ Lỗi cập nhật giảng viên: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleCloseBatch = async (batchId: number) => {
    if (!confirm('Bạn có chắc chắn muốn KẾT THÚC đợt đồ án này? Sau khi kết thúc, đợt sẽ được chuyển vào Kho lưu trữ các đợt đã hoàn tất.')) return;
    try {
      // Optimistic state update: mark as closed immediately
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batchId ? { ...b, is_closed: true, is_active: false, current_stage: 'COMPLETED' } : b
        )
      );
      const res = await apiClient.post(`/admin/batches/${batchId}/close/`);
      showToast(res.data?.message || '✓ Đã kết thúc và chuyển đợt đồ án vào kho lưu trữ thành công!', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast('❌ Lỗi kết thúc đợt: ' + (err.response?.data?.detail || err.message), 'error');
      fetchBatches();
    }
  };

  const handleReopenBatch = async (batchId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn MỞ LẠI đợt đồ án này?')) return;
    try {
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batchId ? { ...b, is_closed: false, is_active: true } : b
        )
      );
      const res = await apiClient.post(`/admin/batches/${batchId}/reopen/`);
      showToast(res.data?.message || '✓ Đã mở lại đợt đồ án thành công!', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast('❌ Lỗi mở lại đợt: ' + (err.response?.data?.detail || err.message), 'error');
      fetchBatches();
    }
  };

  const handleOpenBatch = async (batchId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const batch = batches.find((item) => item.id === batchId);
    if (!batch || (batch.student_count || 0) === 0) {
      showToast('❌ Không thể mở đợt khi chưa có sinh viên. Hãy thêm hoặc import sinh viên trước.', 'error');
      return;
    }
    let batchQuotas = batchId === selectedBatchId ? quotas : [];
    if (batchId !== selectedBatchId) {
      try {
        const quotaRes = await apiClient.get(`/admin/quotas/?batch_id=${batchId}`);
        batchQuotas = Array.isArray(quotaRes.data) ? quotaRes.data : [];
      } catch {
        batchQuotas = [];
      }
    }
    if (batchQuotas.length === 0) {
      setSelectedBatchId(batchId);
      setBatchDetailTab('supervisors');
      setShowBatchConfigModal(true);
      showToast('❌ Hãy chọn ít nhất một giảng viên tham gia đợt trước khi mở.', 'error');
      return;
    }
    if (!confirm('Mở đợt cho sinh viên đăng ký nguyện vọng ngay bây giờ?')) return;
    try {
      const res = await apiClient.post(`/admin/batches/${batchId}/open/`);
      showToast(res.data?.message || '✓ Đã MỞ đợt. Sinh viên có thể đăng ký nguyện vọng!', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast('❌ Lỗi mở đợt: ' + (err.response?.data?.detail || err.message), 'error');
      fetchBatches();
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
  const activeBatches = batches.filter((b) => !b.is_closed && b.is_active !== false && b.current_stage !== 'COMPLETED');
  const archivedBatches = batches.filter((b) => b.is_closed || b.is_active === false || b.current_stage === 'COMPLETED');

  const filteredQuotas = quotas.filter((q) => {
    if (!quotaSearch.trim()) return true;
    const t = quotaSearch.trim().toLowerCase();
    return (
      (q.supervisor_name || '').toLowerCase().includes(t) ||
      (q.supervisor_id_code || '').toLowerCase().includes(t) ||
      (q.department || '').toLowerCase().includes(t)
    );
  });

  return (
    <AdminLayout>
      <div className="utc-batches-portal">
        {/* Thanh trên cùng luôn bám theo đúng đợt người dùng chọn ở danh sách. */}
        {selectedBatchId && currBatch && (
          <SelectedBatchProgress
            key={`tracked-${selectedBatchId}-${currBatch.current_stage}-${currBatch.is_closed}`}
            batchId={selectedBatchId}
          />
        )}

        {/* Navigation Tabs */}
        <div className="utc-subnav-tabs">
          <button
            className={`utc-subnav-btn ${activeTab === 'batches' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('batches');
              setSelectedBatchId(null);
            }}
          >
            📅 Đợt Đang Hoạt Động ({activeBatches.length})
          </button>
          <button
            className={`utc-subnav-btn ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('archived');
              if (!archivedBatches.some((batch) => batch.id === selectedBatchId)) {
                const nextBatchId = archivedBatches[0]?.id ?? null;
                setSelectedBatchId(nextBatchId);
                if (nextBatchId) localStorage.setItem('utc_selected_batch_id', String(nextBatchId));
              }
            }}
          >
            🗄️ Kho Lưu Trữ Đợt Đã Kết Thúc ({archivedBatches.length})
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
                <p>Khởi tạo đợt đồ án mới. Chọn một đợt bên dưới để quản lý sinh viên và dữ liệu của đợt đó.</p>
              </div>
              <div className="utc-batches-actions">
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
            ) : activeBatches.length === 0 ? (
              <div className="utc-empty-box" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>📅</div>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>Hiện tại không có đợt đồ án nào đang mở.</div>
                <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0.4rem 0 1rem' }}>
                  Bạn có thể nhấn nút "Tạo đợt ĐATN mới" hoặc xem lại các đợt đã hoàn tất tại tab <strong>Kho Lưu Trữ Đợt Đã Kết Thúc</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('archived')}
                  className="utc-btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>🗄️</span> Xem Kho Lưu Trữ ({archivedBatches.length} đợt)
                </button>
              </div>
            ) : (
              <div className="utc-batches-grid">
                {activeBatches.map((batch) => (
                  <div
                    key={batch.id}
                    onClick={() => {
                      setSelectedBatchId(batch.id);
                      localStorage.setItem('utc_selected_batch_id', String(batch.id));
                    }}
                    className={`utc-batch-card ${selectedBatchId === batch.id ? 'selected' : ''}`}
                  >
                    <div className="utc-batch-card-head">
                      <div>
                        <span className="utc-batch-code-tag">{batch.batch_code}</span>
                        <span className={`utc-prog-tag prog-${batch.program_type.toLowerCase()}`}>
                          {batch.program_type === 'ENGINEER' ? '⚙️ Kỹ Sư' : batch.program_type === 'BACHELOR' ? '🎓 Cử Nhân' : '🔄 Cả Hai'}
                        </span>
                      </div>
                      <span className={`utc-status-pill ${batch.current_stage === 'PHASE_1_SETUP' ? '' : 'pill-green'}`}>
                        {batch.current_stage === 'PHASE_1_SETUP' ? '🟡 Đang thiết lập' : '🟢 Đang mở'}
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
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="utc-btn-track-batch"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatchId(batch.id);
                            localStorage.setItem('utc_selected_batch_id', String(batch.id));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          aria-pressed={selectedBatchId === batch.id}
                        >
                          {selectedBatchId === batch.id ? '✓ Đang theo dõi' : '👁 Theo dõi tiến trình'}
                        </button>
                        <button
                          type="button"
                          className="utc-btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatchId(batch.id);
                            setBatchDetailTab('students');
                            setShowBatchConfigModal(true);
                            localStorage.setItem('utc_selected_batch_id', String(batch.id));
                          }}
                        >
                          ⚙️ Cấu hình đợt
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {batch.current_stage === 'PHASE_1_SETUP' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBatch(batch.id);
                            }}
                            className="utc-btn-open-batch"
                            disabled={(batch.student_count || 0) === 0}
                            title={(batch.student_count || 0) === 0
                              ? 'Phải thêm hoặc import sinh viên trước khi mở đợt'
                              : 'Mở đợt cho sinh viên đăng ký nguyện vọng'}
                          >
                            {(batch.student_count || 0) === 0 ? '🔒 Chưa có sinh viên' : '🔓 Mở đợt (OPEN)'}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseBatch(batch.id);
                          }}
                          className="utc-btn-close-batch"
                          title="Kết thúc đợt đồ án này và chuyển vào kho lưu trữ"
                        >
                          Kết thúc đợt
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Batch configuration is opened explicitly from each batch card. */}
            {selectedBatchId && showBatchConfigModal && (
              <div className="utc-modal-backdrop">
                <div className="utc-modal-card utc-batch-config-modal">
                  <div className="utc-modal-head">
                    <div>
                      <h4>⚙️ Cấu hình Đợt ĐATN: #{selectedBatchId} - {currBatch?.batch_name}</h4>
                      <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                        Quản lý sinh viên, lớp học phần và giảng viên tham gia đợt
                      </p>
                    </div>
                    <button type="button" onClick={() => setShowBatchConfigModal(false)} className="utc-btn-close">✕</button>
                  </div>
                  <div className="utc-batch-config-body">
              <div className="utc-classes-section">
                <div className="utc-classes-header">
                  <div>
                    <h4>Chức năng cấu hình đợt</h4>
                    <span className="utc-classes-subtitle">Chọn chức năng cần thực hiện cho đợt đang cấu hình</span>
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
                      title="Thêm sinh viên thủ công vào đợt ĐATN đang chọn"
                    >
                      <span>👤➕</span> Thêm Sinh Viên
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="utc-btn-emerald"
                      title="Import sinh viên vào đợt ĐATN đang chọn từ file Excel UTC"
                    >
                      <span>📊</span> Import Sinh Viên (Excel)
                    </button>
                    <button
                      type="button"
                      onClick={handleExportStudents}
                      className="utc-btn-outline"
                      title="Xuất danh sách sinh viên của đợt ĐATN đang chọn"
                    >
                      <span>📤</span> Export Sinh Viên (.xlsx)
                    </button>
                  </div>
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
                  <button
                    type="button"
                    className={`utc-batch-subtab-btn ${batchDetailTab === 'supervisors' ? 'active' : ''}`}
                    onClick={() => setBatchDetailTab('supervisors')}
                  >
                    <span>👨‍🏫</span> Giảng Viên Trong Đợt &amp; Quota
                    <span className="utc-batch-subtab-badge">{quotas.length}</span>
                  </button>
                </div>

                {/* Subtab Content: Supervisors in batch + quota */}
                {batchDetailTab === 'supervisors' && (
                  <div>
                    <div className="utc-student-search-bar">
                      <input
                        type="text"
                        placeholder="🔍 Tìm giảng viên theo tên, mã GV, bộ môn..."
                        value={quotaSearch}
                        onChange={(e) => setQuotaSearch(e.target.value)}
                        className="utc-search-input"
                      />
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Hiển thị <strong>{filteredQuotas.length}</strong> / {quotas.length} giảng viên
                      </span>
                      <button type="button" className="utc-btn-primary" onClick={openSupervisorPicker}>
                        <span>👨‍🏫➕</span> Chọn Giảng Viên Vào Đợt
                      </button>
                    </div>

                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8,
                        padding: '0.7rem 0.9rem',
                        marginBottom: '0.8rem',
                        fontSize: '0.82rem',
                        color: '#1e40af',
                      }}
                    >
                      ℹ️ Giảng viên chưa có trong danh sách sẽ được thêm tự động khi bấm "Lưu" (hệ số mặc định x5).
                      Đây là chỉ tiêu số sinh viên mỗi giảng viên được phép hướng dẫn tối đa trong đợt này.
                    </div>

                    {quotasLoading ? (
                      <div className="utc-loading-box">Đang tải danh sách giảng viên & quota...</div>
                    ) : filteredQuotas.length === 0 ? (
                      <div className="utc-empty-box" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>👨‍🏫</div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>Chưa có giảng viên nào trong đợt này.</div>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.3rem 0 0' }}>
                          Nhấn <strong>Chọn Giảng Viên Vào Đợt</strong> để thêm giảng viên và cấu hình quota.
                        </p>
                      </div>
                    ) : (
                      <div className="utc-table-container">
                        <table className="utc-classes-table">
                          <thead>
                            <tr>
                              <th>Mã GV</th>
                              <th>Họ và Tên</th>
                              <th>Học Vị</th>
                              <th>Bộ Môn</th>
                              <th style={{ width: '160px' }}>Max Quota (SV)</th>
                              <th>Đã phân công</th>
                              <th>Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredQuotas.map((q: any) => (
                              <QuotaRow key={q.id} quota={q} onSave={handleSaveQuota} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

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
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB ARCHIVED: COMPLETED BATCHES */}
        {activeTab === 'archived' && (
          <>
            <div className="utc-batches-header-bar" style={{ borderLeft: '5px solid #64748b' }}>
              <div className="utc-batches-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🗄️</span>
                  <h3 style={{ margin: 0 }}>Kho Lưu Trữ Đợt Đồ Án Tốt Nghiệp UTC (Đã Hoàn Tất)</h3>
                </div>
                <p>Danh sách các đợt đồ án đã khóa sổ và kết thúc. Bạn có thể tra cứu hồ sơ sinh viên, lớp học phần, hoặc mở lại đợt nếu cần chỉnh sửa bổ sung.</p>
              </div>
              <div className="utc-batches-actions">
                <button
                  type="button"
                  onClick={handleExportStudents}
                  className="utc-btn-outline"
                  title="Xuất file Excel danh sách sinh viên đợt lưu trữ đang chọn"
                >
                  <span>📥</span> Xuất Excel Hồ Sơ Đợt Đang Chọn
                </button>
              </div>
            </div>

            {loading ? (
              <div className="utc-loading-box">Đang tải hồ sơ các đợt đồ án đã kết thúc...</div>
            ) : archivedBatches.length === 0 ? (
              <div className="utc-empty-box" style={{ background: '#f8fafc', padding: '2.5rem', textAlign: 'center', borderRadius: '14px', border: '2px dashed #cbd5e1' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗄️</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155' }}>
                  Chưa có đợt đồ án nào được kết thúc hoặc lưu trữ.
                </div>
                <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0.5rem 0 1.25rem' }}>
                  Khi bạn nhấn nút <strong>"Kết thúc đợt"</strong> ở tab Đợt Đang Hoạt Động, đợt sẽ tự động được đưa vào kho lưu trữ này.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('batches')}
                  className="utc-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>←</span> Xem Đợt Đang Hoạt Động
                </button>
              </div>
            ) : (
              <div className="utc-batches-grid">
                {archivedBatches.map((batch) => (
                  <div
                    key={batch.id}
                    onClick={() => {
                      setSelectedBatchId(batch.id);
                      localStorage.setItem('utc_selected_batch_id', String(batch.id));
                    }}
                    className={`utc-batch-card ${selectedBatchId === batch.id ? 'selected' : ''}`}
                    style={{
                      borderLeft: selectedBatchId === batch.id ? '4px solid #003366' : '1px solid #cbd5e1',
                      background: selectedBatchId === batch.id ? '#f8fafc' : '#ffffff',
                    }}
                  >
                    <div className="utc-batch-card-head">
                      <div>
                        <span className="utc-batch-code-tag">{batch.batch_code}</span>
                        <span className={`utc-prog-tag prog-${batch.program_type.toLowerCase()}`}>
                          {batch.program_type === 'ENGINEER' ? '⚙️ Kỹ Sư' : batch.program_type === 'BACHELOR' ? '🎓 Cử Nhân' : '🔄 Cả Hai'}
                        </span>
                      </div>
                      <span className="utc-status-pill pill-gray" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                        🔒 Đã kết thúc
                      </span>
                    </div>

                    <h4 className="utc-batch-name">{batch.batch_name}</h4>
                    <div className="utc-batch-stage-text">
                      <strong>Trạng thái lưu trữ:</strong> <span style={{ color: '#64748b', fontWeight: 600 }}>Hoàn tất (COMPLETED)</span>
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

                    <div className="utc-batch-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Nhấp để xem hồ sơ lưu trữ</span>
                      <button
                        type="button"
                        onClick={(e) => handleReopenBatch(batch.id, e)}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#1d4ed8',
                          cursor: 'pointer',
                        }}
                        title="Mở lại đợt đồ án vào danh sách hoạt động"
                      >
                        🔄 Mở lại đợt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Batch Details for Archived */}
            {selectedBatchId && (
              <div className="utc-classes-section">
                <div className="utc-classes-header">
                  <h4>Hồ sơ Lưu Trữ Đợt ĐATN: #{selectedBatchId} - {currBatch?.batch_name}</h4>
                  <span className="utc-classes-subtitle">Tra cứu danh sách sinh viên & các lớp học phần trong đợt đã lưu trữ</span>
                </div>

                <SelectedBatchProgress
                  key={`${selectedBatchId}-${currBatch?.current_stage}-${currBatch?.is_closed}`}
                  batchId={selectedBatchId}
                />

                <div className="utc-batch-subtabs">
                  <button
                    type="button"
                    className={`utc-batch-subtab-btn ${batchDetailTab === 'students' ? 'active' : ''}`}
                    onClick={() => setBatchDetailTab('students')}
                  >
                    <span>🎓</span> Danh Sách Sinh Viên Lưu Trữ
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
                  <div className="utc-students-pane">
                    <div className="utc-table-controls">
                      <div className="utc-search-box">
                        <input
                          type="text"
                          placeholder="🔍 Tìm kiếm sinh viên theo MSSV, Họ tên, Lớp..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {studentsLoading ? (
                      <div className="utc-loading-box">Đang tải danh sách sinh viên lưu trữ...</div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="utc-empty-box">Không tìm thấy sinh viên nào trong hồ sơ lưu trữ này.</div>
                    ) : (
                      <div className="utc-table-container">
                        <table className="utc-modern-table">
                          <thead>
                            <tr>
                              <th>STT</th>
                              <th>MSSV</th>
                              <th>Họ và Tên</th>
                              <th>Hệ Đào Tạo</th>
                              <th>Lớp Sinh Hoạt</th>
                              <th>Email</th>
                              <th>Trạng Thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((st, idx) => {
                              const prof = st.student_profile || {};
                              const fullName = st.full_name || `${st.last_name || ''} ${st.first_name || ''}`.trim() || st.username;
                              return (
                                <tr key={st.id}>
                                  <td>{idx + 1}</td>
                                  <td><strong>{prof.registration_no || st.username}</strong></td>
                                  <td>{fullName}</td>
                                  <td>
                                    <span className={`utc-badge-edu ${prof.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                                      {prof.education_program === 'ENGINEER' ? 'Kỹ Sư' : 'Cử Nhân'}
                                    </span>
                                  </td>
                                  <td>{prof.course_class?.class_name || prof.department || '-'}</td>
                                  <td>{st.email || '-'}</td>
                                  <td>
                                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                      🔒 Đã Lưu Trữ
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
                  <div className="utc-classes-pane">
                    {(!currBatch?.classes || currBatch.classes.length === 0) ? (
                      <div className="utc-empty-box">Đợt này không có lớp học phần nào.</div>
                    ) : (
                      <div className="utc-table-container">
                        <table className="utc-modern-table">
                          <thead>
                            <tr>
                              <th>STT</th>
                              <th>Mã Lớp</th>
                              <th>Tên Lớp Học Phần</th>
                              <th>Hệ Đào Tạo</th>
                              <th>Nhóm Lớp</th>
                              <th>Số Sinh Viên</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currBatch.classes.map((cls, idx) => (
                              <tr key={cls.id}>
                                <td>{idx + 1}</td>
                                <td><strong>{cls.class_code}</strong></td>
                                <td>{cls.class_name}</td>
                                <td>
                                  <span className={`utc-badge-edu ${cls.education_program === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`}>
                                    {cls.education_program === 'ENGINEER' ? 'Kỹ Sư' : 'Cử Nhân'}
                                  </span>
                                </td>
                                <td>{cls.class_group || '-'}</td>
                                <td><strong>{cls.student_count || 0}</strong> sinh viên</td>
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
                    <th>Chuyên Ngành</th>
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
                      <td style={{ maxWidth: '260px' }}>
                        {(s as any).topic_areas?.length ? (
                          (s as any).topic_areas.map((t: string) => (
                            <span
                              key={t}
                              style={{
                                display: 'inline-block',
                                margin: '2px 3px 2px 0',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                background: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #bae6fd',
                              }}
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Chưa gán</span>
                        )}
                      </td>
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

        {/* MODAL: SELECT SUPERVISORS FOR THE CURRENT BATCH */}
        {showSupervisorPicker && selectedBatchId && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card" style={{ maxWidth: '760px' }}>
              <div className="utc-modal-head">
                <div>
                  <h4>👨‍🏫 Chọn Giảng Viên Vào Đợt ĐATN</h4>
                  <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                    {currBatch?.batch_code} — {currBatch?.batch_name}
                  </p>
                </div>
                <button onClick={() => setShowSupervisorPicker(false)} className="utc-btn-close">✕</button>
              </div>
              <div style={{ padding: '1rem 1.25rem', maxHeight: '55vh', overflowY: 'auto' }}>
                {supervisors.length === 0 ? (
                  <div className="utc-empty-box">Chưa có giảng viên đang hoạt động để lựa chọn.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {supervisors.map((supervisor) => {
                      const checked = selectedSupervisorIds.includes(supervisor.id);
                      return (
                        <label
                          key={supervisor.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            border: `1px solid ${checked ? '#38bdf8' : '#e2e8f0'}`,
                            borderRadius: '10px',
                            background: checked ? '#f0f9ff' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedSupervisorIds((current) =>
                              checked
                                ? current.filter((id) => id !== supervisor.id)
                                : [...current, supervisor.id]
                            )}
                          />
                          <div style={{ flex: 1 }}>
                            <strong>{supervisor.academic_title || ''} {supervisor.user_full_name || supervisor.username}</strong>
                            <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                              {supervisor.supervisor_id} · {supervisor.department_name || 'Khoa CNTT'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="utc-modal-actions">
                <span style={{ marginRight: 'auto', color: '#475569', fontWeight: 600 }}>
                  Đã chọn: {selectedSupervisorIds.length} giảng viên
                </span>
                <button type="button" onClick={() => setShowSupervisorPicker(false)} className="utc-btn-cancel">Hủy</button>
                <button
                  type="button"
                  onClick={handleSaveBatchSupervisors}
                  className="utc-btn-primary"
                  disabled={savingSupervisors || selectedSupervisorIds.length === 0}
                >
                  {savingSupervisors ? 'Đang lưu...' : 'Lưu Giảng Viên Vào Đợt'}
                </button>
              </div>
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
                  <button
                    type="button"
                    onClick={handleDownloadSampleRoster}
                    style={{
                      marginTop: '0.6rem',
                      padding: '0.45rem 0.9rem',
                      borderRadius: 6,
                      border: '1px dashed #0284c7',
                      background: '#f0f9ff',
                      color: '#075985',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    📥 Tải Danh Sách Sinh Viên Mẫu (216 SV · 9 lớp) để test
                  </button>
                </div>

                {/* Cơ chế thiết lập mật khẩu tự động cho SV vừa import */}
                <div className="utc-form-group">
                  <label>🔐 Mật khẩu đăng nhập cho sinh viên vừa import:</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importPwdStrategy"
                        checked={importPasswordStrategy === 'FIXED'}
                        onChange={() => setImportPasswordStrategy('FIXED')}
                      />
                      <span>
                        <strong>Mật khẩu chung cố định (Khuyến nghị)</strong>
                        <small style={{ display: 'block', color: '#64748b' }}>
                          Tất cả sinh viên được cấp cùng một mật khẩu, ví dụ <code>Password@123</code>
                        </small>
                      </span>
                    </label>
                    {importPasswordStrategy === 'FIXED' && (
                      <input
                        type="text"
                        className="utc-input"
                        value={importFixedPassword}
                        onChange={(e) => setImportFixedPassword(e.target.value)}
                        placeholder="Password@123"
                        style={{ marginLeft: '1.5rem' }}
                      />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importPwdStrategy"
                        checked={importPasswordStrategy === 'MSSV'}
                        onChange={() => setImportPasswordStrategy('MSSV')}
                      />
                      <span>
                        <strong>Mật khẩu = Mã sinh viên (MSSV)</strong>
                        <small style={{ display: 'block', color: '#64748b' }}>
                          Mỗi sinh viên đăng nhập lần đầu bằng chính MSSV của mình
                        </small>
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importPwdStrategy"
                        checked={importPasswordStrategy === 'RANDOM'}
                        onChange={() => setImportPasswordStrategy('RANDOM')}
                      />
                      <span>
                        <strong>Mật khẩu ngẫu nhiên</strong>
                        <small style={{ display: 'block', color: '#64748b' }}>
                          Hệ thống tự sinh mật khẩu ngẫu nhiên cho từng sinh viên
                        </small>
                      </span>
                    </label>
                  </div>
                  <small style={{ color: '#0284c7', display: 'block', marginTop: '0.4rem' }}>
                    ℹ️ Danh sách tài khoản &amp; mật khẩu sẽ hiển thị ở kết quả import bên dưới.
                  </small>
                </div>

                {importResult && (
                  <div className="utc-alert-box" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: 8, margin: '1rem 0' }}>
                    <strong style={{ color: '#065f46' }}>✅ Kết quả import Excel:</strong>
                    <div style={{ marginTop: '0.25rem' }}>Tổng số dòng dữ liệu: <strong>{importResult.total}</strong></div>
                    <div style={{ color: '#059669' }}>Tạo mới thành công: <strong>{importResult.created}</strong> sinh viên</div>
                    <div style={{ color: '#2563eb' }}>Cập nhật: <strong>{importResult.updated}</strong> sinh viên</div>
                    {importResult.skipped > 0 && <div style={{ color: '#d97706' }}>Bỏ qua: <strong>{importResult.skipped}</strong></div>}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div style={{ marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '0.5rem', fontSize: '0.78rem', color: '#92400e' }}>
                        <strong>⚠️ Chi tiết cảnh báo / bỏ qua ({importResult.errors.length}):</strong>
                        <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                          {importResult.errors.slice(0, 10).map((errItem: string, idx: number) => (
                            <li key={idx}>{errItem}</li>
                          ))}
                          {importResult.errors.length > 10 && <li>...và {importResult.errors.length - 10} dòng khác</li>}
                        </ul>
                      </div>
                    )}
                    {importResult.created_accounts && importResult.created_accounts.length > 0 && (
                      <div style={{ marginTop: '0.6rem', maxHeight: '160px', overflowY: 'auto', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4, padding: '0.5rem', fontSize: '0.78rem' }}>
                        <strong style={{ color: '#075985' }}>🔑 Tài khoản đăng nhập đã tạo ({importResult.created_accounts.length}):</strong>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.35rem' }}>
                          <thead>
                            <tr style={{ background: '#e0f2fe', color: '#075985' }}>
                              <th style={{ textAlign: 'left', padding: '0.25rem' }}>MSSV (Tên đăng nhập)</th>
                              <th style={{ textAlign: 'left', padding: '0.25rem' }}>Họ tên</th>
                              <th style={{ textAlign: 'left', padding: '0.25rem' }}>Mật khẩu</th>
                              <th style={{ textAlign: 'left', padding: '0.25rem' }}>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.created_accounts.slice(0, 50).map((acc: any, idx: number) => (
                              <tr key={idx} style={{ borderTop: '1px solid #e0f2fe' }}>
                                <td style={{ padding: '0.25rem', fontWeight: 700, color: '#0c4a6e' }}>{acc.username}</td>
                                <td style={{ padding: '0.25rem' }}>{acc.full_name}</td>
                                <td style={{ padding: '0.25rem', fontFamily: 'monospace', color: '#b45309' }}>{acc.plain_password}</td>
                                <td style={{ padding: '0.25rem' }}>
                                  {acc.status === 'created' ? '🆕 Tạo mới' : '♻️ Cập nhật'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importResult.created_accounts.length > 50 && (
                          <small style={{ color: '#64748b' }}>...và {importResult.created_accounts.length - 50} tài khoản khác</small>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="utc-btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                        onClick={() => {
                          setShowImportModal(false);
                          const b = batches.find((x) => x.id === selectedBatchId);
                          if (b) handleOpenStudentsModal(b);
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
                          if (addTouched.mssv) {
                            setAddErrors((prev) => ({ ...prev, mssv: validateMssv(val) }));
                          }
                        }}
                        onBlur={() => {
                          setAddTouched((prev) => ({ ...prev, mssv: true }));
                          setAddErrors((prev) => ({ ...prev, mssv: validateMssv(addMssv) }));
                        }}
                        className={`utc-input ${addTouched.mssv && addErrors.mssv ? 'input-error' : ''}`}
                        style={addTouched.mssv && addErrors.mssv ? { borderColor: '#dc2626' } : undefined}
                        autoFocus
                      />
                      {addTouched.mssv && addErrors.mssv && (
                        <span style={{ color: '#dc2626', fontSize: '0.78rem', display: 'block', marginTop: 3 }}>
                          ❌ {addErrors.mssv}
                        </span>
                      )}
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
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddFullName(val);
                          if (addTouched.fullName) {
                            setAddErrors((prev) => ({ ...prev, fullName: validateFullName(val) }));
                          }
                        }}
                        onBlur={() => {
                          setAddTouched((prev) => ({ ...prev, fullName: true }));
                          setAddErrors((prev) => ({ ...prev, fullName: validateFullName(addFullName) }));
                        }}
                        className={`utc-input ${addTouched.fullName && addErrors.fullName ? 'input-error' : ''}`}
                        style={addTouched.fullName && addErrors.fullName ? { borderColor: '#dc2626' } : undefined}
                      />
                      {addTouched.fullName && addErrors.fullName && (
                        <span style={{ color: '#dc2626', fontSize: '0.78rem', display: 'block', marginTop: 3 }}>
                          ❌ {addErrors.fullName}
                        </span>
                      )}
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
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddEmail(val);
                          if (addTouched.email) {
                            setAddErrors((prev) => ({ ...prev, email: validateEmail(val) }));
                          }
                        }}
                        onBlur={() => {
                          setAddTouched((prev) => ({ ...prev, email: true }));
                          setAddErrors((prev) => ({ ...prev, email: validateEmail(addEmail) }));
                        }}
                        className={`utc-input ${addTouched.email && addErrors.email ? 'input-error' : ''}`}
                        style={addTouched.email && addErrors.email ? { borderColor: '#dc2626' } : undefined}
                      />
                      {addTouched.email && addErrors.email && (
                        <span style={{ color: '#dc2626', fontSize: '0.78rem', display: 'block', marginTop: 3 }}>
                          ❌ {addErrors.email}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        placeholder="vd: 0912345678"
                        value={addPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAddPhone(val);
                          if (addTouched.phone) {
                            setAddErrors((prev) => ({ ...prev, phone: validatePhone(val) }));
                          }
                        }}
                        onBlur={() => {
                          setAddTouched((prev) => ({ ...prev, phone: true }));
                          setAddErrors((prev) => ({ ...prev, phone: validatePhone(addPhone) }));
                        }}
                        className={`utc-input ${addTouched.phone && addErrors.phone ? 'input-error' : ''}`}
                        style={addTouched.phone && addErrors.phone ? { borderColor: '#dc2626' } : undefined}
                      />
                      {addTouched.phone && addErrors.phone && (
                        <span style={{ color: '#dc2626', fontSize: '0.78rem', display: 'block', marginTop: 3 }}>
                          ❌ {addErrors.phone}
                        </span>
                      )}
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
                  <label>Chuyên ngành / Hướng nghiên cứu được phép hướng dẫn:</label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '6px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      background: '#f8fafc',
                    }}
                  >
                    {topicAreas.length === 0 ? (
                      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                        Chưa có chuyên ngành nào trong hệ thống.
                      </span>
                    ) : (
                      topicAreas.map((t) => (
                        <label
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.82rem',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={supTopicAreaIds.includes(t.id)}
                            onChange={(e) =>
                              setSupTopicAreaIds((prev) =>
                                e.target.checked
                                  ? [...prev, t.id]
                                  : prev.filter((id) => id !== t.id)
                              )
                            }
                          />
                          <span>{t.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <small style={{ color: '#64748b' }}>
                    Chuyên ngành đã gán sẽ được dùng để lọc & đề xuất giảng viên cho sinh viên khi họ
                    chọn hướng nghiên cứu.
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

        {/* MODAL 5: VIEW STUDENTS IN BATCH */}
        {showStudentsModal && studentsModalBatch && (() => {
          const distinctClasses = Array.from(
            new Set(
              studentsList
                .map((s) => s.student_profile?.class_name || s.student_profile?.department)
                .filter(Boolean)
            )
          ).sort();

          const filteredStudents = studentsList.filter((s) => {
            const studentClass = s.student_profile?.class_name || s.student_profile?.department || '';
            if (studentsFilterClass !== 'ALL' && studentClass !== studentsFilterClass) {
              return false;
            }
            if (studentsSearch.trim()) {
              const q = studentsSearch.toLowerCase();
              const mssv = (s.student_profile?.registration_no || s.username || '').toLowerCase();
              const name = (s.full_name || `${s.last_name || ''} ${s.first_name || ''}`).toLowerCase();
              const clsName = studentClass.toLowerCase();
              const email = (s.email || '').toLowerCase();
              const phone = (s.student_profile?.phone_number || '').toLowerCase();
              return mssv.includes(q) || name.includes(q) || clsName.includes(q) || email.includes(q) || phone.includes(q);
            }
            return true;
          });

          return (
            <div className="utc-modal-backdrop">
              <div className="utc-modal-card" style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="utc-modal-head">
                  <div>
                    <h4>🎓 Danh Sách Sinh Viên — {studentsModalBatch.batch_name} ({studentsModalBatch.batch_code})</h4>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      Tổng số sinh viên: <strong>{studentsList.length}</strong> (Hiển thị: <strong>{filteredStudents.length}</strong>)
                    </p>
                  </div>
                  <button onClick={() => setShowStudentsModal(false)} className="utc-btn-close">✕</button>
                </div>

                {/* Filter controls */}
                <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 0', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Tìm kiếm theo MSSV, Họ tên, SĐT, Email..."
                      value={studentsSearch}
                      onChange={(e) => setStudentsSearch(e.target.value)}
                      className="utc-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: '0 1 240px' }}>
                    <select
                      value={studentsFilterClass}
                      onChange={(e) => setStudentsFilterClass(e.target.value)}
                      className="utc-input"
                      style={{ width: '100%' }}
                    >
                      <option value="ALL">-- Tất cả lớp sinh hoạt ({studentsList.length}) --</option>
                      {distinctClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls} ({studentsList.filter((s) => (s.student_profile?.class_name || s.student_profile?.department) === cls).length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Students Table */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  {studentsModalLoading ? (
                    <div className="utc-loading-box" style={{ padding: '2rem' }}>Đang tải danh sách sinh viên...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="utc-empty-box" style={{ padding: '2rem' }}>
                      {studentsList.length === 0 ? 'Đợt này chưa có sinh viên nào. Hãy thực hiện Import Excel.' : 'Không tìm thấy sinh viên phù hợp với bộ lọc.'}
                    </div>
                  ) : (
                    <table className="utc-classes-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                        <tr>
                          <th style={{ width: '45px', textAlign: 'center' }}>STT</th>
                          <th>MSSV</th>
                          <th>Họ và Tên</th>
                          <th>Lớp sinh hoạt</th>
                          <th>Ngành</th>
                          <th>Hệ ĐT</th>
                          <th>Số điện thoại</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((std, idx) => {
                          const prof = std.student_profile || {};
                          const fullName = std.full_name || `${std.last_name || ''} ${std.first_name || ''}`.trim() || std.username;
                          const mssv = prof.registration_no || std.username;
                          const className = prof.class_name || prof.department || '—';
                          const major = prof.major || (className.includes('KHMT') ? 'KHMT' : 'CNTT');
                          const eduProgram = prof.program_type || (studentsModalBatch.program_type === 'ENGINEER' ? 'Kỹ sư' : 'Cử nhân');
                          return (
                            <tr key={std.id || idx}>
                              <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 700, color: '#0284c7' }}>{mssv}</td>
                              <td style={{ fontWeight: 600 }}>{fullName}</td>
                              <td>
                                <span style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 500 }}>
                                  {className}
                                </span>
                              </td>
                              <td>
                                <span className="utc-badge-prog">
                                  {major}
                                </span>
                              </td>
                              <td>
                                <span className={`utc-badge-edu ${studentsModalBatch.program_type === 'ENGINEER' ? 'edu-ks' : 'edu-cn'}`} style={{ fontSize: '0.75rem' }}>
                                  {eduProgram}
                                </span>
                              </td>
                              <td>{prof.phone_number || '—'}</td>
                              <td style={{ color: '#475569' }}>{std.email || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="utc-modal-foot" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Hiển thị {filteredStudents.length} / {studentsList.length} sinh viên
                  </span>
                  <button type="button" onClick={() => setShowStudentsModal(false)} className="utc-btn-cancel">
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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

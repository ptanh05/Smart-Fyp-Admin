import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './BatchesPage.css';

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

  useEffect(() => {
    fetchBatches();
    fetchDepartments();
    fetchSupervisors();
  }, []);

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
      fetchBatches();
    } catch (err) {
      alert('Lỗi tạo đợt đồ án: ' + JSON.stringify(err));
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
      fetchBatches();
    } catch (err: any) {
      alert('Lỗi import Excel: ' + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
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
      fetchDepartments();
    } catch (err: any) {
      alert('Lỗi tạo bộ môn: ' + (err.response?.data?.detail || err.message));
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
      alert('Đã cập nhật học vị & hệ số capacity của Giảng viên thành công!');
    } catch (err: any) {
      alert('Lỗi cập nhật giảng viên: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCloseBatch = async (batchId: number) => {
    if (!confirm('Bạn có chắc chắn muốn KẾT THÚC đợt đồ án này? Sau khi kết thúc, trạng thái đợt sẽ hoàn tất.')) return;
    try {
      await apiClient.post(`/admin/batches/${batchId}/close/`);
      alert('Đã kết thúc đợt đồ án thành công!');
      fetchBatches();
    } catch (err: any) {
      alert('Lỗi kết thúc đợt: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <AdminLayout>
      <div className="utc-batches-portal">
        {/* Navigation Tabs */}
        <div className="utc-subnav-tabs">
          <button
            className={`utc-subnav-btn ${activeTab === 'batches' ? 'active' : ''}`}
            onClick={() => setActiveTab('batches')}
          >
            📅 Đợt Đồ Án & Lớp Học Phần
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

        {/* TAB 1: BATCHES */}
        {activeTab === 'batches' && (
          <>
            <div className="utc-batches-header-bar">
              <div className="utc-batches-header-info">
                <h3>Giai Đoạn 1: Khởi Tạo Đợt Đồ Án & Thiết Lập Dữ Liệu</h3>
                <p>Khởi tạo đợt đồ án theo Chương trình đào tạo (Cử nhân / Kỹ sư) và import sinh viên UTC</p>
              </div>
              <div className="utc-batches-actions">
                <button onClick={() => setShowCreateModal(true)} className="utc-btn-primary">
                  <span>➕</span> Tạo đợt ĐATN mới
                </button>
                <button onClick={() => setShowImportModal(true)} className="utc-btn-emerald">
                  <span>📊</span> Import Sinh Viên (Excel)
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
                      <span>{batch.is_closed ? 'Đợt đã lưu trữ' : 'Nhấp để xem chi tiết lớp học'}</span>
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
                  <h4>Danh sách Lớp học phần thuộc đợt: #{selectedBatchId}</h4>
                  <span className="utc-classes-subtitle">Tự động phân loại từ file Excel đăng ký tín chỉ UTC</span>
                </div>

                {(() => {
                  const curr = batches.find((b) => b.id === selectedBatchId);
                  if (!curr || !curr.classes || curr.classes.length === 0) {
                    return <div className="utc-empty-classes">Đợt này chưa có dữ liệu lớp học phần. Hãy nhấn nút Import Excel.</div>;
                  }
                  return (
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
                          {curr.classes.map((cls) => (
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
                  );
                })()}
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

        {/* MODAL 1: CREATE BATCH (CHỌN CỬ NHÂN / KỸ SƯ) */}
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
                    File Excel xuất từ Cổng đào tạo UTC gồm các sheet chứa danh sách sinh viên theo lớp học phần.
                  </small>
                </div>

                {importResult && (
                  <div className="utc-alert-box">
                    <strong>Kết quả import:</strong>
                    <div>Tổng sinh viên: {importResult.total}</div>
                    <div style={{ color: '#059669' }}>Tạo mới thành công: {importResult.created}</div>
                    <div style={{ color: '#2563eb' }}>Cập nhật: {importResult.updated}</div>
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

        {/* MODAL 3: CREATE DEPARTMENT */}
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

        {/* MODAL 4: EDIT SUPERVISOR */}
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
      </div>
    </AdminLayout>
  );
};

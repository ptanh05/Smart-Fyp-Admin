import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import { NavLink } from 'react-router-dom';
import SelectedBatchProgress from '../../components/SelectedBatchProgress';
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
  created_at?: string;
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

export const ArchivedBatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState<'ALL' | 'BACHELOR' | 'ENGINEER' | 'BOTH'>('ALL');

  // Subtabs inside selected batch
  const [batchDetailTab, setBatchDetailTab] = useState<'students' | 'classes'>('students');
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Toast notification
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/batches/?_t=${Date.now()}`);
      const list: AcademicBatch[] = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const archived = list.filter((b) => b.is_closed || b.is_active === false || b.current_stage === 'COMPLETED');
      setBatches(archived);
      if (archived.length > 0 && !selectedBatchId) {
        setSelectedBatchId(archived[0].id);
      }
    } catch (err) {
      console.error('Error fetching archived batches:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (batchId: number) => {
    try {
      setStudentsLoading(true);
      const res = await apiClient.get(`/admin/users/?role=student&batch_id=${batchId}&_t=${Date.now()}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setStudents(list);
    } catch (err) {
      console.error('Error fetching students:', err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchStudents(selectedBatchId);
    } else {
      setStudents([]);
    }
  }, [selectedBatchId]);

  const handleReopenBatch = async (batchId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn MỞ LẠI đợt đồ án này? Đợt sẽ được chuyển lại sang danh sách Đợt Đang Hoạt Động.')) return;
    try {
      // Optimistic removal from archive list
      setBatches((prev) => prev.filter((b) => b.id !== batchId));
      if (selectedBatchId === batchId) {
        setSelectedBatchId(null);
      }
      const res = await apiClient.post(`/admin/batches/${batchId}/reopen/`);
      showToast(res.data?.message || '✓ Đã mở lại đợt đồ án thành công!', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast('❌ Lỗi mở lại đợt: ' + (err.response?.data?.detail || err.message), 'error');
      fetchBatches();
    }
  };

  const handleExportStudents = async (batchId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      showToast('Đang tạo file Excel xuất danh sách sinh viên...', 'info');
      const res = await apiClient.get(`/admin/batches/${batchId}/export-students/`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ho_So_Luu_Tru_Dot_${batchId}_Sinh_Vien.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('✓ Xuất file Excel hồ sơ lưu trữ thành công!', 'success');
    } catch (err: any) {
      showToast('❌ Lỗi xuất file Excel: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      !searchQuery.trim() ||
      b.batch_code.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      b.batch_name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesProg = programFilter === 'ALL' || b.program_type === programFilter;
    return matchesSearch && matchesProg;
  });

  const currBatch = batches.find((b) => b.id === selectedBatchId);

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.trim().toLowerCase();
    const fullName = (s.full_name || `${s.last_name || ''} ${s.first_name || ''}`).toLowerCase();
    const regNo = (s.student_profile?.registration_no || s.username || '').toLowerCase();
    const cls = (s.student_profile?.course_class?.class_name || s.student_profile?.department || '').toLowerCase();
    const eml = (s.email || '').toLowerCase();
    return fullName.includes(q) || regNo.includes(q) || cls.includes(q) || eml.includes(q);
  });

  // Calculate summary metrics
  const totalStudents = batches.reduce((sum, b) => sum + (b.student_count || 0), 0);
  const totalProjects = batches.reduce((sum, b) => sum + (b.project_count || 0), 0);

  return (
    <AdminLayout>
      <div className="utc-batches-portal">
        {/* Toast Notification */}
        {toast && (
          <div className={`utc-toast-alert toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="utc-toast-close">×</button>
          </div>
        )}

        {/* Header Bar */}
        <div className="utc-batches-header-bar" style={{ borderLeft: '5px solid #64748b' }}>
          <div className="utc-batches-header-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.4rem' }}>🗄️</span>
              <h3 style={{ margin: 0 }}>Kho Lưu Trữ Đợt Đồ Án Tốt Nghiệp (Đã Hoàn Tất)</h3>
            </div>
            <p>Hồ sơ lưu trữ các đợt đồ án đã khóa sổ và kết thúc. Bạn có thể tra cứu lịch sử sinh viên, xuất bảng điểm hoặc mở lại đợt nếu cần bổ sung.</p>
          </div>

          <div className="utc-batches-actions">
            <NavLink to="/batches" className="utc-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span>←</span> Về Đợt Đang Hoạt Động
            </NavLink>
          </div>
        </div>

        {/* Summary Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '2rem', background: '#f1f5f9', padding: '0.6rem', borderRadius: '10px' }}>📦</span>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{batches.length}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Đợt ĐATN Đã Lưu Trữ</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '2rem', background: '#ecfdf5', padding: '0.6rem', borderRadius: '10px' }}>🎓</span>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#047857' }}>{totalStudents}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Sinh Viên Đã Hoàn Thành</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '2rem', background: '#eff6ff', padding: '0.6rem', borderRadius: '10px' }}>📑</span>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>{totalProjects}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Đề Tài Đồ Án Nghiệm Thu</div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="🔍 Tìm kiếm mã đợt hoặc tên đợt đã lưu trữ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Hệ đào tạo:</span>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value as any)}
              style={{ padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <option value="ALL">Tất cả hệ</option>
              <option value="BACHELOR">Cử Nhân</option>
              <option value="ENGINEER">Kỹ Sư</option>
              <option value="BOTH">Cả Hai</option>
            </select>
          </div>
        </div>

        {/* Archived Batches Grid */}
        {loading ? (
          <div className="utc-loading-box">Đang tải hồ sơ các đợt đồ án đã kết thúc...</div>
        ) : filteredBatches.length === 0 ? (
          <div className="utc-empty-box" style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗄️</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155' }}>
              {batches.length === 0
                ? 'Chưa có đợt đồ án nào được kết thúc hoặc lưu trữ.'
                : 'Không tìm thấy đợt lưu trữ nào khớp với từ khóa tìm kiếm.'}
            </div>
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0.5rem 0 1.25rem' }}>
              Khi bạn nhấn nút "Kết thúc đợt" tại trang quản lý đợt, đợt đồ án sẽ tự động chuyển vào đây để lưu trữ dài hạn.
            </p>
            <NavLink to="/batches" className="utc-btn-primary" style={{ textDecoration: 'none' }}>
              Quay lại Quản Lý Đợt Đồ Án
            </NavLink>
          </div>
        ) : (
          <div className="utc-batches-grid">
            {filteredBatches.map((batch) => (
              <div
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className={`utc-batch-card ${selectedBatchId === batch.id ? 'selected' : ''}`}
                style={{
                  borderLeft: selectedBatchId === batch.id ? '4px solid #003366' : '1px solid #e2e8f0',
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
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={(e) => handleExportStudents(batch.id, e)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                      title="Xuất file Excel danh sách sinh viên đợt này"
                    >
                      📥 Xuất Excel
                    </button>
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
              </div>
            ))}
          </div>
        )}

        {/* Selected Batch Details */}
        {selectedBatchId && currBatch && (
          <div className="utc-classes-section" style={{ marginTop: '1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div className="utc-classes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                    HỒ SƠ LƯU TRỮ #{currBatch.id}
                  </span>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>{currBatch.batch_name} ({currBatch.batch_code})</h4>
                </div>
                <span className="utc-classes-subtitle" style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                  Rà soát hồ sơ sinh viên & các lớp học phần đã hoàn thành trong đợt đồ án
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleExportStudents(currBatch.id)}
                  className="utc-btn-outline"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  <span>📥</span> Tải Hồ Sơ Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => handleReopenBatch(currBatch.id)}
                  className="utc-btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', background: '#0284c7' }}
                >
                  <span>🔄</span> Mở Lại Đợt Này
                </button>
              </div>
            </div>

            <SelectedBatchProgress
              key={`${selectedBatchId}-${currBatch.current_stage}-${currBatch.is_closed}`}
              batchId={selectedBatchId}
            />

            <div className="utc-batch-subtabs" style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0' }}>
              <button
                type="button"
                className={`utc-batch-subtab-btn ${batchDetailTab === 'students' ? 'active' : ''}`}
                onClick={() => setBatchDetailTab('students')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: '1px solid #e2e8f0',
                  background: batchDetailTab === 'students' ? '#003366' : '#ffffff',
                  color: batchDetailTab === 'students' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                👥 Danh Sách Sinh Viên Đã Hoàn Thành ({students.length})
              </button>
              <button
                type="button"
                className={`utc-batch-subtab-btn ${batchDetailTab === 'classes' ? 'active' : ''}`}
                onClick={() => setBatchDetailTab('classes')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: '1px solid #e2e8f0',
                  background: batchDetailTab === 'classes' ? '#003366' : '#ffffff',
                  color: batchDetailTab === 'classes' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                🏫 Danh Sách Lớp Học Phần ({currBatch.classes?.length || 0})
              </button>
            </div>

            {batchDetailTab === 'students' ? (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="Tìm sinh viên theo họ tên, MSSV, lớp, email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
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
                                <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                  ✓ Đã Lưu Trữ
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
            ) : (
              <div>
                {(!currBatch.classes || currBatch.classes.length === 0) ? (
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
      </div>
    </AdminLayout>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import { formatDepartmentName } from '../../utils/nameHelper';
import './SupervisorsPage.css';

export const UTC_RESEARCH_AREAS = [
  'Phát triển phần mềm và ứng dụng (webApp, MobileApp)',
  'Dữ liệu và trí tuệ nhân tạo',
  'Lập trình Game',
  'Kiểm thử phần mềm',
  'Hệ thống, mạng và hạ tầng CNTT',
  'An toàn thông tin và an ninh mạng',
  'Nghiên cứu và ứng dụng thuật toán',
];

export interface SupervisorProfile {
  id: number;
  supervisor_id: string;
  user_full_name: string;
  username: string;
  email: string;
  academic_title: string;
  department_name: string;
  department_obj: number | null;
  department_code?: string;
  academic_rank_multiplier: number;
  phone_number: string;
  research_interest: string;
  academic_background?: string;
  is_external: boolean;
  quota_info?: {
    base_quota: number;
    rank_multiplier: number;
    viet_anh_quota: number;
    general_cntt_quota: number;
    max_total_quota: number;
    current_assigned: number;
  };
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string;
  supervisor_count: number;
}

export const SupervisorsPage: React.FC = () => {
  const [supervisors, setSupervisors] = useState<SupervisorProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedTitle, setSelectedTitle] = useState<string>('ALL');
  const [externalFilter, setExternalFilter] = useState<string>('ALL');

  // Edit Modal State
  const [editingSupervisor, setEditingSupervisor] = useState<SupervisorProfile | null>(null);
  const [supTitle, setSupTitle] = useState('ThS');
  const [supDeptId, setSupDeptId] = useState<number | ''>('');
  const [supMultiplier, setSupMultiplier] = useState(1.0);
  const [supPhone, setSupPhone] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [supErrors, setSupErrors] = useState<{ phone?: string; areas?: string }>({});
  const [supTouched, setSupTouched] = useState<{ phone?: boolean; areas?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Topic Areas CRUD State
  const [topicAreas, setTopicAreas] = useState<Array<{ id: number; code: string; name: string; description?: string; is_active: boolean; supervisor_count?: number }>>([]);
  const [showTopicAreaModal, setShowTopicAreaModal] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [areaName, setAreaName] = useState('');
  const [areaDesc, setAreaDesc] = useState('');
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [savingArea, setSavingArea] = useState(false);

  const validateSupPhone = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (!/^0\d{9}$/.test(trimmed)) return 'Số điện thoại phải gồm 10 chữ số (bắt đầu bằng số 0)';
    return undefined;
  };

  const validateSupAreas = (areas: string[]): string | undefined => {
    if (!areas || areas.length === 0) return 'Vui lòng tích chọn ít nhất 1 hướng nghiên cứu theo chuẩn khoa';
    return undefined;
  };

  const fetchSupervisors = async () => {
    try {
      setLoading(true);
      // Try dedicated supervisors endpoint first, fallback to users?user_type=supervisor
      let list: SupervisorProfile[] = [];
      try {
        const res = await apiClient.get('/admin/supervisors/');
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        if (data.length > 0) {
          list = data;
        }
      } catch (e) {
        // Fallback
      }

      if (list.length === 0) {
        const res = await apiClient.get('/admin/users/?user_type=supervisor');
        const users = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.results || []);
        users.forEach((u: any) => {
          if (u.supervisor_profile) {
            list.push({
              ...u.supervisor_profile,
              user_full_name: u.full_name || u.username,
              username: u.username,
              email: u.email || ''
            });
          }
        });
      }
      setSupervisors(list);
    } catch (err) {
      console.error('Error fetching supervisors:', err);
      setSupervisors([]);
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

  const fetchTopicAreas = async () => {
    try {
      const res = await apiClient.get('/admin/topic-areas/?include_inactive=true');
      setTopicAreas(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching topic areas:', err);
    }
  };

  useEffect(() => {
    fetchSupervisors();
    fetchDepartments();
    fetchTopicAreas();
  }, []);

  const handleOpenEdit = (sup: SupervisorProfile) => {
    setEditingSupervisor(sup);
    const title = sup.academic_title || 'ThS';
    setSupTitle(title);
    setSupDeptId(sup.department_obj || '');
    // Capacity multiplier is locked strictly according to degree
    if (title === 'GS.TS') setSupMultiplier(2.0);
    else if (title === 'PGS.TS') setSupMultiplier(1.5);
    else if (title === 'TS') setSupMultiplier(1.2);
    else setSupMultiplier(1.0);

    setSupPhone(sup.phone_number || '');
    
    // Parse existing research interests into checkbox selections
    const raw = sup.research_interest || '';
    const parsed = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    setSelectedAreas(parsed);
    setSupErrors({});
    setSupTouched({});
    setNotification(null);
  };

  const handleTitleChange = (newTitle: string) => {
    setSupTitle(newTitle);
    // Locked strictly according to degree
    if (newTitle === 'GS.TS') setSupMultiplier(2.0);
    else if (newTitle === 'PGS.TS') setSupMultiplier(1.5);
    else if (newTitle === 'TS') setSupMultiplier(1.2);
    else setSupMultiplier(1.0);
  };

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupervisor) return;

    const phoneErr = validateSupPhone(supPhone);
    const areasErr = validateSupAreas(selectedAreas);

    setSupErrors({ phone: phoneErr, areas: areasErr });
    setSupTouched({ phone: true, areas: true });

    if (phoneErr || areasErr) {
      return;
    }

    try {
      setSaving(true);
      const interestString = selectedAreas.join('; ');
      const matchedTopicIds = topicAreas
        .filter((a) => selectedAreas.includes(a.name))
        .map((a) => a.id);
      await apiClient.patch(`/admin/supervisors/${editingSupervisor.id}/profile/`, {
        academic_title: supTitle,
        department_id: supDeptId ? Number(supDeptId) : null,
        academic_rank_multiplier: supMultiplier,
        research_interest: interestString,
        ...(matchedTopicIds.length > 0 ? { topic_area_ids: matchedTopicIds } : {}),
        phone_number: supPhone.trim()
      });

      setNotification({
        type: 'success',
        message: `Đã cập nhật học vị & hướng nghiên cứu cho giảng viên ${editingSupervisor.user_full_name || editingSupervisor.username} thành công!`
      });
      setEditingSupervisor(null);
      fetchSupervisors();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'Lỗi cập nhật giảng viên: ' + (err.response?.data?.detail || err.message)
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtered supervisor list
  const filteredSupervisors = useMemo(() => {
    return supervisors.filter((s) => {
      const matchSearch =
        !searchTerm ||
        (s.user_full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.supervisor_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.research_interest || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept =
        selectedDept === 'ALL' ||
        (selectedDept === 'NONE' && !s.department_obj) ||
        String(s.department_obj) === selectedDept;

      const matchTitle =
        selectedTitle === 'ALL' ||
        (s.academic_title || 'ThS').toUpperCase() === selectedTitle.toUpperCase();

      const matchExternal =
        externalFilter === 'ALL' ||
        (externalFilter === 'EXTERNAL' && s.is_external) ||
        (externalFilter === 'INTERNAL' && !s.is_external);

      return matchSearch && matchDept && matchTitle && matchExternal;
    });
  }, [supervisors, searchTerm, selectedDept, selectedTitle, externalFilter]);

  // Statistics
  const countGS_PGS = supervisors.filter((s) => s.academic_title === 'GS.TS' || s.academic_title === 'PGS.TS').length;
  const countTS = supervisors.filter((s) => s.academic_title === 'TS').length;
  const countThS = supervisors.filter((s) => !s.academic_title || s.academic_title === 'ThS').length;
  const countExternal = supervisors.filter((s) => s.is_external).length;

  return (
    <AdminLayout>
      <div className="utc-supervisors-portal">
        {/* Header Bar */}
        <div className="utc-sup-header-bar">
          <div className="utc-sup-header-info">
            <h2>👨‍🏫 Quản Lý Giảng Viên Nâng Cao</h2>
            <p>
              Thiết lập học vị (GS/PGS/TS/ThS), hướng nghiên cứu chuyên sâu, bộ môn chuyên môn và hệ số Capacity cho từng giảng viên.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setEditingAreaId(null);
                setAreaCode('');
                setAreaName('');
                setAreaDesc('');
                setShowTopicAreaModal(true);
              }}
              className="utc-btn-refresh"
              style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}
            >
              📚 Quản Lý Chuyên Ngành ({topicAreas.filter((a) => a.is_active).length})
            </button>
            <button onClick={() => fetchSupervisors()} className="utc-btn-refresh">
              🔄 Làm Mới Dữ Liệu
            </button>
          </div>
        </div>

        {notification && (
          <div className={`utc-alert-banner ${notification.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            <span>{notification.type === 'success' ? '✅' : '❌'} {notification.message}</span>
            <button onClick={() => setNotification(null)} className="alert-close">✕</button>
          </div>
        )}

        {/* Statistic Cards */}
        <div className="utc-sup-stats-grid">
          <div className="utc-sup-stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <span className="stat-label">Tổng Giảng Viên</span>
              <span className="stat-value">{supervisors.length}</span>
              <span className="stat-desc">Toàn khoa CNTT UTC</span>
            </div>
          </div>

          <div className="utc-sup-stat-card border-purple">
            <div className="stat-icon text-purple">⭐</div>
            <div className="stat-content">
              <span className="stat-label">GS & PGS</span>
              <span className="stat-value text-purple">{countGS_PGS}</span>
              <span className="stat-desc">Hệ số định mức x1.5 - x2.0</span>
            </div>
          </div>

          <div className="utc-sup-stat-card border-blue">
            <div className="stat-icon text-blue">🎓</div>
            <div className="stat-content">
              <span className="stat-label">Tiến Sĩ (TS)</span>
              <span className="stat-value text-blue">{countTS}</span>
              <span className="stat-desc">Đủ chuẩn HD hệ Kỹ sư (x1.2)</span>
            </div>
          </div>

          <div className="utc-sup-stat-card border-amber">
            <div className="stat-icon text-amber">📜</div>
            <div className="stat-content">
              <span className="stat-label">Thạc Sĩ (ThS)</span>
              <span className="stat-value text-amber">{countThS}</span>
              <span className="stat-desc">Chuẩn hệ Cử nhân (x1.0)</span>
            </div>
          </div>

          <div className="utc-sup-stat-card border-emerald">
            <div className="stat-icon text-emerald">🌐</div>
            <div className="stat-content">
              <span className="stat-label">Cán Bộ Ngoài Trường</span>
              <span className="stat-value text-emerald">{countExternal}</span>
              <span className="stat-desc">Doanh nghiệp / Viện nghiên cứu</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="utc-sup-toolbar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo mã GV, họ tên, email, hướng nghiên cứu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="utc-search-input"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="search-clear">✕</button>
            )}
          </div>

          <div className="filter-group">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="utc-select-filter"
            >
              <option value="ALL">🏢 Tất cả Bộ Môn</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {formatDepartmentName(d.name, d.code)} ({d.code})
                </option>
              ))}
              <option value="NONE">Chưa phân bộ môn</option>
            </select>

            <select
              value={selectedTitle}
              onChange={(e) => setSelectedTitle(e.target.value)}
              className="utc-select-filter"
            >
              <option value="ALL">🎓 Tất cả Học Vị</option>
              <option value="GS.TS">GS.TS - Giáo sư</option>
              <option value="PGS.TS">PGS.TS - Phó Giáo sư</option>
              <option value="TS">TS - Tiến sĩ</option>
              <option value="THS">ThS - Thạc sĩ</option>
            </select>

            <select
              value={externalFilter}
              onChange={(e) => setExternalFilter(e.target.value)}
              className="utc-select-filter"
            >
              <option value="ALL">🏛️ Toàn bộ cơ hữu / ngoài</option>
              <option value="INTERNAL">Giảng viên cơ hữu UTC</option>
              <option value="EXTERNAL">Giảng viên ngoài trường</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="utc-sup-table-card">
          <div className="table-header">
            <h4>Danh Sách Giảng Viên ({filteredSupervisors.length})</h4>
            <span className="table-sub">Bấm "Cập nhật" để chỉnh sửa hướng nghiên cứu & học vị</span>
          </div>

          {loading ? (
            <div className="utc-loading-state">
              <div className="spinner" />
              <span>Đang tải danh sách giảng viên...</span>
            </div>
          ) : filteredSupervisors.length === 0 ? (
            <div className="utc-empty-state">
              <span>👨‍🏫</span>
              <p>Không tìm thấy giảng viên nào phù hợp với bộ lọc.</p>
            </div>
          ) : (
            <div className="utc-table-wrapper">
              <table className="utc-sup-table">
                <thead>
                  <tr>
                    <th>Mã GV</th>
                    <th>Họ và Tên</th>
                    <th>Học Vị / Chức Danh</th>
                    <th>Bộ Môn Chuyên Môn</th>
                    <th>Hệ Số Capacity</th>
                    <th>Hướng Nghiên Cứu Chuyên Sâu</th>
                    <th>Chỉ Tiêu / Đã Gán</th>
                    <th>Liên Hệ</th>
                    <th style={{ textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupervisors.map((s) => (
                    <tr key={s.id}>
                      <td className="font-code font-bold text-blue">{s.supervisor_id || s.username}</td>
                      <td>
                        <div className="font-bold text-slate-900">{s.user_full_name || s.username}</div>
                        {s.is_external && <span className="badge-external">Ngoài trường</span>}
                      </td>
                      <td>
                        <span className={`utc-badge-title title-${(s.academic_title || 'ths').toLowerCase().replace('.', '')}`}>
                          {s.academic_title || 'ThS'}
                        </span>
                      </td>
                      <td>
                        <div className="dept-name font-medium">{formatDepartmentName(s.department_name, s.department_code)}</div>
                        {s.department_code && <span className="dept-code">{s.department_code}</span>}
                      </td>
                      <td className="text-center font-bold text-emerald">
                        x{s.academic_rank_multiplier || 1.0}
                      </td>
                      <td className="research-cell">
                        {s.research_interest ? (
                          <div className="research-text" title={s.research_interest}>
                            {s.research_interest}
                          </div>
                        ) : (
                          <span className="text-muted-italic">Chưa cập nhật hướng nghiên cứu</span>
                        )}
                      </td>
                      <td>
                        <div className="quota-text">
                          <span className="font-bold text-slate-800">
                            {s.quota_info ? `${s.quota_info.current_assigned} / ${s.quota_info.max_total_quota} SV` : 'Chưa thiết lập'}
                          </span>
                        </div>
                      </td>
                      <td className="contact-cell">
                        <div>{s.email || '—'}</div>
                        {s.phone_number && <div className="text-phone">📞 {s.phone_number}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="utc-btn-edit-sup"
                          title="Cập nhật hướng nghiên cứu và học vị"
                        >
                          ✏️ Cập nhật
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Edit Supervisor Profile */}
        {editingSupervisor && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card">
              <div className="utc-modal-head">
                <div>
                  <h4>✏️ Cập Nhật Hồ Sơ Giảng Viên Nâng Cao</h4>
                  <p className="modal-sub">
                    Giảng viên: <strong>{editingSupervisor.user_full_name || editingSupervisor.username}</strong> ({editingSupervisor.supervisor_id || editingSupervisor.username})
                  </p>
                </div>
                <button onClick={() => setEditingSupervisor(null)} className="utc-btn-close">✕</button>
              </div>

              <form onSubmit={handleSaveSupervisor}>
                <div className="utc-form-grid">
                  <div className="utc-form-group">
                    <label>Học Vị / Học Hàm (*):</label>
                    <select
                      className="utc-input"
                      value={supTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      required
                    >
                      <option value="ThS">ThS - Thạc sĩ (Hệ số x1.0 - Chuẩn Cử nhân)</option>
                      <option value="TS">TS - Tiến sĩ (Hệ số x1.2 - Đủ chuẩn Kỹ sư)</option>
                      <option value="PGS.TS">PGS.TS - Phó Giáo sư (Hệ số x1.5 - Đủ chuẩn Kỹ sư)</option>
                      <option value="GS.TS">GS.TS - Giáo sư (Hệ số x2.0 - Đủ chuẩn Kỹ sư)</option>
                    </select>
                    <small className="help-text">
                      Học vị quyết định điều kiện hướng dẫn sinh viên Chương trình Kỹ sư và hệ số Capacity.
                    </small>
                  </div>

                  <div className="utc-form-group">
                    <label>Bộ Môn Chuyên Môn Trực Thuộc:</label>
                    <select
                      className="utc-input"
                      value={supDeptId}
                      onChange={(e) => setSupDeptId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">-- Chưa phân bổ bộ môn --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {formatDepartmentName(d.name, d.code)} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="utc-form-grid">
                  <div className="utc-form-group">
                    <label>Hệ Số Capacity (Khóa cứng theo học vị) (*):</label>
                    <input
                      type="number"
                      value={supMultiplier}
                      readOnly
                      disabled
                      className="utc-input"
                      style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 700, color: '#0369a1' }}
                    />
                    <small className="help-text" style={{ color: '#0284c7', fontWeight: 600 }}>
                      🔒 Hệ số capacity được khóa cứng tự động theo chuẩn UTC ({supTitle} = x{supMultiplier}).
                    </small>
                  </div>

                  <div className="utc-form-group">
                    <label>Số Điện Thoại Liên Hệ:</label>
                    <input
                      type="text"
                      placeholder="VD: 0912345678"
                      value={supPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSupPhone(val);
                        if (supTouched.phone) {
                          setSupErrors((prev) => ({ ...prev, phone: validateSupPhone(val) }));
                        }
                      }}
                      onBlur={() => {
                        setSupTouched((prev) => ({ ...prev, phone: true }));
                        setSupErrors((prev) => ({ ...prev, phone: validateSupPhone(supPhone) }));
                      }}
                      className={`utc-input ${supTouched.phone && supErrors.phone ? 'input-error' : ''}`}
                      style={supTouched.phone && supErrors.phone ? { borderColor: '#dc2626' } : undefined}
                    />
                    {supTouched.phone && supErrors.phone && (
                      <span style={{ color: '#dc2626', fontSize: '0.78rem', display: 'block', marginTop: 3 }}>
                        ❌ {supErrors.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="utc-form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Hướng Nghiên Cứu Chuyên Sâu (Chọn từ danh sách 7 hướng chuẩn khoa) <span style={{ color: '#dc2626' }}>*</span>:</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      {selectedAreas.length}/7 hướng đã chọn
                    </span>
                  </label>
                  
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '8px',
                      marginTop: '6px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: supTouched.areas && supErrors.areas ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    }}
                  >
                    {(topicAreas.filter((a) => a.is_active).length > 0
                      ? topicAreas.filter((a) => a.is_active).map((a) => a.name)
                      : UTC_RESEARCH_AREAS
                    ).map((area) => {
                      const isChecked = selectedAreas.includes(area);
                      return (
                        <label
                          key={area}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: isChecked ? '1px solid #0284c7' : '1px solid #e2e8f0',
                            background: isChecked ? '#e0f2fe' : '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: isChecked ? 600 : 400,
                            color: isChecked ? '#0369a1' : '#334155',
                            boxShadow: isChecked ? '0 1px 2px rgba(2, 132, 199, 0.15)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedAreas, area]
                                : selectedAreas.filter((a) => a !== area);
                              setSelectedAreas(next);
                              setSupTouched((prev) => ({ ...prev, areas: true }));
                              setSupErrors((prev) => ({ ...prev, areas: validateSupAreas(next) }));
                            }}
                          />
                          <span>{area}</span>
                        </label>
                      );
                    })}
                  </div>
                  {supTouched.areas && supErrors.areas && (
                    <span style={{ color: '#dc2626', fontSize: '0.8rem', display: 'block', marginTop: 4 }}>
                      ❌ {supErrors.areas}
                    </span>
                  )}
                  <small className="help-text" style={{ marginTop: '4px' }}>
                    💡 Sinh viên và Khoa sẽ dựa vào các hướng nghiên cứu được tích chọn này để ghép cặp đề tài và phân công nguyện vọng.
                  </small>
                </div>

                <div className="utc-modal-foot">
                  <button
                    type="button"
                    onClick={() => setEditingSupervisor(null)}
                    className="utc-btn-cancel"
                    disabled={saving}
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="utc-btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'Đang Lưu...' : '💾 Lưu Hồ Sơ Giảng Viên'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TopicArea CRUD Modal */}
        {showTopicAreaModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-card" style={{ maxWidth: '780px' }}>
              <div className="utc-modal-head">
                <h4>📚 Quản Lý Danh Mục Chuyên Ngành / Hướng Nghiên Cứu</h4>
                <button onClick={() => setShowTopicAreaModal(false)} className="utc-btn-close">✕</button>
              </div>
              <div className="utc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!areaCode.trim() || !areaName.trim() || savingArea) return;
                    try {
                      setSavingArea(true);
                      if (editingAreaId) {
                        await apiClient.patch(`/admin/topic-areas/${editingAreaId}/`, {
                          code: areaCode.trim(),
                          name: areaName.trim(),
                          description: areaDesc.trim(),
                        });
                      } else {
                        await apiClient.post('/admin/topic-areas/', {
                          code: areaCode.trim(),
                          name: areaName.trim(),
                          description: areaDesc.trim(),
                          is_active: true,
                        });
                      }
                      setEditingAreaId(null);
                      setAreaCode('');
                      setAreaName('');
                      setAreaDesc('');
                      await fetchTopicAreas();
                    } catch (err: any) {
                      alert('Lỗi lưu chuyên ngành: ' + (err.response?.data?.detail || err.message));
                    } finally {
                      setSavingArea(false);
                    }
                  }}
                  style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr auto', gap: '8px', alignItems: 'end', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Mã CN (*)</label>
                    <input type="text" required value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="VD: AI_DATA" className="utc-input" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Tên chuyên ngành (*)</label>
                    <input type="text" required value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="VD: Dữ liệu & Trí tuệ nhân tạo" className="utc-input" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Mô tả</label>
                    <input type="text" value={areaDesc} onChange={(e) => setAreaDesc(e.target.value)} placeholder="Mô tả ngắn gọn (tùy chọn)" className="utc-input" />
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="submit" disabled={savingArea} className="utc-btn-primary" style={{ whiteSpace: 'nowrap' }}>
                      {editingAreaId ? '💾 Cập nhật' : '➕ Thêm'}
                    </button>
                    {editingAreaId && (
                      <button type="button" onClick={() => { setEditingAreaId(null); setAreaCode(''); setAreaName(''); setAreaDesc(''); }} className="utc-btn-cancel" style={{ whiteSpace: 'nowrap' }}>Hủy</button>
                    )}
                  </div>
                </form>

                <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table className="utc-custom-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: 'nowrap' }}>Mã</th>
                        <th>Tên chuyên ngành</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Trạng thái</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topicAreas.map((a) => (
                        <tr key={a.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{a.code}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{a.name}</div>
                            {a.description && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{a.description}</div>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: a.is_active ? '#059669' : '#64748b', whiteSpace: 'nowrap' }}>
                              {a.is_active ? '● Đang mở' : '○ Đã ẩn'}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => { setEditingAreaId(a.id); setAreaCode(a.code); setAreaName(a.name); setAreaDesc(a.description || ''); }}
                                className="utc-btn-cancel"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                              >
                                ✏️ Sửa
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiClient.patch(`/admin/topic-areas/${a.id}/`, { is_active: !a.is_active });
                                  fetchTopicAreas();
                                }}
                                className="utc-btn-cancel"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                              >
                                {a.is_active ? 'Ẩn' : 'Hiện'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Xóa chuyên ngành '${a.name}'?`)) return;
                                  try {
                                    await apiClient.delete(`/admin/topic-areas/${a.id}/`);
                                    fetchTopicAreas();
                                  } catch (err: any) {
                                    alert(err.response?.data?.detail || err.message);
                                  }
                                }}
                                className="utc-btn-cancel"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#dc2626', whiteSpace: 'nowrap' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="utc-modal-foot">
                <button type="button" onClick={() => setShowTopicAreaModal(false)} className="utc-btn-cancel">Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './SupervisorsPage.css';

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
  const [supInterest, setSupInterest] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  useEffect(() => {
    fetchSupervisors();
    fetchDepartments();
  }, []);

  const handleOpenEdit = (sup: SupervisorProfile) => {
    setEditingSupervisor(sup);
    setSupTitle(sup.academic_title || 'ThS');
    setSupDeptId(sup.department_obj || '');
    setSupMultiplier(sup.academic_rank_multiplier || 1.0);
    setSupInterest(sup.research_interest || '');
    setSupPhone(sup.phone_number || '');
    setNotification(null);
  };

  const handleTitleChange = (newTitle: string) => {
    setSupTitle(newTitle);
    if (newTitle === 'GS.TS') setSupMultiplier(2.0);
    else if (newTitle === 'PGS.TS') setSupMultiplier(1.5);
    else if (newTitle === 'TS') setSupMultiplier(1.2);
    else setSupMultiplier(1.0);
  };

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupervisor) return;

    try {
      setSaving(true);
      await apiClient.patch(`/admin/supervisors/${editingSupervisor.id}/profile/`, {
        academic_title: supTitle,
        department_id: supDeptId ? Number(supDeptId) : null,
        academic_rank_multiplier: supMultiplier,
        research_interest: supInterest.trim(),
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
          <button onClick={() => fetchSupervisors()} className="utc-btn-refresh">
            🔄 Làm Mới Dữ Liệu
          </button>
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
                  {d.name} ({d.code})
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
                        <div className="dept-name font-medium">{s.department_name || 'Khoa CNTT'}</div>
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
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="utc-form-grid">
                  <div className="utc-form-group">
                    <label>Hệ Số Capacity (Hệ số nhân chỉ tiêu):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5.0"
                      value={supMultiplier}
                      onChange={(e) => setSupMultiplier(parseFloat(e.target.value) || 1.0)}
                      className="utc-input"
                      required
                    />
                    <small className="help-text">
                      Chỉ tiêu hướng dẫn tối đa = Base Quota * Hệ số ({supMultiplier}).
                    </small>
                  </div>

                  <div className="utc-form-group">
                    <label>Số Điện Thoại Liên Hệ:</label>
                    <input
                      type="text"
                      placeholder="VD: 0912345678"
                      value={supPhone}
                      onChange={(e) => setSupPhone(e.target.value)}
                      className="utc-input"
                    />
                  </div>
                </div>

                <div className="utc-form-group">
                  <label>Hướng Nghiên Cứu Chuyên Sâu (Research Interests) (*):</label>
                  <textarea
                    rows={4}
                    value={supInterest}
                    onChange={(e) => setSupInterest(e.target.value)}
                    placeholder="VD: Trí tuệ nhân tạo (AI), Học máy & Học sâu (Machine Learning / Deep Learning), Xử lý ngôn ngữ tự nhiên (NLP), Kiến trúc Microservices, Phát triển hệ thống phần mềm doanh nghiệp, An toàn thông tin mạng..."
                    className="utc-input"
                  />
                  <small className="help-text">
                    Sinh viên và Khoa sẽ dựa vào hướng nghiên cứu này để gán đề tài và phân công nguyện vọng chính xác.
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
      </div>
    </AdminLayout>
  );
};

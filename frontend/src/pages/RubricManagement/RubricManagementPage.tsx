import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { Rubric, RubricCriterion } from '../../types';

const ROLES = [
  { value: 'SUPERVISOR', label: 'GV Hướng dẫn' },
  { value: 'REVIEWER', label: 'GV Phản biện' },
  { value: 'COUNCIL', label: 'Hội đồng' },
];

const emptyRubric = (): Partial<Rubric> => ({
  name: '',
  evaluator_role: 'SUPERVISOR',
  description: '',
  is_active: true,
  criteria: [],
});

const emptyCriterion = (): Partial<RubricCriterion> => ({
  name: '',
  description: '',
  max_score: 10,
  order: 0,
});

export const RubricManagementPage: React.FC = () => {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Partial<Rubric> | null>(null);
  const [formData, setFormData] = useState<Partial<Rubric>>(emptyRubric());
  const [criteriaForm, setCriteriaForm] = useState<Partial<RubricCriterion>[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRubrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filterRole) params.role = filterRole;
      if (filterActive) params.active = filterActive;
      const data = await featuresApi.listRubrics(params);
      setRubrics(data);
    } catch {
      setError('Lỗi tải danh sách rubric.');
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterActive]);

  useEffect(() => {
    fetchRubrics();
  }, [fetchRubrics]);

  const openCreate = () => {
    setEditingRubric(null);
    setFormData(emptyRubric());
    setCriteriaForm([]);
    setShowForm(true);
  };

  const openEdit = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setFormData({ ...rubric });
    setCriteriaForm(rubric.criteria ? [...rubric.criteria] : []);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRubric(null);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      setError('Tên rubric không được để trống.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Rubric> = { ...formData, criteria: criteriaForm as RubricCriterion[] };
      if (editingRubric?.id) {
        await featuresApi.updateRubric(editingRubric.id, payload);
        setSuccess('Cập nhật rubric thành công.');
      } else {
        await featuresApi.createRubric(payload);
        setSuccess('Tạo rubric thành công.');
      }
      closeForm();
      fetchRubrics();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Lưu rubric thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rubric: Rubric) => {
    if (
      !window.confirm(
        `Xóa rubric "${rubric.name}"? Nếu đã có điểm nộp, rubric sẽ được chuyển sang trạng thái vô hiệu hóa.`
      )
    ) {
      return;
    }
    try {
      const result = await featuresApi.deleteRubric(rubric.id!);
      if (result?.deactivated) {
        setSuccess('Rubric đã được vô hiệu hóa (do đã có điểm nộp).');
      } else {
        setSuccess('Đã xóa rubric thành công.');
      }
      fetchRubrics();
    } catch {
      setError('Không thể xóa rubric.');
    }
  };

  const handleActivate = async (rubric: Rubric) => {
    try {
      await featuresApi.activateRubric(rubric.id!);
      setSuccess('Đã kích hoạt lại rubric.');
      fetchRubrics();
    } catch {
      setError('Không thể kích hoạt rubric.');
    }
  };

  const addCriterion = () => setCriteriaForm((prev) => [...prev, emptyCriterion()]);
  const removeCriterion = (i: number) =>
    setCriteriaForm((prev) => prev.filter((_, idx) => idx !== i));
  const updateCriterion = (i: number, field: keyof RubricCriterion, value: string | number) => {
    setCriteriaForm((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    );
  };

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            Quản Lý Rubric Chấm Điểm
          </h2>
          <button
            onClick={openCreate}
            style={{
              background: '#003366',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              padding: '8px 18px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Tạo Rubric Mới
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 7,
              border: '1px solid #cbd5e1',
              fontSize: '0.86rem',
            }}
          >
            <option value="">-- Tất cả vai trò --</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 7,
              border: '1px solid #cbd5e1',
              fontSize: '0.86rem',
            }}
          >
            <option value="">-- Trạng thái --</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã vô hiệu hóa</option>
          </select>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '10px 16px',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              background: '#f0fdf4',
              color: '#16a34a',
              padding: '10px 16px',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {success}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Đang tải...</div>
        )}

        {!loading && rubrics.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            Chưa có rubric nào.
          </div>
        )}

        {/* Rubric Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rubrics.map((rubric) => (
            <div
              key={rubric.id}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(0,51,102,0.08)',
                borderLeft: `4px solid ${rubric.is_active ? '#003366' : '#94a3b8'}`,
                opacity: rubric.is_active ? 1 : 0.7,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                      {rubric.name}
                    </span>
                    <span
                      style={{
                        background: rubric.is_active ? '#dbeafe' : '#f1f5f9',
                        color: rubric.is_active ? '#1d4ed8' : '#64748b',
                        borderRadius: 20,
                        padding: '1px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      {rubric.is_active ? 'Hoạt động' : 'Vô hiệu hóa'}
                    </span>
                    {rubric.has_scores && (
                      <span
                        style={{
                          background: '#fef9c3',
                          color: '#92400e',
                          borderRadius: 20,
                          padding: '1px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                        }}
                      >
                        Có điểm đã nộp
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.83rem', color: '#475569', marginBottom: 6 }}>
                    Vai trò:{' '}
                    <strong>
                      {ROLES.find((r) => r.value === rubric.evaluator_role)?.label ??
                        rubric.evaluator_role}
                    </strong>
                    {rubric.batch_code && (
                      <>
                        {' '}
                        &middot; Đợt: <strong>{rubric.batch_code}</strong>
                      </>
                    )}
                    &nbsp;&middot;&nbsp;Tổng điểm tối đa: <strong>{rubric.total_max ?? 0}</strong>
                  </div>
                  {rubric.description && (
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 6 }}>
                      {rubric.description}
                    </div>
                  )}
                  {/* Criteria list */}
                  {rubric.criteria && rubric.criteria.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {rubric.criteria.map((c) => (
                        <span
                          key={c.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '2px 10px',
                            fontSize: '0.78rem',
                            color: '#475569',
                          }}
                        >
                          {c.name} ({c.max_score} điểm)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => openEdit(rubric)}
                    style={{
                      background: '#f0f9ff',
                      color: '#0369a1',
                      border: '1px solid #bae6fd',
                      borderRadius: 6,
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    Sửa
                  </button>
                  {!rubric.is_active && (
                    <button
                      onClick={() => handleActivate(rubric)}
                      style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: 6,
                        padding: '5px 12px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                      }}
                    >
                      Kích hoạt
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(rubric)}
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create/Edit Modal */}
        {showForm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 28,
                maxWidth: 680,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, color: '#1e293b' }}>
                {editingRubric?.id ? 'Cập nhật Rubric' : 'Tạo Rubric Mới'}
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#475569',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Tên rubric *
                  </label>
                  <input
                    type="text"
                    value={formData.name ?? ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.87rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#475569',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Vai trò đánh giá *
                  </label>
                  <select
                    value={formData.evaluator_role ?? 'SUPERVISOR'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        evaluator_role: e.target.value as Rubric['evaluator_role'],
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.87rem',
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#475569',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Mô tả
                </label>
                <textarea
                  value={formData.description ?? ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.87rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Criteria */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>
                    Tiêu chí chấm điểm ({criteriaForm.length})
                  </label>
                  <button
                    type="button"
                    onClick={addCriterion}
                    style={{
                      background: '#003366',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    + Thêm tiêu chí
                  </button>
                </div>
                {criteriaForm.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 36px',
                      gap: 8,
                      marginBottom: 8,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      placeholder={`Tên tiêu chí ${i + 1}`}
                      value={c.name ?? ''}
                      onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.84rem',
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="Điểm tối đa"
                      value={c.max_score ?? 10}
                      onChange={(e) =>
                        updateCriterion(i, 'max_score', parseFloat(e.target.value) || 0)
                      }
                      style={{
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.84rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeCriterion(i)}
                      title="Xóa tiêu chí"
                      style={{
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        borderRadius: 6,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={closeForm}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 20px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: '#003366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 20px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {saving ? <><span className="m-spinner" aria-hidden="true" /> Đang lưu...</> : editingRubric?.id ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

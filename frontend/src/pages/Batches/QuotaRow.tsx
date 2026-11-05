import React, { useState } from 'react';

interface QuotaItem {
  id: number;
  supervisor: number;
  supervisor_id_code: string;
  supervisor_name: string;
  academic_title: string;
  phone_number: string;
  batch: number;
  department: string;
  base_quota?: number;
  rank_multiplier?: number;
  viet_anh_quota: number;
  general_cntt_quota: number;
  max_total_quota: number;
  current_assigned: number;
}

interface Props {
  quota: QuotaItem;
  onSave: (quota: QuotaItem, maxTotal: number) => Promise<void>;
}

/**
 * Dòng cấu hình quota (chỉ tiêu hướng dẫn) của 1 giảng viên trong đợt.
 * Cho phép sửa nhanh "Max Quota" và lưu lại.
 */
export const QuotaRow: React.FC<Props> = ({ quota, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [maxTotal, setMaxTotal] = useState<number>(quota.max_total_quota ?? 0);
  const [saving, setSaving] = useState(false);

  const assigned = quota.current_assigned || 0;
  const isOver = assigned > maxTotal;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(quota, maxTotal);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{quota.supervisor_id_code}</td>
      <td style={{ fontWeight: 600 }}>{quota.supervisor_name || '—'}</td>
      <td>
        <span className="utc-badge-edu">{quota.academic_title || '—'}</span>
      </td>
      <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{quota.department || '—'}</td>
      <td>
        {editing ? (
          <input
            type="number"
            min={0}
            max={50}
            value={maxTotal}
            onChange={(e) => setMaxTotal(Number(e.target.value))}
            className="utc-input"
            style={{ width: '90px', padding: '0.3rem 0.5rem' }}
            autoFocus
          />
        ) : (
          <strong style={{ color: isOver ? '#b91c1c' : '#0f2b5c' }}>{quota.max_total_quota}</strong>
        )}
      </td>
      <td>
        <span
          style={{
            fontWeight: 700,
            color: isOver ? '#b91c1c' : assigned > 0 ? '#0284c7' : '#94a3b8',
          }}
        >
          {assigned}
        </span>
        {isOver && (
          <span title="Vượt quota" style={{ marginLeft: 4 }}>
            ⚠️
          </span>
        )}
      </td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className="utc-btn-emerald"
              style={{ fontSize: '0.76rem', padding: '0.28rem 0.6rem' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '...' : '💾 Lưu'}
            </button>
            <button
              type="button"
              className="utc-btn-cancel"
              style={{ fontSize: '0.76rem', padding: '0.28rem 0.6rem' }}
              onClick={() => {
                setMaxTotal(quota.max_total_quota ?? 0);
                setEditing(false);
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="utc-btn-outline"
            style={{ fontSize: '0.76rem', padding: '0.28rem 0.6rem' }}
            onClick={() => setEditing(true)}
          >
            ✏️ Sửa quota
          </button>
        )}
      </td>
    </tr>
  );
};

export default QuotaRow;

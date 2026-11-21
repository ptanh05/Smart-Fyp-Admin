import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { DataRetentionPreview, DataRetentionApplyResult } from '../../types';

const CONFIRM_TOKEN = 'XAC_NHAN_XOA';

const CountRow: React.FC<{ label: string; count: number; warn?: boolean }> = ({ label, count, warn }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 12px', borderBottom: '1px solid #f1f5f9',
  }}>
    <span style={{ fontSize: '0.86rem', color: '#475569' }}>{label}</span>
    <span style={{
      fontWeight: 700,
      color: count > 0 ? (warn ? '#dc2626' : '#1e293b') : '#94a3b8',
    }}>
      {count}
    </span>
  </div>
);

export const DataRetentionPage: React.FC = () => {
  const [years, setYears] = useState(5);
  const [preview, setPreview] = useState<DataRetentionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<DataRetentionApplyResult | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showApplyPanel, setShowApplyPanel] = useState(false);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);
    try {
      const data = await featuresApi.getRetentionPreview(years);
      setPreview(data);
    } catch {
      setError('Loi tai xem truoc chinh sach luu giu du lieu.');
    } finally {
      setLoading(false);
    }
  }, [years]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  const handleApply = async () => {
    if (confirmText !== CONFIRM_TOKEN) {
      setError(`Nhap chinh xac "${CONFIRM_TOKEN}" de xac nhan.`);
      return;
    }
    if (!window.confirm(`XAC NHAN: Thao tac nay se xoa du lieu khong the phuc hoi. Ban co chac khong?`)) return;
    setApplyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await featuresApi.applyRetention(years);
      setApplyResult(result);
      if (result.applied) {
        setSuccess(`Da ap dung chinh sach luu giu du lieu thanh cong. Cutoff: ${result.cutoff}`);
        setShowApplyPanel(false);
        setConfirmText('');
        fetchPreview();
      } else {
        setSuccess(result.detail || 'Khong co du lieu nao can xoa.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Loi ap dung chinh sach luu giu du lieu.');
    } finally {
      setApplyLoading(false);
    }
  };

  const hasData = preview && Object.values(preview.counts).some((v) => typeof v === 'number' && v > 0);

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Chinh Sach Luu Giu Du Lieu</h2>
        <p style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: 24, lineHeight: 1.6 }}>
          Theo Nghi dinh 13/2023/ND-CP: Xoa du lieu ca nhan khong con can thiet cua cac dot da dong qua
          so nam quy dinh. Giu lai: ho so do an, diem, ban luu tru chinh thuc. Xoa: file minh chung, bao cao tuan,
          task deliverable, phien ban bai nop (tru ban luu tru), thong tin thuc tap va nguyen vong.
        </p>

        {/* Years selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#475569' }}>
            Thoi gian luu giu (nam):
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={years}
            onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 5))}
            style={{ width: 80, padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center' }}
          />
          <button
            onClick={fetchPreview}
            disabled={loading}
            style={{ background: '#003366', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            {loading ? 'Dang tinh...' : 'Tinh truoc'}
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 16px', borderRadius: 8, marginBottom: 12 }}>{success}</div>}

        {preview && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
            {/* Summary */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
                Thong ke xem truoc
              </h3>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '8px 12px', marginBottom: 12, fontSize: '0.84rem', color: '#92400e' }}>
                Nguong ngay: <strong>{preview.cutoff}</strong> ({years} nam truoc)
              </div>
              <CountRow label="So dot du dieu kien" count={preview.counts.batches} warn />
              <CountRow label="So do an nam trong pham vi" count={preview.counts.projects_in_scope} />
              <CountRow label="File minh chung bao luu" count={preview.counts.deferral_evidence_files} warn={preview.counts.deferral_evidence_files > 0} />
              <CountRow label="File bao cao tuan" count={preview.counts.weekly_report_files} warn={preview.counts.weekly_report_files > 0} />
              <CountRow label="File task deliverable" count={preview.counts.task_deliverable_files} warn={preview.counts.task_deliverable_files > 0} />
              <CountRow label="Phien ban bai nop (giu lai ban cuoi)" count={preview.counts.submission_versions} warn={preview.counts.submission_versions > 0} />
              <CountRow label="Thong tin thuc tap" count={preview.counts.internship_info} warn={preview.counts.internship_info > 0} />
              <CountRow label="Nguyen vong GVHD" count={preview.counts.student_preferences} warn={preview.counts.student_preferences > 0} />
            </div>

            {/* Batch list */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
                Cac dot du dieu kien ({preview.batches.length})
              </h3>
              {preview.batches.length === 0 ? (
                <div style={{ color: '#16a34a', fontSize: '0.86rem', padding: '12px 0' }}>
                  Khong co dot nao can xu ly voi nguong {years} nam.
                </div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {preview.batches.map((b) => (
                    <div key={b.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '0.84rem' }}>
                      <span style={{ fontWeight: 600, color: '#003366' }}>{b.batch_code}</span>
                      <span style={{ color: '#64748b', marginLeft: 8 }}>{b.batch_name}</span>
                      {b.end_date && <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: '0.78rem' }}>Ket thuc: {b.end_date}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Apply Panel */}
        {preview && hasData && (
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)', borderLeft: '4px solid #dc2626' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626', margin: 0 }}>
                Ap dung chinh sach (KHONG the hoan tac)
              </h3>
              <button
                onClick={() => setShowApplyPanel((v) => !v)}
                style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}
              >
                {showApplyPanel ? 'An' : 'Hien thi panel xac nhan'}
              </button>
            </div>

            {showApplyPanel && (
              <div>
                <p style={{ fontSize: '0.84rem', color: '#7f1d1d', marginBottom: 12 }}>
                  Nhap <strong>{CONFIRM_TOKEN}</strong> de xac nhan xoa du lieu:
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_TOKEN}
                    style={{
                      padding: '8px 12px', borderRadius: 7, border: `2px solid ${confirmText === CONFIRM_TOKEN ? '#16a34a' : '#fca5a5'}`,
                      fontSize: '0.9rem', fontFamily: 'monospace', width: 200,
                    }}
                  />
                  <button
                    onClick={handleApply}
                    disabled={applyLoading || confirmText !== CONFIRM_TOKEN}
                    style={{
                      background: confirmText === CONFIRM_TOKEN ? '#dc2626' : '#fca5a5',
                      color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px',
                      cursor: confirmText === CONFIRM_TOKEN ? 'pointer' : 'not-allowed',
                      fontWeight: 700, fontSize: '0.86rem',
                    }}
                  >
                    {applyLoading ? 'Dang xu ly...' : 'XAC NHAN XOA DU LIEU'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {preview && !hasData && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 20px', color: '#16a34a', fontWeight: 600 }}>
            Khong co du lieu nao can xu ly voi nguong {years} nam.
          </div>
        )}

        {applyResult && applyResult.applied && applyResult.deleted_counts && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', marginTop: 16 }}>
            <h4 style={{ color: '#dc2626', marginBottom: 8, fontSize: '0.9rem' }}>Ket qua xoa du lieu:</h4>
            {Object.entries(applyResult.deleted_counts).map(([k, v]) => (
              <div key={k} style={{ fontSize: '0.84rem', color: '#7f1d1d' }}>
                {k}: <strong>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

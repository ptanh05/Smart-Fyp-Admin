import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { ThesisArchiveRecord, ThesisArchiveListResponse } from '../../types';

const VisibilityBadge: React.FC<{ v: string; isEmbargoed?: boolean }> = ({ v, isEmbargoed }) => {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    PUBLIC: { bg: '#f0fdf4', color: '#16a34a', label: 'Công khai' },
    INTERNAL: { bg: '#eff6ff', color: '#1d4ed8', label: 'Nội bộ' },
    EMBARGOED: { bg: isEmbargoed ? '#fef2f2' : '#fef9c3', color: isEmbargoed ? '#dc2626' : '#92400e', label: isEmbargoed ? 'Embargo (còn hiệu lực)' : 'Embargo (hết hạn)' },
  };
  const s = styles[v] || { bg: '#f1f5f9', color: '#64748b', label: v };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.76rem', fontWeight: 600 }}>
      {s.label}
    </span>
  );
};

interface EmbargoDialogProps {
  record: ThesisArchiveRecord;
  onClose: () => void;
  onSaved: (updated: ThesisArchiveRecord) => void;
}

const EmbargoDialog: React.FC<EmbargoDialogProps> = ({ record, onClose, onSaved }) => {
  const [reason, setReason] = useState(record.embargo_reason ?? '');
  const [until, setUntil] = useState(record.embargo_until ?? '');
  const [maxYears, setMaxYears] = useState(3);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSet = async () => {
    if (!reason.trim()) { setErr('Vui lòng nhập lý do embargo.'); return; }
    setSaving(true);
    setErr('');
    try {
      const updated = await featuresApi.setEmbargo(record.id, {
        embargo_reason: reason,
        embargo_until: until || undefined,
        max_years: maxYears,
      });
      onSaved(updated);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Lỗi đặt embargo.');
    } finally {
      setSaving(false);
    }
  };

  const handleLift = async () => {
    if (!window.confirm('Xác nhận gỡ embargo? Bản ghi sẽ chuyển về Công khai.')) return;
    setSaving(true);
    try {
      const updated = await featuresApi.liftEmbargo(record.id);
      onSaved(updated);
    } catch {
      setErr('Lỗi gỡ embargo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, color: '#1e293b' }}>
          Quản lý Embargo — {record.title.slice(0, 60)}...
        </h3>
        {err && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: '0.85rem' }}>{err}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Lý do embargo *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ví dụ: Bí mật doanh nghiệp, chờ công bố bài báo..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Hạn đến ngày (tùy chọn)</label>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Giới hạn tối đa (năm)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxYears}
              onChange={(e) => setMaxYears(parseInt(e.target.value) || 3)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <div>
            {record.visibility === 'EMBARGOED' && (
              <button
                onClick={handleLift}
                disabled={saving}
                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem' }}
              >
                Gỡ Embargo
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600 }}
            >
              Hủy
            </button>
            <button
              onClick={handleSet}
              disabled={saving}
              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600 }}
            >
              {saving ? <><span className="m-spinner" aria-hidden="true" /> Đang lưu...</> : 'Đặt Embargo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ThesisArchivePage: React.FC = () => {
  const [listData, setListData] = useState<ThesisArchiveListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [visibility, setVisibility] = useState('');
  const [embargoActive, setEmbargoActive] = useState('');
  const [batchId] = useState('');
  const [page, setPage] = useState(1);
  const [embargoRecord, setEmbargoRecord] = useState<ThesisArchiveRecord | null>(null);

  const fetchArchive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { page };
      if (keyword) params.keyword = keyword;
      if (visibility) params.visibility = visibility;
      if (embargoActive) params.embargo_active = embargoActive === 'true';
      if (batchId) params.batch_id = batchId;
      const data = await featuresApi.listArchive(params);
      setListData(data);
    } catch {
      setError('Lỗi tải kho lưu trữ.');
    } finally {
      setLoading(false);
    }
  }, [keyword, visibility, embargoActive, batchId, page]);

  useEffect(() => { fetchArchive(); }, [fetchArchive]);

  const handleEmbargoSaved = (updated: ThesisArchiveRecord) => {
    setEmbargoRecord(null);
    if (listData) {
      setListData({
        ...listData,
        results: listData.results.map((r) => (r.id === updated.id ? updated : r)),
      });
    }
  };

  const totalPages = listData ? Math.ceil(listData.count / (listData.page_size || 20)) : 1;

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>Kho Lưu Trữ Đồ Án (Thesis Archive)</h2>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Tìm theo từ khóa, tiêu đề..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem', width: 240 }}
          />
          <select
            value={visibility}
            onChange={(e) => { setVisibility(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
          >
            <option value="">-- Chế độ công bố --</option>
            <option value="PUBLIC">Công khai</option>
            <option value="INTERNAL">Nội bộ</option>
            <option value="EMBARGOED">Embargo</option>
          </select>
          <select
            value={embargoActive}
            onChange={(e) => { setEmbargoActive(e.target.value); setPage(1); }}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
          >
            <option value="">-- Embargo đang hiệu lực --</option>
            <option value="true">Có</option>
            <option value="false">Không</option>
          </select>
          <button
            onClick={fetchArchive}
            style={{ background: '#003366', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Tìm kiếm
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}

        {loading && <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Đang tải...</div>}

        {listData && (
          <>
            <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 10 }}>
              Tìm thấy {listData.count} bản lưu trữ &bull; Trang {page}/{totalPages}
            </div>
            {listData.results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Không có kết quả.</div>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['MSSV', 'Tiêu đề', 'Đợt', 'Điểm', 'Trạng thái', 'Lưu trữ lúc', 'Thao tác'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listData.results.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.student_code || '—'}</td>
                        <td style={{ padding: '9px 12px', maxWidth: 260 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</div>
                          {r.keywords && <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 2 }}>{r.keywords}</div>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{r.batch_code || '—'}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#003366' }}>
                          {r.final_score !== null ? r.final_score : '—'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <VisibilityBadge v={r.visibility} isEmbargoed={r.is_embargoed} />
                          {r.embargo_until && (
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                              Đến: {r.embargo_until}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {new Date(r.archived_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button
                            onClick={() => setEmbargoRecord(r)}
                            style={{
                              background: r.visibility === 'EMBARGOED' ? '#fef2f2' : '#fffbeb',
                              color: r.visibility === 'EMBARGOED' ? '#dc2626' : '#92400e',
                              border: `1px solid ${r.visibility === 'EMBARGOED' ? '#fca5a5' : '#fde68a'}`,
                              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                              fontSize: '0.78rem', fontWeight: 600,
                            }}
                          >
                            {r.visibility === 'EMBARGOED' ? 'Sửa Embargo' : 'Đặt Embargo'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', background: page <= 1 ? '#f8fafc' : '#fff' }}
                >
                  Trước
                </button>
                <span style={{ padding: '5px 14px', fontSize: '0.85rem', color: '#475569' }}>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', background: page >= totalPages ? '#f8fafc' : '#fff' }}
                >
                  Tiếp
                </button>
              </div>
            )}
          </>
        )}

        {embargoRecord && (
          <EmbargoDialog
            record={embargoRecord}
            onClose={() => setEmbargoRecord(null)}
            onSaved={handleEmbargoSaved}
          />
        )}
      </div>
    </AdminLayout>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { featuresApi } from '../../api/features';
import type { FacultyAnalyticsData, ScoreDiscrepancyResponse } from '../../types';

const KPITile: React.FC<{ label: string; value: string | number | null; sub?: string }> = ({
  label, value, sub,
}) => (
  <div style={{
    background: '#fff', borderRadius: 10, padding: '18px 22px',
    boxShadow: '0 2px 8px rgba(0,51,102,0.08)', minWidth: 160, flex: '1 1 160px',
  }}>
    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#003366' }}>
      {value === null || value === undefined ? '—' : value}
    </div>
    {sub && <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
  </div>
);

const CSSBar: React.FC<{ label: string; count: number; maxCount: number }> = ({
  label, count, maxCount,
}) => {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ width: 48, fontSize: '0.78rem', color: '#64748b', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 16, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #003366 0%, #0057A6 100%)',
          borderRadius: 4, transition: 'width 0.4s',
        }} />
      </div>
      <span style={{ width: 32, fontSize: '0.78rem', color: '#1e293b', textAlign: 'right' }}>{count}</span>
    </div>
  );
};

export const FacultyAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<FacultyAnalyticsData | null>(null);
  const [discrepancy, setDiscrepancy] = useState<ScoreDiscrepancyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState('');
  const [department, setDepartment] = useState('');
  const [showDiscrepancy, setShowDiscrepancy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analytics, disc] = await Promise.allSettled([
        featuresApi.getFacultyAnalytics({
          batch_id: batchId || undefined,
          department: department || undefined,
        }),
        featuresApi.getScoreDiscrepancy({ batch_id: batchId || undefined }),
      ]);
      if (analytics.status === 'fulfilled') setData(analytics.value);
      else setError('Loi tai du lieu analytics.');
      if (disc.status === 'fulfilled') setDiscrepancy(disc.value);
    } finally {
      setLoading(false);
    }
  }, [batchId, department]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxBucket = data
    ? Math.max(...data.score_distribution.map((b) => b.count), 1)
    : 1;

  return (
    <AdminLayout>
      <div className="utc-admin-portal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            Phan Tich Giang Vien & Sinh Vien
          </h2>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              background: '#003366', color: '#fff', border: 'none', borderRadius: 7,
              padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            {loading ? 'Dang tai...' : 'Lam moi'}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
          >
            <option value="">-- Tat ca dot DATN --</option>
            {data?.available_batches?.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_code} — {b.batch_name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Loc theo bo mon..."
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.86rem', width: 220 }}
          />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Dang tai du lieu...</div>
        )}

        {data && (
          <>
            {/* KPI Tiles */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
              <KPITile label="Tong so do an" value={data.total_projects} />
              <KPITile
                label="Ti le dat"
                value={data.pass_rate !== null ? `${data.pass_rate}%` : null}
                sub={`Dat: ${data.status_counts['PASSED'] ?? 0} / Khong dat: ${data.status_counts['FAILED'] ?? 0}`}
              />
              <KPITile
                label="Diem TB"
                value={data.average_final_score ?? '—'}
                sub="Thang 10"
              />
              <KPITile label="Task tre han" value={data.tasks.overdue} sub={`Tren tong ${data.tasks.total} task`} />
              <KPITile label="Nop muon" value={`${data.tasks.late_rate}%`} sub="Ti le nop muon" />
            </div>

            {/* Score Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14, color: '#1e293b' }}>
                  Phan bo diem (thang 10)
                </h3>
                {data.score_distribution.map((bucket) => (
                  <CSSBar
                    key={bucket.range}
                    label={bucket.range}
                    count={bucket.count}
                    maxCount={maxBucket}
                  />
                ))}
                {data.score_distribution.every((b) => b.count === 0) && (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chua co du lieu diem.</div>
                )}
              </div>

              {/* Status breakdown */}
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14, color: '#1e293b' }}>
                  Trang thai do an
                </h3>
                {Object.entries(data.status_counts).map(([s, c]) => (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.84rem', color: '#475569' }}>{s}</span>
                    <span style={{ fontWeight: 700, color: '#003366' }}>{c}</span>
                  </div>
                ))}
                {Object.keys(data.status_counts).length === 0 && (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chua co do an.</div>
                )}
              </div>
            </div>

            {/* Supervisor Load table */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14, color: '#1e293b' }}>
                Tai hung dan cua Giang vien
              </h3>
              {data.supervisor_load.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chua co du lieu.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Ho ten', 'Hoc vi', 'Bo mon', 'Da phan cong', 'Han muc'].map((h) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.supervisor_load.map((row) => (
                        <tr key={row.supervisor_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>{row.name || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.academic_title || '—'}</td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.department || '—'}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#003366' }}>{row.assigned}</td>
                          <td style={{ padding: '8px 12px', color: row.quota && row.assigned > row.quota ? '#dc2626' : '#16a34a' }}>
                            {row.quota ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Score discrepancy section */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,51,102,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  Phat hien lech diem ({discrepancy?.count ?? 0} truong hop)
                </h3>
                <button
                  onClick={() => setShowDiscrepancy((v) => !v)}
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  {showDiscrepancy ? 'An' : 'Hien thi'}
                </button>
              </div>
              {showDiscrepancy && discrepancy && discrepancy.results.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#fef9f0' }}>
                        {['MSSV', 'De tai', 'Dot', 'Spread', 'Nguon diem'].map((h) => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#92400e', borderBottom: '2px solid #fbbf24' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {discrepancy.results.map((item) => (
                        <tr key={item.project_id} style={{ borderBottom: '1px solid #fef3c7' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.student_code}</td>
                          <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.topic_title_vi}</td>
                          <td style={{ padding: '8px 10px' }}>{item.batch_code}</td>
                          <td style={{ padding: '8px 10px', color: '#dc2626', fontWeight: 700 }}>{item.spread}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {item.entries.map((e, i) => (
                              <span
                                key={i}
                                style={{
                                  display: 'inline-block', marginRight: 4, marginBottom: 2,
                                  background: e.is_outlier ? '#fef2f2' : '#f0fdf4',
                                  color: e.is_outlier ? '#dc2626' : '#16a34a',
                                  border: `1px solid ${e.is_outlier ? '#fca5a5' : '#86efac'}`,
                                  borderRadius: 4, padding: '1px 6px', fontSize: '0.76rem',
                                }}
                              >
                                {e.source}: {e.score_10}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {showDiscrepancy && discrepancy?.results.length === 0 && (
                <div style={{ color: '#16a34a', fontSize: '0.85rem' }}>Khong phat hien truong hop lech diem dang ke.</div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

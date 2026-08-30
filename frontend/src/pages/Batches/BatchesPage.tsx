import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiClient } from '../../api/client';
import './BatchesPage.css';

interface AcademicBatch {
  id: number;
  batch_code: string;
  batch_name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  student_count: number;
  project_count: number;
  classes: Array<{
    id: number;
    class_code: string;
    class_name: string;
    program_type: string;
    class_group: string;
    student_count: number;
  }>;
}

export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<AcademicBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // New batch form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBatchCode, setNewBatchCode] = useState('');
  const [newBatchName, setNewBatchName] = useState('');

  // Import Excel form
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

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

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchCode || !newBatchName) return;

    try {
      await apiClient.post('/admin/batches/', {
        batch_code: newBatchCode,
        batch_name: newBatchName,
        is_active: true
      });
      setShowCreateModal(false);
      setNewBatchCode('');
      setNewBatchName('');
      fetchBatches();
    } catch (err) {
      alert('Lỗi tạo đợt làm đồ án: ' + JSON.stringify(err));
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

  return (
    <AdminLayout>
      <div className="utc-batches-portal">
        {/* Header Bar */}
        <div className="utc-batches-header-bar">
          <div className="utc-batches-header-info">
            <h3>📅 Quản Lý Đợt Đồ Án Tốt Nghiệp & Import Danh Sách Sinh Viên</h3>
            <p>Quản lý kỳ học, lớp học phần và import sinh viên theo biểu mẫu Excel cổng đào tạo UTC</p>
          </div>
          <div className="utc-batches-actions">
            <button onClick={() => setShowCreateModal(true)} className="utc-btn-primary">
              <span>➕</span> Tạo đợt ĐATN mới
            </button>
            <button onClick={() => setShowImportModal(true)} className="utc-btn-emerald">
              <span>📊</span> Import Danh sách Sinh viên (Excel)
            </button>
          </div>
        </div>

        {/* Batches Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Đang tải danh sách đợt đào tạo...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#fff', borderRadius: '12px' }}>
            Chưa có đợt làm ĐATN nào. Hãy nhấn nút "Tạo đợt ĐATN mới".
          </div>
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
                    <h4 className="utc-batch-card-title">{batch.batch_name}</h4>
                  </div>
                  {batch.is_active && (
                    <span className="utc-badge-active">🟢 Đang hoạt động</span>
                  )}
                </div>

                <div className="utc-batch-stats-row">
                  <div className="utc-batch-stat-item">
                    <span className="utc-batch-stat-label">Tổng sinh viên:</span>
                    <span className="utc-batch-stat-val">{batch.student_count} SV</span>
                  </div>
                  <div className="utc-batch-stat-item">
                    <span className="utc-batch-stat-label">Đã phân đề tài:</span>
                    <span className="utc-batch-stat-val emerald">{batch.project_count} Đề tài</span>
                  </div>
                </div>

                {/* Course classes summary */}
                <div className="utc-batch-classes-section">
                  <span className="utc-batch-classes-label">Các lớp học phần ({batch.classes?.length || 0}):</span>
                  <div className="utc-batch-classes-tags">
                    {batch.classes && batch.classes.length > 0 ? (
                      batch.classes.map((c) => (
                        <span key={c.id} className="utc-class-tag">
                          {c.class_code} ({c.student_count} SV)
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chưa có lớp nào (Hãy import Excel)</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create Batch */}
        {showCreateModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-box">
              <h3>Tạo Đợt làm ĐATN mới</h3>
              <p>Nhập mã định danh và tên khóa/đợt học phần tốt nghiệp.</p>
              <form onSubmit={handleCreateBatch}>
                <div className="utc-form-group">
                  <label>Mã đợt (Mã duy nhất)</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 2026_2027_HK1"
                    value={newBatchCode}
                    onChange={(e) => setNewBatchCode(e.target.value)}
                    className="utc-form-input"
                  />
                </div>
                <div className="utc-form-group">
                  <label>Tên đợt đào tạo</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đợt Đồ án Tốt nghiệp HK1 (2026-2027) K60-K63"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    className="utc-form-input"
                  />
                </div>
                <div className="utc-modal-footer">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="utc-btn-cancel">
                    Hủy
                  </button>
                  <button type="submit" className="utc-btn-primary">
                    Tạo đợt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Import Excel */}
        {showImportModal && (
          <div className="utc-modal-backdrop">
            <div className="utc-modal-box">
              <h3>Import Danh sách Sinh viên từ file Excel</h3>
              <p>
                Hỗ trợ file biểu mẫu của Cổng đào tạo UTC chứa các sheet: CNT04.101, IT1.243.102, IT1.659.103...
              </p>

              <form onSubmit={handleImportExcel}>
                <div className="utc-form-group">
                  <label>Chọn Đợt đào tạo áp dụng</label>
                  <select
                    value={selectedBatchId || ''}
                    onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                    className="utc-form-select"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_name} ({b.batch_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="utc-form-group">
                  <label>Chọn file Excel (.xlsx)</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    required
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="utc-form-input"
                  />
                </div>

                {importResult && (
                  <div className="utc-import-feedback">
                    <p style={{ fontWeight: 700, color: '#16a34a', margin: '0 0 0.5rem 0' }}>Kết quả Import:</p>
                    <p style={{ margin: '0.2rem 0' }}>Tổng sinh viên đọc: {importResult.total}</p>
                    <p style={{ margin: '0.2rem 0', color: '#16a34a' }}>Đã tạo mới: {importResult.created}</p>
                    <p style={{ margin: '0.2rem 0', color: '#0284c7' }}>Đã cập nhật: {importResult.updated}</p>
                    {importResult.skipped > 0 && <p style={{ margin: '0.2rem 0', color: '#d97706' }}>Bỏ qua / Lỗi: {importResult.skipped}</p>}
                    {importResult.errors?.length > 0 && (
                      <div style={{ marginTop: '0.5rem', color: '#dc2626', maxHeight: '100px', overflowY: 'auto' }}>
                        {importResult.errors.map((err: string, i: number) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="utc-modal-footer">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResult(null);
                    }}
                    className="utc-btn-cancel"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={importing}
                    className="utc-btn-emerald"
                  >
                    {importing ? 'Đang import dữ liệu...' : 'Bắt đầu Import'}
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

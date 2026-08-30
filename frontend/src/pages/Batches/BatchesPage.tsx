import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { apiClient } from '../../api/client';

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
    <AdminLayout title="Quản lý Đợt Đồ án Tốt nghiệp & Import Danh sách Sinh viên">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div>
            <h3 className="font-bold text-slate-100">Các đợt làm ĐATN Khoa CNTT</h3>
            <p className="text-xs text-slate-400">Quản lý kỳ học, lớp học phần và import sinh viên theo biểu mẫu Excel cổng đào tạo</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <span>➕</span> Tạo đợt ĐATN mới
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              <span>📊</span> Import Danh sách Sinh viên (Excel)
            </button>
          </div>
        </div>

        {/* Batches Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Đang tải danh sách đợt đào tạo...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Chưa có đợt làm ĐATN nào. Hãy tạo đợt mới.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((batch) => (
              <div
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className={`p-5 rounded-xl border transition-all cursor-pointer ${
                  selectedBatchId === batch.id
                    ? 'bg-slate-800/80 border-blue-500 ring-1 ring-blue-500/50 shadow-xl'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {batch.batch_code}
                    </span>
                    <h4 className="font-bold text-base text-slate-100 mt-2">{batch.batch_name}</h4>
                  </div>
                  {batch.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Đang hoạt động
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/60 text-xs">
                  <div>
                    <span className="text-slate-400">Tổng sinh viên:</span>
                    <p className="text-base font-bold text-slate-200 mt-0.5">{batch.student_count} SV</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Đã phân đề tài:</span>
                    <p className="text-base font-bold text-emerald-400 mt-0.5">{batch.project_count} Đề tài</p>
                  </div>
                </div>

                {/* Course classes summary */}
                <div className="mt-4 pt-3 border-t border-slate-800/40">
                  <p className="text-xs font-semibold text-slate-300 mb-2">Các lớp học phần ({batch.classes?.length || 0}):</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {batch.classes?.map((c) => (
                      <span key={c.id} className="text-xs px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300">
                        {c.class_code} ({c.student_count} SV)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create Batch */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Tạo Đợt làm ĐATN mới</h3>
              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Mã đợt (Mã duy nhất)</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 2026_2027_HK1"
                    value={newBatchCode}
                    onChange={(e) => setNewBatchCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tên đợt đào tạo</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đợt Đồ án Tốt nghiệp HK1 (2026-2027) K60-K63"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition"
                  >
                    Tạo đợt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Import Excel */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-lg w-full shadow-2xl">
              <h3 className="text-lg font-bold text-slate-100 mb-2">Import Danh sách Sinh viên từ file Excel</h3>
              <p className="text-xs text-slate-400 mb-4">
                Hỗ trợ file biểu mẫu của Cổng đào tạo UTC chứa các sheet: CNT04.101, IT1.243.102, IT1.659.103...
              </p>

              <form onSubmit={handleImportExcel} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Chọn Đợt đào tạo áp dụng</label>
                  <select
                    value={selectedBatchId || ''}
                    onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_name} ({b.batch_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Chọn file Excel (.xlsx)</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    required
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                  />
                </div>

                {importResult && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <p className="font-bold text-emerald-400">Kết quả Import:</p>
                    <p className="text-slate-300">Tổng sinh viên đọc: {importResult.total}</p>
                    <p className="text-emerald-400">Đã tạo mới: {importResult.created}</p>
                    <p className="text-blue-400">Đã cập nhật: {importResult.updated}</p>
                    {importResult.skipped > 0 && <p className="text-amber-400">Bỏ qua / Lỗi: {importResult.skipped}</p>}
                    {importResult.errors?.length > 0 && (
                      <div className="mt-2 text-rose-400 max-h-24 overflow-y-auto">
                        {importResult.errors.map((err: string, i: number) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResult(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={importing}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50 flex items-center gap-2"
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

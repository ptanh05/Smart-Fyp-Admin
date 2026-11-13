import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import BatchProgressBar, { type BatchProgressData } from './BatchProgressBar';

interface SelectedBatchProgressProps {
  batchId: number | null;
}

/**
 * Hiển thị tiến trình của đúng đợt đang được chọn.
 * Component này nằm trong phần chi tiết đợt, không render toàn cục ở AdminLayout.
 */
export const SelectedBatchProgress: React.FC<SelectedBatchProgressProps> = ({ batchId }) => {
  const [progress, setProgress] = useState<BatchProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedBatchRef = useRef<number | null>(batchId);

  selectedBatchRef.current = batchId;

  const fetchProgress = useCallback(async () => {
    if (!batchId) {
      setProgress(null);
      setLoading(false);
      return;
    }

    const requestedBatchId = batchId;
    setProgress(null);
    setLoading(true);

    try {
      const response = await apiClient.get(`/admin/batches/${requestedBatchId}/progress/`);

      // Không cho request của đợt cũ ghi đè khi người dùng đổi đợt liên tục.
      if (selectedBatchRef.current === requestedBatchId) {
        setProgress(response.data);
      }
    } catch (error) {
      if (selectedBatchRef.current === requestedBatchId) {
        console.error(`Failed to load progress for batch ${requestedBatchId}:`, error);
        setProgress(null);
      }
    } finally {
      if (selectedBatchRef.current === requestedBatchId) {
        setLoading(false);
      }
    }
  }, [batchId]);

  useEffect(() => {
    void fetchProgress();
    const timer = window.setInterval(() => void fetchProgress(), 60000);
    return () => window.clearInterval(timer);
  }, [fetchProgress]);

  if (!batchId) return null;

  return (
    <BatchProgressBar
      data={progress}
      loading={loading}
      variant="admin"
      onRefresh={fetchProgress}
      title="Tiến Trình Đợt Đồ Án Đang Chọn"
    />
  );
};

export default SelectedBatchProgress;

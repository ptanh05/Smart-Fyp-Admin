import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import BatchProgressBar, { type BatchProgressData } from './BatchProgressBar';

interface SelectedBatchProgressProps {
  batchId: number | null;
  title?: string;
}

/**
 * Hiển thị tiến trình của đúng đợt đang được chọn.
 * Component được đặt ở đầu trang quản lý và luôn nhận ID đợt người dùng đang theo dõi.
 */
export const SelectedBatchProgress: React.FC<SelectedBatchProgressProps> = ({
  batchId,
  title = 'Tiến Trình Đợt Đồ Án Đang Theo Dõi',
}) => {
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
    const timer = window.setInterval(() => void fetchProgress(), 15000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchProgress();
    };

    window.addEventListener('focus', fetchProgress);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', fetchProgress);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchProgress]);

  if (!batchId) return null;

  return (
    <BatchProgressBar
      data={progress}
      loading={loading}
      variant="admin"
      onRefresh={fetchProgress}
      title={title}
    />
  );
};

export default SelectedBatchProgress;

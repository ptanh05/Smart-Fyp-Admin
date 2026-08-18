import React from 'react';
import './SkeletonLoader.css';

export const Skeleton: React.FC<{ width?: string; height?: string; borderRadius?: string }> = ({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
}) => <div className="skeleton" style={{ width, height, borderRadius }} />;

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => (
  <table className="skeleton-table">
    <thead>
      <tr>
        {Array.from({ length: columns }).map((_, i) => (
          <th key={i}><Skeleton height="24px" /></th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c}><Skeleton height="20px" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

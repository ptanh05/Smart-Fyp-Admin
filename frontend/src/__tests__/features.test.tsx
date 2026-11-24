import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock the API module so tests never hit the real network
// ---------------------------------------------------------------------------
vi.mock('../api/features', () => ({
  featuresApi: {
    getFacultyAnalytics: vi.fn(),
    getScoreDiscrepancy: vi.fn(),
    listRubrics: vi.fn(),
    listArchive: vi.fn(),
    getRetentionPreview: vi.fn(),
    getFeatureAuditLogs: vi.fn(),
    createRubric: vi.fn(),
    updateRubric: vi.fn(),
    deleteRubric: vi.fn(),
    activateRubric: vi.fn(),
  },
}));

// AdminAuthContext mock so layout renders without real auth
vi.mock('../auth/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    currentUser: { username: 'admin', full_name: 'Test Admin' },
    userType: 'admin',
    logout: vi.fn(),
  }),
  AdminAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { featuresApi } from '../api/features';
import { FacultyAnalyticsPage } from '../pages/FacultyAnalytics/FacultyAnalyticsPage';
import { RubricManagementPage } from '../pages/RubricManagement/RubricManagementPage';
import { ThesisArchivePage } from '../pages/ThesisArchive/ThesisArchivePage';
import { DataRetentionPage } from '../pages/DataRetention/DataRetentionPage';
import { FeatureAuditLogsPage } from '../pages/FeatureAuditLogs/FeatureAuditLogsPage';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

// ---------------------------------------------------------------------------
// FacultyAnalyticsPage
// ---------------------------------------------------------------------------
describe('FacultyAnalyticsPage', () => {
  const mockAnalytics = {
    batch_id: null,
    total_projects: 42,
    status_counts: { PASSED: 30, FAILED: 5, IN_PROGRESS: 7 },
    pass_rate: 85.7,
    average_final_score: 7.4,
    score_distribution: Array.from({ length: 10 }, (_, i) => ({ range: `${i}-${i + 1}`, count: i * 2 })),
    supervisor_load: [
      { supervisor_id: 1, name: 'Nguyen Van A', academic_title: 'ThS', department: 'CNPM', assigned: 5, quota: 6 },
    ],
    tasks: { total: 100, overdue: 10, late_submissions: 5, late_rate: 5.0 },
    deferrals: { PENDING: 2 },
    available_batches: [{ id: 1, batch_code: 'K63', batch_name: 'K63 2026' }],
    generated_at: new Date().toISOString(),
  };
  const mockDiscrepancy = { count: 0, threshold: 2.0, results: [] };

  beforeEach(() => {
    vi.mocked(featuresApi.getFacultyAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(featuresApi.getScoreDiscrepancy).mockResolvedValue(mockDiscrepancy);
  });

  it('renders heading', () => {
    renderWithRouter(<FacultyAnalyticsPage />);
    expect(screen.getByText(/Phân Tích Giảng Viên/i)).toBeInTheDocument();
  });

  it('shows KPI tiles after load', async () => {
    renderWithRouter(<FacultyAnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByText('85.7%')).toBeInTheDocument();
    expect(screen.getByText('7.4')).toBeInTheDocument();
  });

  it('shows supervisor load table', async () => {
    renderWithRouter(<FacultyAnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    });
  });

  it('shows no-discrepancy message when section expanded', async () => {
    renderWithRouter(<FacultyAnalyticsPage />);
    await waitFor(() => expect(screen.getByText(/Phát hiện lệch điểm \(/i)).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// RubricManagementPage
// ---------------------------------------------------------------------------
describe('RubricManagementPage', () => {
  const mockRubrics = [
    {
      id: 1,
      name: 'GVHD Rubric',
      evaluator_role: 'SUPERVISOR' as const,
      is_active: true,
      has_scores: false,
      total_max: 10,
      criteria: [{ id: 1, rubric: 1, name: 'C1', max_score: 10, order: 0 }],
    },
    {
      id: 2,
      name: 'Old Rubric',
      evaluator_role: 'COUNCIL' as const,
      is_active: false,
      has_scores: true,
      total_max: 10,
      criteria: [],
    },
  ];

  beforeEach(() => {
    vi.mocked(featuresApi.listRubrics).mockResolvedValue(mockRubrics);
  });

  it('renders heading', () => {
    renderWithRouter(<RubricManagementPage />);
    expect(screen.getByRole('heading', { name: /Quản Lý Rubric/i })).toBeInTheDocument();
  });

  it('displays rubrics after load', async () => {
    renderWithRouter(<RubricManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('GVHD Rubric')).toBeInTheDocument();
      expect(screen.getByText('Old Rubric')).toBeInTheDocument();
    });
  });

  it('shows active/inactive badges', async () => {
    renderWithRouter(<RubricManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('Hoạt động')).toBeInTheDocument();
      expect(screen.getByText('Vô hiệu hóa')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// ThesisArchivePage
// ---------------------------------------------------------------------------
describe('ThesisArchivePage', () => {
  const mockArchive = {
    count: 2,
    page: 1,
    page_size: 20,
    results: [
      {
        id: 1,
        project: 10,
        title: 'He thong quan ly do an',
        student_code: 'SV001',
        batch_code: 'K63',
        visibility: 'PUBLIC' as const,
        embargo_until: null,
        embargo_reason: '',
        abstract: '',
        keywords: 'AI, ML',
        final_version: null,
        final_version_info: null,
        license: 'All rights reserved',
        final_score: 8.5,
        archived_by: 1,
        archived_at: '2026-01-01T00:00:00Z',
        is_embargoed: false,
      },
      {
        id: 2,
        project: 11,
        title: 'Bi mat de tai',
        student_code: 'SV002',
        batch_code: 'K63',
        visibility: 'EMBARGOED' as const,
        embargo_until: '2027-01-01',
        embargo_reason: 'Bi mat DN',
        abstract: '',
        keywords: '',
        final_version: null,
        final_version_info: null,
        license: 'All rights reserved',
        final_score: 9.0,
        archived_by: 1,
        archived_at: '2026-01-01T00:00:00Z',
        is_embargoed: true,
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(featuresApi.listArchive).mockResolvedValue(mockArchive);
  });

  it('renders heading', () => {
    renderWithRouter(<ThesisArchivePage />);
    expect(screen.getByRole('heading', { name: /Kho Lưu Trữ Đồ Án/i })).toBeInTheDocument();
  });

  it('displays archive results', async () => {
    renderWithRouter(<ThesisArchivePage />);
    await waitFor(() => {
      expect(screen.getByText('He thong quan ly do an')).toBeInTheDocument();
      expect(screen.getByText('Bi mat de tai')).toBeInTheDocument();
    });
  });

  it('shows embargoed badge', async () => {
    renderWithRouter(<ThesisArchivePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Embargo/i).length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// DataRetentionPage
// ---------------------------------------------------------------------------
describe('DataRetentionPage', () => {
  const mockPreview = {
    years: 5,
    cutoff: '2021-01-01',
    batches: [{ id: 1, batch_code: 'K58', batch_name: 'K58 2020', end_date: '2021-01-01' }],
    counts: {
      batches: 1,
      projects_in_scope: 50,
      deferral_evidence_files: 10,
      weekly_report_files: 20,
      task_deliverable_files: 15,
      submission_versions: 5,
      internship_info: 50,
      student_preferences: 50,
    },
  };

  beforeEach(() => {
    vi.mocked(featuresApi.getRetentionPreview).mockResolvedValue(mockPreview);
  });

  it('renders heading', () => {
    renderWithRouter(<DataRetentionPage />);
    expect(screen.getByText(/Chính Sách Lưu Giữ Dữ Liệu/i)).toBeInTheDocument();
  });

  it('shows preview counts', async () => {
    renderWithRouter(<DataRetentionPage />);
    await waitFor(() => {
      expect(screen.getAllByText('50').length).toBeGreaterThan(0); // projects_in_scope
    });
  });

  it('shows confirm panel when data exists', async () => {
    renderWithRouter(<DataRetentionPage />);
    await waitFor(() => {
      expect(screen.getByText(/Áp dụng chính sách/i)).toBeInTheDocument();
    });
  });

  it('shows eligible batch', async () => {
    renderWithRouter(<DataRetentionPage />);
    await waitFor(() => {
      expect(screen.getByText('K58')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// FeatureAuditLogsPage
// ---------------------------------------------------------------------------
describe('FeatureAuditLogsPage', () => {
  const mockLogs = {
    count: 2,
    page: 1,
    page_size: 30,
    action_types: ['admin_rubric_create', 'admin_archive_embargo_set'],
    results: [
      {
        id: 1,
        user: 1,
        user_name: 'admin',
        action_type: 'admin_rubric_create',
        description: 'Created rubric X',
        field_name: null,
        old_value: null,
        new_value: '5',
        evaluation_type: null,
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        user: 1,
        user_name: 'admin',
        action_type: 'admin_archive_embargo_set',
        description: 'Set embargo on archive #3',
        field_name: 'visibility',
        old_value: 'PUBLIC',
        new_value: 'EMBARGOED',
        evaluation_type: null,
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(featuresApi.getFeatureAuditLogs).mockResolvedValue(mockLogs);
  });

  it('renders heading', () => {
    renderWithRouter(<FeatureAuditLogsPage />);
    expect(screen.getByText(/Nhật Ký Hành Động Quản Trị/i)).toBeInTheDocument();
  });

  it('shows audit log entries', async () => {
    renderWithRouter(<FeatureAuditLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('Created rubric X')).toBeInTheDocument();
      expect(screen.getByText('Set embargo on archive #3')).toBeInTheDocument();
    });
  });

  it('shows action type badge', async () => {
    renderWithRouter(<FeatureAuditLogsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Tạo rubric').length).toBeGreaterThan(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DatabaseSettingsPage from '@/pages/datavault/DatabaseSettingsPage';
import type { DatavaultDatabase } from '@/lib/types/datavault';

/**
 * DataVault Phase 2 PR 13: Database Settings Page Tests
 */

// Mock wouter hooks
vi.mock('wouter', () => ({
  useParams: vi.fn(() => ({ databaseId: 'db-1' })),
  useLocation: vi.fn(() => ['/datavault/databases/db-1/settings', vi.fn()]),
}));

// Mock datavault hooks
const mockDatabase: DatavaultDatabase = {
  id: 'db-1',
  tenantId: 'tenant-1',
  name: 'Test Database',
  description: 'Test database description',
  scopeType: 'account',
  scopeId: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  tableCount: 5,
};

vi.mock('@/lib/datavault-hooks', () => ({
  useDatavaultDatabase: vi.fn(() => ({
    data: mockDatabase,
    isLoading: false,
  })),
  useUpdateDatavaultDatabase: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

// Mock layout components
vi.mock('@/components/layout/Header', () => ({
  default: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

vi.mock('@/components/layout/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('DatabaseSettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DatabaseSettingsPage />
      </QueryClientProvider>
    );
  };

  it('should render database settings page with breadcrumbs', () => {
    renderPage();

    expect(screen.getByText('Database Settings')).toBeInTheDocument();
    expect(screen.getByText('Test Database')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { useDatavaultDatabase } = require('@/lib/datavault-hooks');
    useDatavaultDatabase.mockReturnValue({
      data: null,
      isLoading: true,
    });

    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show not found state when database does not exist', () => {
    const { useDatavaultDatabase } = require('@/lib/datavault-hooks');
    useDatavaultDatabase.mockReturnValue({
      data: null,
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Database not found')).toBeInTheDocument();
    expect(screen.getByText('Back to Databases')).toBeInTheDocument();
  });

  it('should render DatabaseSettings component with database data', () => {
    renderPage();

    // Check that the DatabaseSettings component is rendered
    // by checking for elements that should be in it
    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Scope Settings')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
  });

  it('should navigate back when back button is clicked', () => {
    const mockSetLocation = vi.fn();
    const { useLocation } = require('wouter');
    useLocation.mockReturnValue(['/datavault/databases/db-1/settings', mockSetLocation]);

    renderPage();

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(mockSetLocation).toHaveBeenCalledWith('/datavault/databases/db-1');
  });

  it('should display database name in header', () => {
    renderPage();

    // Check for database name in the header section
    const nameElements = screen.getAllByText('Test Database');
    expect(nameElements.length).toBeGreaterThan(0);
  });

  it('should render sidebar', () => {
    renderPage();

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });
});

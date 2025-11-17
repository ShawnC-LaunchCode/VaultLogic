/**
 * DataVault API client
 * API functions for DataVault Phase 1
 */

import { apiRequest } from "./queryClient";
import type { DatavaultTable, DatavaultColumn, DatavaultRow } from "@shared/schema";

export interface ApiDatavaultTableWithStats extends DatavaultTable {
  columnCount: number;
  rowCount: number;
}

export interface ApiDatavaultRowWithValues {
  row: DatavaultRow;
  values: Record<string, any>; // columnId -> value
}

export const datavaultAPI = {
  // Tables
  listTables: async (withStats = false): Promise<ApiDatavaultTableWithStats[]> => {
    return apiRequest('GET', `/api/datavault/tables?stats=${withStats}`);
  },

  getTable: async (tableId: string, withColumns = false): Promise<DatavaultTable> => {
    return apiRequest('GET', `/api/datavault/tables/${tableId}?columns=${withColumns}`);
  },

  createTable: async (data: {
    name: string;
    slug?: string;
    description?: string;
  }): Promise<DatavaultTable> => {
    return apiRequest('POST', '/api/datavault/tables', data);
  },

  updateTable: async (
    tableId: string,
    data: Partial<{ name: string; slug: string; description: string }>
  ): Promise<DatavaultTable> => {
    return apiRequest('PATCH', `/api/datavault/tables/${tableId}`, data);
  },

  deleteTable: async (tableId: string): Promise<void> => {
    return apiRequest('DELETE', `/api/datavault/tables/${tableId}`);
  },

  // Columns
  listColumns: async (tableId: string): Promise<DatavaultColumn[]> => {
    return apiRequest('GET', `/api/datavault/tables/${tableId}/columns`);
  },

  createColumn: async (
    tableId: string,
    data: {
      name: string;
      type: string;
      slug?: string;
      required?: boolean;
      orderIndex?: number;
    }
  ): Promise<DatavaultColumn> => {
    return apiRequest('POST', `/api/datavault/tables/${tableId}/columns`, data);
  },

  updateColumn: async (
    columnId: string,
    data: Partial<{ name: string; slug: string; required: boolean; orderIndex: number }>
  ): Promise<DatavaultColumn> => {
    return apiRequest('PATCH', `/api/datavault/columns/${columnId}`, data);
  },

  deleteColumn: async (columnId: string): Promise<void> => {
    return apiRequest('DELETE', `/api/datavault/columns/${columnId}`);
  },

  reorderColumns: async (tableId: string, columnIds: string[]): Promise<void> => {
    return apiRequest('POST', `/api/datavault/tables/${tableId}/columns/reorder`, { columnIds });
  },

  // Rows
  listRows: async (
    tableId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    rows: ApiDatavaultRowWithValues[];
    pagination: { limit: number; offset: number; total: number; hasMore: boolean };
  }> => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    return apiRequest('GET', `/api/datavault/tables/${tableId}/rows?${params.toString()}`);
  },

  getRow: async (rowId: string): Promise<ApiDatavaultRowWithValues> => {
    return apiRequest('GET', `/api/datavault/rows/${rowId}`);
  },

  createRow: async (
    tableId: string,
    values: Record<string, any>
  ): Promise<ApiDatavaultRowWithValues> => {
    return apiRequest('POST', `/api/datavault/tables/${tableId}/rows`, { values });
  },

  updateRow: async (rowId: string, values: Record<string, any>): Promise<void> => {
    return apiRequest('PATCH', `/api/datavault/rows/${rowId}`, { values });
  },

  deleteRow: async (rowId: string): Promise<void> => {
    return apiRequest('DELETE', `/api/datavault/rows/${rowId}`);
  },
};

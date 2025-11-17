/**
 * TanStack Query hooks for DataVault API
 * DataVault Phase 1 hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datavaultAPI } from "./datavault-api";

// ============================================================================
// Query Keys
// ============================================================================

export const datavaultQueryKeys = {
  tables: ["datavault", "tables"] as const,
  table: (id: string) => ["datavault", "tables", id] as const,
  tableColumns: (tableId: string) => ["datavault", "tables", tableId, "columns"] as const,
  tableRows: (tableId: string) => ["datavault", "tables", tableId, "rows"] as const,
  row: (id: string) => ["datavault", "rows", id] as const,
};

// ============================================================================
// Tables
// ============================================================================

export function useDatavaultTables(withStats = false) {
  return useQuery({
    queryKey: [...datavaultQueryKeys.tables, withStats],
    queryFn: () => datavaultAPI.listTables(withStats),
  });
}

export function useDatavaultTable(tableId: string | undefined, withColumns = false) {
  return useQuery({
    queryKey: datavaultQueryKeys.table(tableId!),
    queryFn: () => datavaultAPI.getTable(tableId!, withColumns),
    enabled: !!tableId,
  });
}

export function useCreateDatavaultTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datavaultAPI.createTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
    },
  });
}

export function useUpdateDatavaultTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, ...data }: { tableId: string } & Parameters<typeof datavaultAPI.updateTable>[1]) =>
      datavaultAPI.updateTable(tableId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.table(variables.tableId) });
    },
  });
}

export function useDeleteDatavaultTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datavaultAPI.deleteTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
    },
  });
}

// ============================================================================
// Columns
// ============================================================================

export function useDatavaultColumns(tableId: string | undefined) {
  return useQuery({
    queryKey: datavaultQueryKeys.tableColumns(tableId!),
    queryFn: () => datavaultAPI.listColumns(tableId!),
    enabled: !!tableId,
  });
}

export function useCreateDatavaultColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, ...data }: { tableId: string } & Parameters<typeof datavaultAPI.createColumn>[1]) =>
      datavaultAPI.createColumn(tableId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tableColumns(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.table(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
    },
  });
}

export function useUpdateDatavaultColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, tableId, ...data }: { columnId: string; tableId: string } & Parameters<typeof datavaultAPI.updateColumn>[1]) =>
      datavaultAPI.updateColumn(columnId, data),
    onSuccess: (_, variables) => {
      if (variables.tableId) {
        queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tableColumns(variables.tableId) });
      }
    },
  });
}

export function useDeleteDatavaultColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, tableId }: { columnId: string; tableId: string }) =>
      datavaultAPI.deleteColumn(columnId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tableColumns(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
    },
  });
}

// ============================================================================
// Rows
// ============================================================================

export function useDatavaultRows(tableId: string | undefined, options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...datavaultQueryKeys.tableRows(tableId!), options],
    queryFn: () => datavaultAPI.listRows(tableId!, options),
    enabled: !!tableId,
  });
}

export function useDatavaultRow(rowId: string | undefined) {
  return useQuery({
    queryKey: datavaultQueryKeys.row(rowId!),
    queryFn: () => datavaultAPI.getRow(rowId!),
    enabled: !!rowId,
  });
}

export function useCreateDatavaultRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, values }: { tableId: string; values: Record<string, any> }) =>
      datavaultAPI.createRow(tableId, values),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tableRows(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
    },
  });
}

export function useUpdateDatavaultRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, tableId, values }: { rowId: string; tableId: string; values: Record<string, any> }) =>
      datavaultAPI.updateRow(rowId, values),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.row(variables.rowId) });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tableRows(variables.tableId) });
    },
  });
}

export function useDeleteDatavaultRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, tableId }: { rowId: string; tableId: string }) =>
      datavaultAPI.deleteRow(rowId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tableRows(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: datavaultQueryKeys.tables });
    },
  });
}

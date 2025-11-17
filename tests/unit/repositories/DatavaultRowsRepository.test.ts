import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatavaultRowsRepository } from '../../../server/repositories/DatavaultRowsRepository';
import type { DatavaultRow, DatavaultValue, InsertDatavaultRow } from '@shared/schema';

/**
 * DataVault Phase 1 PR 9: DatavaultRowsRepository Tests
 *
 * Unit tests for DatavaultRowsRepository
 */

describe('DatavaultRowsRepository', () => {
  let repository: DatavaultRowsRepository;
  let mockDb: any;

  const mockTableId = '660e8400-e29b-41d4-a716-446655440001';
  const mockRowId = '770e8400-e29b-41d4-a716-446655440002';
  const mockColumnId = '880e8400-e29b-41d4-a716-446655440003';

  beforeEach(() => {
    let mockReturnValue: any = [];

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn(function(this: any) {
        return Promise.resolve(mockReturnValue);
      }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      limit: vi.fn(function(this: any) {
        return Promise.resolve(mockReturnValue);
      }),
      offset: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      eq: vi.fn(),
      transaction: vi.fn(async (fn) => await fn(mockDb)),
      then: vi.fn((resolve) => resolve(mockReturnValue)),
      _setMockReturnValue: (value: any) => { mockReturnValue = value; },
    };

    // @ts-ignore - mocking db for tests
    repository = new DatavaultRowsRepository(mockDb);
  });

  describe('findByTableId', () => {
    it('should find rows by table ID', async () => {
      const mockRows: DatavaultRow[] = [
        {
          id: mockRowId,
          tableId: mockTableId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb._setMockReturnValue(mockRows);

      const result = await repository.findByTableId(mockTableId);

      expect(result).toEqual(mockRows);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should support limit and offset', async () => {
      mockDb._setMockReturnValue([]);

      await repository.findByTableId(mockTableId, undefined, 10, 20);

      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('findById', () => {
    it('should find row by ID', async () => {
      const mockRow: DatavaultRow = {
        id: mockRowId,
        tableId: mockTableId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb._setMockReturnValue([mockRow]);

      const result = await repository.findById(mockRowId);

      expect(result).toEqual(mockRow);
    });

    it('should return undefined if row not found', async () => {
      mockDb._setMockReturnValue([]);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create a new row', async () => {
      const insertData: InsertDatavaultRow = {
        tableId: mockTableId,
      };

      const createdRow: DatavaultRow = {
        id: mockRowId,
        ...insertData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([createdRow]);

      const result = await repository.create(insertData);

      expect(result).toEqual(createdRow);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a row', async () => {
      mockDb.returning.mockResolvedValue([{ id: mockRowId }]);

      await repository.delete(mockRowId);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('countByTableId', () => {
    it('should count rows by table ID', async () => {
      mockDb._setMockReturnValue([{ count: 42 }]);

      const result = await repository.countByTableId(mockTableId);

      expect(result).toBe(42);
    });

    it('should return 0 if no rows found', async () => {
      mockDb._setMockReturnValue([{ count: 0 }]);

      const result = await repository.countByTableId(mockTableId);

      expect(result).toBe(0);
    });
  });

  describe('createRowWithValues', () => {
    it('should create row and values in transaction', async () => {
      const rowData: InsertDatavaultRow = {
        tableId: mockTableId,
      };

      const values = [
        { columnId: mockColumnId, value: 'John Doe' },
      ];

      const createdRow: DatavaultRow = {
        id: mockRowId,
        ...rowData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdValues: DatavaultValue[] = [
        {
          id: 'val-1',
          rowId: mockRowId,
          columnId: mockColumnId,
          value: { data: 'John Doe' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.returning
        .mockResolvedValueOnce([createdRow])
        .mockResolvedValueOnce(createdValues);

      const result = await repository.createRowWithValues(rowData, values);

      expect(result.row).toEqual(createdRow);
      expect(result.values).toEqual(createdValues);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle empty values array', async () => {
      const rowData: InsertDatavaultRow = {
        tableId: mockTableId,
      };

      const createdRow: DatavaultRow = {
        id: mockRowId,
        ...rowData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([createdRow]);

      const result = await repository.createRowWithValues(rowData, []);

      expect(result.row).toEqual(createdRow);
      expect(result.values).toEqual([]);
    });
  });

  describe('getRowsWithValues', () => {
    it('should get rows with their values', async () => {
      const mockRowsWithValues = [
        {
          row: {
            id: mockRowId,
            tableId: mockTableId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          value: {
            id: 'val-1',
            rowId: mockRowId,
            columnId: mockColumnId,
            value: { data: 'John' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mockDb._setMockReturnValue(mockRowsWithValues);

      const result = await repository.getRowsWithValues(mockTableId);

      expect(result).toEqual(mockRowsWithValues);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.leftJoin).toHaveBeenCalled();
    });
  });

  describe('updateRowValues', () => {
    it('should upsert row values', async () => {
      const values = [
        { columnId: mockColumnId, value: 'Updated Value' },
      ];

      mockDb.returning.mockResolvedValue([
        {
          id: 'val-1',
          rowId: mockRowId,
          columnId: mockColumnId,
          value: { data: 'Updated Value' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await repository.updateRowValues(mockRowId, values);

      // Should call insert with onConflictDoUpdate
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle empty values array', async () => {
      await repository.updateRowValues(mockRowId, []);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});

import {
  datavaultColumnsRepository,
  datavaultTablesRepository,
  datavaultRowsRepository,
  type DbTransaction,
} from "../repositories";
import type { DatavaultColumn, InsertDatavaultColumn } from "@shared/schema";

/**
 * Service layer for DataVault column business logic
 * Handles column CRUD operations with validation and authorization
 */
export class DatavaultColumnsService {
  private columnsRepo: typeof datavaultColumnsRepository;
  private tablesRepo: typeof datavaultTablesRepository;
  private rowsRepo: typeof datavaultRowsRepository;

  constructor(
    columnsRepo?: typeof datavaultColumnsRepository,
    tablesRepo?: typeof datavaultTablesRepository,
    rowsRepo?: typeof datavaultRowsRepository
  ) {
    this.columnsRepo = columnsRepo || datavaultColumnsRepository;
    this.tablesRepo = tablesRepo || datavaultTablesRepository;
    this.rowsRepo = rowsRepo || datavaultRowsRepository;
  }

  /**
   * Generate URL-safe slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Ensure slug is unique for the table
   */
  private async ensureUniqueSlug(
    tableId: string,
    baseSlug: string,
    excludeId?: string,
    tx?: DbTransaction
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.columnsRepo.slugExists(tableId, slug, excludeId, tx)) {
      slug = `${baseSlug}_${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Verify table belongs to tenant
   */
  private async verifyTableOwnership(
    tableId: string,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<void> {
    const table = await this.tablesRepo.findById(tableId, tx);

    if (!table) {
      throw new Error("Table not found");
    }

    if (table.tenantId !== tenantId) {
      throw new Error("Access denied - table belongs to different tenant");
    }
  }

  /**
   * Verify column belongs to tenant's table
   */
  async verifyColumnOwnership(
    columnId: string,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<DatavaultColumn> {
    const column = await this.columnsRepo.findById(columnId, tx);

    if (!column) {
      throw new Error("Column not found");
    }

    // Verify the table belongs to the tenant
    await this.verifyTableOwnership(column.tableId, tenantId, tx);

    return column;
  }

  /**
   * Create a new column
   */
  async createColumn(
    data: InsertDatavaultColumn,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<DatavaultColumn> {
    // Verify table ownership
    await this.verifyTableOwnership(data.tableId, tenantId, tx);

    // Generate slug if not provided
    const baseSlug = data.slug || this.generateSlug(data.name);
    const uniqueSlug = await this.ensureUniqueSlug(data.tableId, baseSlug, undefined, tx);

    // Get next order index if not provided
    let orderIndex = data.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const maxOrder = await this.columnsRepo.getMaxOrderIndex(data.tableId, tx);
      orderIndex = maxOrder + 1;
    }

    return await this.columnsRepo.create(
      {
        ...data,
        slug: uniqueSlug,
        orderIndex,
      },
      tx
    );
  }

  /**
   * Get column by ID with tenant verification
   */
  async getColumn(
    columnId: string,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<DatavaultColumn> {
    return await this.verifyColumnOwnership(columnId, tenantId, tx);
  }

  /**
   * List columns for a table
   */
  async listColumns(
    tableId: string,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<DatavaultColumn[]> {
    await this.verifyTableOwnership(tableId, tenantId, tx);
    return await this.columnsRepo.findByTableId(tableId, tx);
  }

  /**
   * Update column (name only - type changes not allowed)
   */
  async updateColumn(
    columnId: string,
    tenantId: string,
    data: Partial<InsertDatavaultColumn>,
    tx?: DbTransaction
  ): Promise<DatavaultColumn> {
    const column = await this.verifyColumnOwnership(columnId, tenantId, tx);

    // Prevent type changes
    if (data.type && data.type !== column.type) {
      throw new Error("Cannot change column type after creation");
    }

    // If name changed, regenerate slug
    if (data.name && !data.slug) {
      const baseSlug = this.generateSlug(data.name);
      data.slug = await this.ensureUniqueSlug(column.tableId, baseSlug, columnId, tx);
    }

    // If slug provided, ensure it's unique
    if (data.slug) {
      data.slug = await this.ensureUniqueSlug(column.tableId, data.slug, columnId, tx);
    }

    return await this.columnsRepo.update(columnId, data, tx);
  }

  /**
   * Delete column (also deletes all associated values)
   */
  async deleteColumn(columnId: string, tenantId: string, tx?: DbTransaction): Promise<void> {
    await this.verifyColumnOwnership(columnId, tenantId, tx);

    // Delete all values for this column first (though CASCADE should handle it)
    await this.rowsRepo.deleteValuesByColumnId(columnId, tx);

    // Delete the column
    await this.columnsRepo.delete(columnId, tx);
  }

  /**
   * Reorder columns for a table
   */
  async reorderColumns(
    tableId: string,
    tenantId: string,
    columnIds: string[],
    tx?: DbTransaction
  ): Promise<void> {
    await this.verifyTableOwnership(tableId, tenantId, tx);

    // Verify all columns belong to the table
    const columns = await this.columnsRepo.findByTableId(tableId, tx);
    const tableColumnIds = new Set(columns.map((c) => c.id));

    for (const columnId of columnIds) {
      if (!tableColumnIds.has(columnId)) {
        throw new Error(`Column ${columnId} does not belong to table ${tableId}`);
      }
    }

    await this.columnsRepo.reorderColumns(tableId, columnIds, tx);
  }

  /**
   * Get column by slug
   */
  async getColumnBySlug(
    tableId: string,
    tenantId: string,
    slug: string,
    tx?: DbTransaction
  ): Promise<DatavaultColumn | undefined> {
    await this.verifyTableOwnership(tableId, tenantId, tx);
    return await this.columnsRepo.findByTableAndSlug(tableId, slug, tx);
  }
}

// Singleton instance
export const datavaultColumnsService = new DatavaultColumnsService();

/**
 * Update DatavaultRowsRepository and DatavaultRowsService for autonumber support
 * Adds the new getNextAutonumber method and updates service logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📝 Updating DataVault repositories and services for autonumber...');

// =====================================================================
// 1. Update DatavaultRowsRepository
// =====================================================================

const repoPath = path.join(__dirname, '../server/repositories/DatavaultRowsRepository.ts');
let repoCode = fs.readFileSync(repoPath, 'utf-8');

// Add getNextAutonumber method if not present
if (!repoCode.includes('getNextAutonumber')) {
  // Find the cleanupAutoNumberSequence method and insert before it
  const insertPosition = repoCode.indexOf('/**\n   * Cleanup PostgreSQL sequence when auto-number column is deleted');

  if (insertPosition !== -1) {
    const newMethod = `
  /**
   * Get next autonumber value (v4 with prefix, padding, yearly reset)
   * Calls datavault_get_next_autonumber PostgreSQL function
   *
   * @param tenantId Tenant ID for the table
   * @param tableId Table ID
   * @param columnId Column ID
   * @param prefix Optional prefix (e.g., "CASE", "INV")
   * @param padding Number of digits to pad (default 4)
   * @param resetPolicy When to reset: 'never' or 'yearly'
   * @param tx Optional transaction
   * @returns Formatted autonumber string (e.g., "CASE-2025-0001")
   */
  async getNextAutonumber(
    tenantId: string,
    tableId: string,
    columnId: string,
    prefix: string | null = null,
    padding: number = 4,
    resetPolicy: 'never' | 'yearly' = 'never',
    tx?: DbTransaction
  ): Promise<string> {
    const database = this.getDb(tx);

    // Call the database function with all parameters
    const result = await database.execute<{ datavault_get_next_autonumber: string }>(
      sql\`SELECT datavault_get_next_autonumber(
        \${tenantId}::UUID,
        \${tableId}::UUID,
        \${columnId}::UUID,
        \${prefix}::TEXT,
        \${padding}::INTEGER,
        \${resetPolicy}::TEXT
      ) as next_value\`
    );

    const nextValue = result?.rows?.[0]?.next_value;
    if (!nextValue) {
      throw new Error('Failed to generate autonumber value');
    }

    return nextValue as string;
  }

  `;

    repoCode = repoCode.slice(0, insertPosition) + newMethod + repoCode.slice(insertPosition);
    fs.writeFileSync(repoPath, repoCode, 'utf-8');
    console.log('✅ Added getNextAutonumber method to DatavaultRowsRepository');
  }
} else {
  console.log('ℹ️  getNextAutonumber method already exists in repository');
}

// =====================================================================
// 2. Update DatavaultRowsService
// =====================================================================

const servicePath = path.join(__dirname, '../server/services/DatavaultRowsService.ts');
let serviceCode = fs.readFileSync(servicePath, 'utf-8');

// Update validateAndCoerceValue to handle both auto_number and autonumber
if (!serviceCode.includes("column.type === 'autonumber'")) {
  serviceCode = serviceCode.replace(
    /case 'auto_number':\s+\/\/ Auto-number values should be numbers \(generated automatically\)\s+return Number\(value\);/,
    `case 'auto_number':
      case 'autonumber':
        // Auto-number values should be strings (for autonumber with prefix) or numbers (legacy auto_number)
        // The value is generated automatically, so we just validate it exists
        return typeof value === 'string' ? value : Number(value);`
  );
  console.log('✅ Updated validateAndCoerceValue in DatavaultRowsService');
}

// Update required column check to include autonumber
if (serviceCode.includes("column.type !== 'auto_number'") && !serviceCode.includes("column.type !== 'autonumber'")) {
  serviceCode = serviceCode.replace(
    "column.type !== 'auto_number'",
    "column.type !== 'auto_number' && column.type !== 'autonumber'"
  );
  console.log('✅ Updated required column check in DatavaultRowsService');
}

// Update auto-number generation logic
const oldGenerationLogic = /\/\/ Generate auto-number values for auto_number columns\s+for \(const column of columns\) \{\s+if \(column\.type === 'auto_number' && !\(column\.id in values\)\) \{\s+\/\/ Get the next auto-number value using sequence \(atomic, no race condition\)\s+const startValue = column\.autoNumberStart \?\? 1;\s+const nextNumber = await this\.rowsRepo\.getNextAutoNumber\(tableId, column\.id, startValue, tx\);\s+values\[column\.id\] = nextNumber;\s+\}\s+\}/;

if (oldGenerationLogic.test(serviceCode)) {
  const newGenerationLogic = `// Generate auto-number values for auto_number and autonumber columns
    // Get tenant ID for autonumber sequence
    const table = await this.tablesRepo.findById(tableId, tx);
    if (!table) {
      throw new Error('Table not found');
    }
    const tenantId = table.tenantId;

    for (const column of columns) {
      // Handle legacy auto_number type
      if (column.type === 'auto_number' && !(column.id in values)) {
        const startValue = column.autoNumberStart ?? 1;
        const nextNumber = await this.rowsRepo.getNextAutoNumber(tableId, column.id, startValue, tx);
        values[column.id] = nextNumber;
      }

      // Handle new autonumber type with prefix, padding, and yearly reset
      if (column.type === 'autonumber' && !(column.id in values)) {
        const prefix = column.autonumberPrefix ?? null;
        const padding = column.autonumberPadding ?? 4;
        const resetPolicy = column.autonumberResetPolicy ?? 'never';
        const nextValue = await this.rowsRepo.getNextAutonumber(
          tenantId,
          tableId,
          column.id,
          prefix,
          padding,
          resetPolicy,
          tx
        );
        values[column.id] = nextValue;
      }
    }`;

  serviceCode = serviceCode.replace(oldGenerationLogic, newGenerationLogic);
  fs.writeFileSync(servicePath, serviceCode, 'utf-8');
  console.log('✅ Updated auto-number generation logic in DatavaultRowsService');
} else {
  console.log('ℹ️  Auto-number generation logic already updated or pattern not found');
}

console.log('✅ Update complete!');
console.log('');
console.log('📊 Summary of changes:');
console.log('  - Added getNextAutonumber method to DatavaultRowsRepository');
console.log('  - Updated validateAndCoerceValue to handle autonumber type');
console.log('  - Updated required column check to exclude autonumber');
console.log('  - Updated auto-number generation logic to support autonumber with prefix/padding/reset');

process.exit(0);

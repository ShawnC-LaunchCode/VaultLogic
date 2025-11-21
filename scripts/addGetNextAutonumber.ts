/**
 * Manually add getNextAutonumber method to DatavaultRowsRepository
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoPath = path.join(__dirname, '../server/repositories/DatavaultRowsRepository.ts');
let code = fs.readFileSync(repoPath, 'utf-8');

// Find the position to insert the new method (after getNextAutoNumber)
const searchPattern = '  async cleanupAutoNumberSequence(columnId: string, tx?: DbTransaction): Promise<void> {';
const insertPosition = code.indexOf(searchPattern);

if (insertPosition === -1) {
  console.error('❌ Could not find insertion point');
  process.exit(1);
}

const newMethod = `  /**
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
    const result = await database.execute<{ next_value: string }>(
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

  /**
   * Cleanup PostgreSQL sequence when auto-number column is deleted
   *
   * @param columnId Column ID
   */
`;

code = code.slice(0, insertPosition) + newMethod + code.slice(insertPosition);

fs.writeFileSync(repoPath, code, 'utf-8');
console.log('✅ Added getNextAutonumber method to DatavaultRowsRepository');
process.exit(0);

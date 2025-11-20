import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function verifyMigration() {
  try {
    console.log('Verifying migration 0034 (reference columns)...\n');

    // Check if 'reference' type exists in enum
    const enumCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'reference'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'datavault_column_type')
      ) as exists
    `);

    const hasReferenceType = enumCheck.rows[0]?.exists;
    console.log(`✓ 'reference' enum value: ${hasReferenceType ? '✅ EXISTS' : '❌ MISSING'}`);

    // Check if columns exist
    const columnCheck = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'datavault_columns'
      AND column_name IN ('reference_table_id', 'reference_display_column_slug')
      ORDER BY column_name
    `);

    console.log('\nColumn checks:');
    const foundColumns = new Set(columnCheck.rows.map(r => r.column_name));

    if (foundColumns.has('reference_table_id')) {
      console.log('✓ reference_table_id: ✅ EXISTS (uuid, nullable)');
    } else {
      console.log('✓ reference_table_id: ❌ MISSING');
    }

    if (foundColumns.has('reference_display_column_slug')) {
      console.log('✓ reference_display_column_slug: ✅ EXISTS (text, nullable)');
    } else {
      console.log('✓ reference_display_column_slug: ❌ MISSING');
    }

    // Check if index exists
    const indexCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'datavault_columns'
        AND indexname = 'datavault_columns_reference_table_idx'
      ) as exists
    `);

    const hasIndex = indexCheck.rows[0]?.exists;
    console.log(`\n✓ Index (datavault_columns_reference_table_idx): ${hasIndex ? '✅ EXISTS' : '❌ MISSING'}`);

    // Summary
    const allGood = hasReferenceType && foundColumns.size === 2 && hasIndex;

    console.log('\n' + '='.repeat(50));
    if (allGood) {
      console.log('🎉 Migration 0034 applied successfully!');
      console.log('Ready to proceed with PR 12 (UI implementation)');
    } else {
      console.log('⚠️  Migration incomplete or not applied');
      console.log('Please run: npx drizzle-kit push');
    }
    console.log('='.repeat(50));

    process.exit(allGood ? 0 : 1);
  } catch (error) {
    console.error('Error verifying migration:', error);
    process.exit(1);
  }
}

verifyMigration();

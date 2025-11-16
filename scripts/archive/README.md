# Archived Scripts

This directory contains one-time migration, fix, and debug scripts that were used during VaultLogic development but are no longer actively needed.

**Archived on:** November 16, 2025

## Contents

### Database Check Scripts (14 files)
Scripts that verified database schema and table structure:
- `check*.ts` - Various table and schema verification scripts

### Database Fix Scripts (7 files)
Scripts that fixed database schema issues:
- `fix*.ts` - Column additions, orphaned record cleanup, etc.

### Migration Application Scripts (9 files)
Scripts that applied specific migrations:
- `apply*.ts` - Applied migrations 0009, 0011, 0024, 0025, 0026, etc.

### Migration Verification Scripts (3 files)
Scripts that verified migrations were applied correctly:
- `verify*.ts` - Verified migrations 0011, 0024, 0025

### Debug & Test Scripts (8 files)
One-time debugging and testing scripts:
- `debug*.ts` - Workflow debugging
- `test*.ts` - Project creation, SLI query, workflow query tests
- `add*.ts` - Column addition scripts

### Other (1 file)
- `runMigration0025Simple.ts` - Alternative migration runner

## Why Archived?

These scripts were created to handle specific migration or fix scenarios during development. They have served their purpose and are archived to:
1. Keep the main scripts directory clean and focused on actively used scripts
2. Preserve historical context for debugging if needed
3. Reduce confusion about which scripts are still relevant

## Active Scripts (Remaining in /scripts/)

The following scripts remain active in the main scripts directory:
- `computeSLIs.ts` - SLI computation (package.json: metrics:sli)
- `generateFakeData.ts` - Test data generation (package.json script)
- `migrateTransformBlockVirtualSteps.ts` - Transform block migration utility
- `runMetricsRollup.ts` - Metrics rollup job (package.json: metrics:rollup)
- `runMigrations.ts` - Database migration runner (package.json: db:migrate)
- `seed.ts` - Database seeding (package.json: db:seed)
- `setAdmin.ts` - Set admin user (package.json script)
- `slackNotifier.js` - Slack notification utility (package.json: slack:test)
- `testGeminiApi.ts` - Gemini API testing (package.json script)
- `testGeminiApiDirect.ts` - Direct Gemini API testing (package.json script)

## If You Need These Scripts

If you need to reference or use any of these archived scripts:
1. They can still be executed with `npx tsx scripts/archive/<script-name>.ts`
2. Consider whether the functionality should be moved to a permanent migration or service
3. If needed regularly, move it back to the main scripts directory

## Cleanup Details

- **Total scripts archived:** 41
- **Scripts remaining active:** 10
- **Package size reduction:** Cleaner development environment

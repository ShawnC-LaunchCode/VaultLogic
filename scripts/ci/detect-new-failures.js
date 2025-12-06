#!/usr/bin/env node
/**
 * Detect New Test Failures
 *
 * Compares current test results with previous run to detect:
 * - New failures (tests that were passing before)
 * - Resolved failures (tests that are now passing)
 * - Persistent failures (still failing)
 *
 * Usage:
 *   node detect-new-failures.js \
 *     --current path/to/current.json \
 *     --previous path/to/previous.json \
 *     --output path/to/output.json
 *
 * Output format:
 * {
 *   "newFailures": [...],      // Tests that just started failing
 *   "resolvedFailures": [...], // Tests that are now passing
 *   "persistentFailures": [...], // Tests still failing
 *   "summary": {
 *     "newCount": 0,
 *     "resolvedCount": 0,
 *     "persistentCount": 0,
 *     "hasNewFailures": false
 *   }
 * }
 */

import fs from 'fs';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {
    current: 'test-results-parsed.json',
    previous: 'test-results-previous.json',
    output: 'test-failures-delta.json',
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--current' && i + 1 < process.argv.length) {
      args.current = process.argv[++i];
    } else if (arg === '--previous' && i + 1 < process.argv.length) {
      args.previous = process.argv[++i];
    } else if (arg === '--output' && i + 1 < process.argv.length) {
      args.output = process.argv[++i];
    }
  }

  return args;
}

/**
 * Load JSON file safely
 */
function loadJSON(path) {
  if (!fs.existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`⚠️  Error loading ${path}: ${error.message}`);
    return null;
  }
}

/**
 * Create a unique key for a test
 */
function getTestKey(failure) {
  return `${failure.suite}::${failure.test}`;
}

/**
 * Compare current and previous test results
 */
function detectFailureChanges(current, previous) {
  // If no previous results, all failures are "new" (first run)
  if (!previous) {
    console.log('ℹ️  No previous test results found (first run)');
    const allFailures = [
      ...(current.vitest?.failures || []),
      ...(current.playwright?.failures || []),
    ];
    return {
      newFailures: [],
      resolvedFailures: [],
      persistentFailures: allFailures,
      summary: {
        newCount: 0,
        resolvedCount: 0,
        persistentCount: allFailures.length,
        hasNewFailures: false,
        isFirstRun: true,
      },
    };
  }

  // Get all current failures
  const currentFailures = [
    ...(current.vitest?.failures || []),
    ...(current.playwright?.failures || []),
  ];

  // Get all previous failures
  const previousFailures = [
    ...(previous.vitest?.failures || []),
    ...(previous.playwright?.failures || []),
  ];

  // Build maps for quick lookup
  const currentMap = new Map(currentFailures.map(f => [getTestKey(f), f]));
  const previousMap = new Map(previousFailures.map(f => [getTestKey(f), f]));

  // Detect new failures (in current but not in previous)
  const newFailures = currentFailures.filter(f => !previousMap.has(getTestKey(f)));

  // Detect resolved failures (in previous but not in current)
  const resolvedFailures = previousFailures.filter(f => !currentMap.has(getTestKey(f)));

  // Detect persistent failures (in both current and previous)
  const persistentFailures = currentFailures.filter(f => previousMap.has(getTestKey(f)));

  console.log(`\n📊 Failure Comparison:`);
  console.log(`   New failures:        ${newFailures.length}`);
  console.log(`   Resolved failures:   ${resolvedFailures.length}`);
  console.log(`   Persistent failures: ${persistentFailures.length}`);

  return {
    newFailures,
    resolvedFailures,
    persistentFailures,
    summary: {
      newCount: newFailures.length,
      resolvedCount: resolvedFailures.length,
      persistentCount: persistentFailures.length,
      hasNewFailures: newFailures.length > 0,
      isFirstRun: false,
    },
  };
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Detecting new test failures...\n');

  const args = parseArgs();

  // Load current and previous results
  const current = loadJSON(args.current);
  const previous = loadJSON(args.previous);

  if (!current) {
    console.error('❌ Current test results are required');
    process.exit(1);
  }

  console.log('✓ Loaded current test results');
  if (previous) {
    console.log('✓ Loaded previous test results');
  }

  // Detect changes
  const result = detectFailureChanges(current, previous);

  // Write output
  fs.writeFileSync(args.output, JSON.stringify(result, null, 2));
  console.log(`\n✅ Failure detection complete`);
  console.log(`   Output: ${args.output}`);

  if (result.summary.hasNewFailures) {
    console.log(`\n⚠️  ${result.summary.newCount} NEW test failure(s) detected!`);
  }

  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { detectFailureChanges, getTestKey };

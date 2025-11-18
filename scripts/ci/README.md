# CI/CD Scripts

This directory contains scripts used by GitHub Actions workflows for test result parsing, coverage analysis, and Slack notifications.

## Scripts Overview

### `parse-test-results.js`

Parses Vitest and Playwright test results into a unified JSON format.

**Usage:**
```bash
node scripts/ci/parse-test-results.js \
  --vitest-json vitest-summary.json \
  --playwright-json playwright-summary.json \
  --output test-results-parsed.json
```

**Output format:**
```json
{
  "vitest": {
    "total": 142,
    "passed": 140,
    "failed": 2,
    "skipped": 0,
    "duration": 12500,
    "failures": [
      {
        "suite": "workflow-engine › conditional-routing",
        "test": "should route correctly",
        "error": "Expected true, got false",
        "location": "tests/unit/engine.test.ts:142"
      }
    ]
  },
  "playwright": {
    "total": 24,
    "passed": 24,
    "failed": 0,
    "skipped": 0,
    "flaky": 0,
    "duration": 45000,
    "didNotRun": false,
    "failures": []
  },
  "summary": {
    "total": 166,
    "passed": 164,
    "failed": 2,
    "skipped": 0,
    "duration": 57500,
    "status": "failure"
  }
}
```

**Status values:**
- `success` - All tests passed
- `failure` - One or more tests failed
- `warning` - Tests did not run (e.g., webserver failed to start)

### `parse-coverage.js`

Parses Vitest coverage data and extracts metrics.

**Usage:**
```bash
node scripts/ci/parse-coverage.js \
  --coverage-json coverage/coverage-summary.json \
  --output coverage-parsed.json
```

**Output format:**
```json
{
  "statements": {
    "total": 332,
    "covered": 289,
    "pct": 87.05
  },
  "branches": {
    "total": 114,
    "covered": 91,
    "pct": 79.82
  },
  "functions": {
    "total": 63,
    "covered": 57,
    "pct": 90.48
  },
  "lines": {
    "total": 303,
    "covered": 271,
    "pct": 89.44
  },
  "summary": {
    "pct": 87.05,
    "color": "green",
    "emoji": "🟢"
  },
  "topFiles": {
    "best": [
      { "file": "server/services/WorkflowService.ts", "pct": 100 },
      { "file": "server/services/SectionService.ts", "pct": 98.5 }
    ],
    "worst": [
      { "file": "server/routes/admin.ts", "pct": 12.3 },
      { "file": "server/utils/legacy.ts", "pct": 5.8 }
    ]
  }
}
```

**Coverage colors:**
- 🟢 `green` - 80%+ coverage
- 🟡 `yellow` - 50-79% coverage
- 🔴 `red` - <50% coverage

## Integration with GitHub Actions

These scripts are designed to be called from GitHub Actions workflows:

```yaml
- name: Parse test results
  run: |
    node scripts/ci/parse-test-results.js \
      --vitest-json vitest-summary.json \
      --playwright-json playwright-summary.json \
      --output test-results-parsed.json

- name: Parse coverage
  run: |
    node scripts/ci/parse-coverage.js \
      --coverage-json coverage/coverage-summary.json \
      --output coverage-parsed.json
```

The output JSON files can then be used by subsequent steps (e.g., Slack notifications).

## Error Handling

All scripts:
- Exit with code 0 even on test failures (so notifications still run)
- Output detailed console logs for debugging
- Handle missing input files gracefully
- Generate empty/default output when data is unavailable

## Testing Locally

You can test these scripts locally after running tests:

```bash
# Run tests with coverage
npm run test:coverage -- --reporter=json --outputFile=vitest-summary.json

# Parse results
node scripts/ci/parse-test-results.js
node scripts/ci/parse-coverage.js

# Check output
cat test-results-parsed.json
cat coverage-parsed.json
```

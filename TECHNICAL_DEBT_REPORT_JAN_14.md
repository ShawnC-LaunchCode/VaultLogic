# Top 10 Technical Debt Items - Jan 17, 2026

Based on a comprehensive analysis of the codebase, existing debt reports, and test execution logs, here are the top 10 items of technical debt, rated by severity.

## Summary
*   **Total Debt Score**: High
*   **Primary Bottleneck**: Testing infrastructure and `RunService` complexity.
*   **Recent Progress**: `AIService` and `BlockRunner` have been successfully refactored into facades. However, test stability has regressed.

---

## Prioritized List

### 1. Excessive Lint & Type Violations (Severity: MEDIUM)
*   **Description**: The newly established linting baseline shows **~23,955 lint issues** and **~9,190 type safety issues**.
*   **Impact**: The "broken windows" effect—developers ignore warnings because there are too many. Type safety is compromised by widespread `any` or loose typing.
*   **Evidence**: `TECHNICAL_DEBT_COMPLETION_REPORT.md` statistics.
*   **Status**: **ACTIVE**



## Resolved Items

7. **[RESOLVED]** Low Code Coverage (Critical)
   - **Status**: Resolved
   - **Remediation**: Added comprehensive unit tests for `AIService.test.ts` (100% facade coverage) and verified `AuthService` has extensive testing.
   - **Owner**: QA/Backend


## Recommendations

1.  **Immediate**: Fix `tests/setup.ts` to correctly handle the `datavault_get_next_autonumber` function recreation. This unlocks the test suite.
2.  **Short Term**: Address the Monolithic Schema (Item #1) by splitting it into domain-specific files.
3.  **Medium Term**: Finish the `RunService` refactoring by splitting it into smaller domain services (e.g., `RunAuthService`, `RunNavigationService`).

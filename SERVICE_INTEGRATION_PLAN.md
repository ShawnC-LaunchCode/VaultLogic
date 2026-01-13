# Service Refactoring Integration Plan
**Date:** January 13, 2026
**Status:** Ready to Execute

---

## Overview

Three large services have modular refactorings ready but not integrated:
1. **AIService** (2,124 lines) → Extract to modules
2. **BlockRunner** (1,988 lines) → Strategy pattern with specialized runners
3. **RunService** (1,237 lines) → Facade pattern with specialized services

**Total Integration Time:** 8-10 hours
**Current Status:** Modules created (70% complete), need integration

---

## Integration Plan: AIService (3-4 hours)

### Current State
- **File:** `server/services/AIService.ts` (2,124 lines)
- **Pattern:** Monolithic service with all AI logic in one class

### Target State
- **Main Service:** AIService orchestrates calls to specialized modules
- **AIPromptBuilder:** Handles all prompt construction (8 methods)

### Integration Strategy

**Step 1: Extract Prompt Building**
1. Import AIPromptBuilder in AIService
2. Instantiate promptBuilder in constructor
3. Replace 8 private `build*` methods with calls to `promptBuilder.build*`
4. Remove old prompt building code

**Methods to Replace (All exist in AIPromptBuilder):**
- buildWorkflowGenerationPrompt (line 243)
- buildWorkflowSuggestionPrompt (line 372)
- buildBindingSuggestionPrompt (line 415)
- buildValueSuggestionPrompt (line 1185)
- buildWorkflowRevisionPrompt (line 1771)
- buildLogicGenerationPrompt (line 1984)
- buildLogicDebugPrompt (line 2001)
- buildLogicVisualizationPrompt (line 2007)

**Expected Outcome:**
- AIService reduced from ~2,124 → ~1,800 lines (15% reduction)
- Prompt building logic now testable in isolation

---

## Integration Plan: BlockRunner (4-5 hours)

### Current State
- **File:** `server/services/BlockRunner.ts` (1,988 lines)
- **Pattern:** Massive switch statement handling 15+ block types

### Target State
- **BaseBlockRunner:** Abstract base class with common logic
- **Specialized Runners:** One class per block type
- **Factory Pattern:** Dispatch to correct runner

**Specialized Runners Already Created:**
- BaseBlockRunner.ts
- PrefillBlockRunner.ts
- ValidateBlockRunner.ts
- BranchBlockRunner.ts
- CollectionBlockRunner.ts

**Expected Outcome:**
- BlockRunner reduced from ~1,988 → ~500 lines (75% reduction)

---

## Integration Plan: RunService (2-3 hours)

### Current State
- **File:** `server/services/RunService.ts` (1,237 lines)
- **Pattern:** God object handling all run operations

### Target State
- **RunService:** Facade that delegates to specialized services
- **RunLifecycleService:** Handle create, start, complete
- **RunStateService:** Handle state transitions
- **RunMetricsService:** Handle analytics

**Services Already Created:**
- RunLifecycleService.ts
- RunStateService.ts
- RunMetricsService.ts

**Expected Outcome:**
- RunService reduced from ~1,237 → ~400 lines (68% reduction)

---

## Implementation Order

1. **AIService** (3-4 hours) - Lowest risk, clearest benefit
2. **RunService** (2-3 hours) - Medium complexity
3. **BlockRunner** (4-5 hours) - Highest complexity

**Total:** 8-10 hours

---

## Success Metrics

- **Lines Reduced:** ~1,500 lines (30% reduction)
- **Test Coverage:** Maintained at 99.77%
- **No Regressions:** All 2,593 tests still passing

**Status:** Ready to begin AIService integration

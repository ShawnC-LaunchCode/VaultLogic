## Stage 20 PR 3: Question-Level Conditions

## Overview

Adds conditional question visibility within pages, allowing individual questions to be shown/hidden based on user answers. This provides fine-grained control over form display and improves user experience by showing only relevant questions.

## Database Changes

### Migration: `0021_add_question_conditions.sql`

Adds one JSONB column to the `steps` table:

```sql
ALTER TABLE steps
ADD COLUMN visible_if jsonb DEFAULT NULL;
```

Stores condition expressions in the format defined by PR 1's condition system.

## Schema Changes

### `steps` table

```typescript
export const steps = pgTable("steps", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: uuid("section_id").references(() => sections.id, { onDelete: 'cascade' }).notNull(),
  type: stepTypeEnum("type").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  required: boolean("required").default(false),
  options: jsonb("options"),
  alias: text("alias"),
  order: integer("order").notNull(),
  isVirtual: boolean("is_virtual").default(false).notNull(),
  // NEW: Question-level conditional logic
  visibleIf: jsonb("visible_if"), // Condition expression for question visibility
  createdAt: timestamp("created_at").defaultNow(),
});
```

## Core Service: IntakeQuestionVisibilityService

### Purpose

Evaluates question visibility conditions and manages validation filtering for questions within a page.

### Key Methods

#### `evaluatePageQuestions(sectionId, runId, recordData?)`

Evaluates all question conditions for a page:

```typescript
interface QuestionVisibilityResult {
  allQuestions: string[];              // All question IDs (including hidden)
  visibleQuestions: string[];          // Visible question IDs in order
  hiddenQuestions: string[];           // Hidden question IDs
  visibilityReasons: Map<string, string>; // Debug info
}
```

#### `getValidationFilter(sectionId, runId, recordData?)`

Determines which questions to validate on page submission:

```typescript
interface QuestionValidationFilter {
  requiredQuestions: string[];  // Visible + required
  skippedQuestions: string[];   // Hidden (skip validation)
}
```

#### `isQuestionVisible(questionId, runId, recordData?)`

Checks if a specific question is currently visible.

#### `getVisibleQuestionCount(sectionId, runId, recordData?)`

Returns count of visible questions (useful for UI indicators).

#### `validateQuestionConditions(sectionId)`

Validates question conditions for potential issues:
- Warns if required question has visibility condition
- Warns if virtual step has visibility condition (unnecessary)

#### `clearHiddenQuestionValues(sectionId, runId, recordData?)`

Clears previously entered values for questions that are now hidden. Returns array of cleared step IDs.

## Condition Examples

### Simple Question Visibility

Show "Spouse Name" only if user is married:

```typescript
{
  id: 'spouse-name',
  title: 'Spouse Name',
  visibleIf: {
    op: 'equals',
    left: { type: 'variable', path: 'maritalStatus' },
    right: { type: 'value', value: 'married' }
  }
}
```

### Conditional on Numeric Value

Show investment questions if income is high:

```typescript
{
  id: 'investment-preferences',
  title: 'Investment Preferences',
  visibleIf: {
    op: 'gt',
    left: { type: 'variable', path: 'annualIncome' },
    right: { type: 'value', value: 100000 }
  }
}
```

### Complex AND Condition

Show loan application only for qualified applicants:

```typescript
{
  id: 'loan-application',
  title: 'Loan Application',
  visibleIf: {
    and: [
      { op: 'gte', left: { type: 'variable', path: 'age' }, right: { type: 'value', value: 21 } },
      { op: 'gte', left: { type: 'variable', path: 'income' }, right: { type: 'value', value: 30000 } },
      { op: 'gte', left: { type: 'variable', path: 'creditScore' }, right: { type: 'value', value: 600 } }
    ]
  }
}
```

### Cascading Visibility

Questions can depend on answers to previous questions:

```typescript
// Q1: Do you have dependents?
{
  id: 'has-dependents',
  alias: 'hasDependents',
  visibleIf: null // Always visible
}

// Q2: How many dependents?
{
  id: 'dependent-count',
  alias: 'dependentCount',
  visibleIf: {
    op: 'equals',
    left: { type: 'variable', path: 'hasDependents' },
    right: { type: 'value', value: true }
  }
}

// Q3: Dependent details (only if count > 0)
{
  id: 'dependent-details',
  visibleIf: {
    op: 'gt',
    left: { type: 'variable', path: 'dependentCount' },
    right: { type: 'value', value: 0 }
  }
}
```

## Behavior Specification

### `visibleIf` Behavior

- **Default**: Questions are visible by default (no condition = always visible)
- **Evaluation**: If `visibleIf` evaluates to `false`, question is hidden
- **Effect**: Hidden questions are:
  - Not rendered in UI
  - Not included in validation
  - Have their values cleared (if previously answered)
- **Error handling**: Evaluation errors default to visible (fail-safe)

### Virtual Steps

Virtual steps (transform block outputs) are **always excluded** from visibility evaluation, even if they have a `visibleIf` condition.

### Required Questions with Visibility

A question can be both `required=true` and have a `visibleIf` condition:
- If visible: validation enforces required
- If hidden: validation skips the question

**Warning**: The service will warn about this configuration (valid but potentially confusing).

## Validation Integration

### Validation Flow

1. **Evaluate visibility** for all questions on page
2. **Filter to visible questions**
3. **Check required status** for visible questions
4. **Validate** only visible required questions

### Example Validation Code

```typescript
// Get validation filter
const filter = await intakeQuestionVisibilityService.getValidationFilter(
  sectionId,
  runId,
  recordData
);

// Validate only required questions
const errors = [];
for (const questionId of filter.requiredQuestions) {
  const value = stepValues.get(questionId);
  if (isEmpty(value)) {
    errors.push(`Question ${questionId} is required`);
  }
}

// Skip validation for hidden questions
// (filter.skippedQuestions contains IDs to skip)
```

## Value Clearing

### When to Clear

Values should be cleared when:
- A question was previously visible and answered
- The question is now hidden due to changed conditions
- User changes an earlier answer that affects visibility

### How It Works

```typescript
// After user updates an answer, check for hidden questions
const cleared = await intakeQuestionVisibilityService.clearHiddenQuestionValues(
  sectionId,
  runId,
  recordData
);

if (cleared.length > 0) {
  logger.info({ clearedCount: cleared.length }, 'Cleared hidden question values');
}
```

### Why Clear?

- **Data consistency**: Hidden questions shouldn't have values
- **Validation**: Prevents validation errors on hidden fields
- **Privacy**: User may want to remove previously entered data
- **UX**: Changing answer should reset dependent fields

## Testing

### Test Coverage

See `tests/unit/services/intakeQuestionVisibility.test.ts`:

- ✅ Basic visibility (no conditions)
- ✅ Virtual step filtering
- ✅ Question order preservation
- ✅ `visibleIf` true/false/complex
- ✅ AND/OR/NOT conditions
- ✅ Validation filtering (required vs skipped)
- ✅ Helper methods (isVisible, getCount)
- ✅ Value clearing for hidden questions
- ✅ Validation warnings (required + visibleIf, virtual + visibleIf)
- ✅ Error handling (default to visible)
- ✅ Cascading visibility (questions depending on each other)

## Integration Points

### Intake Runner (PR 7)

The intake runner will use `IntakeQuestionVisibilityService` to:
- Render only visible questions on each page
- Apply validation only to visible required questions
- Clear values when questions become hidden
- Show accurate question count per page

### Page Navigation (PR 2)

Question visibility is **independent** of page visibility:
- Page can be visible but have hidden questions
- Hidden questions don't affect page navigation
- Page progress considers all questions (visible + hidden)

### Validation Engine (PR 6)

The validation engine will integrate with question visibility:
- Get `requiredQuestions` from visibility service
- Skip validation for `skippedQuestions`
- Display errors only for visible questions

## Validation & Safety

### Fail-Safe Defaults

On condition evaluation error:
- `visibleIf` error → Default to **visible** (show question)

Rationale: Better to show an irrelevant question than hide a required one.

### Warning Validation

`validateQuestionConditions()` warns about:
1. Required questions with visibility conditions (valid but potentially confusing)
2. Virtual steps with visibility conditions (unnecessary - virtual steps are always hidden)

### Circular Dependencies

Question visibility can create cascading effects:
- Q1 shows Q2 (based on Q1 answer)
- Q2 shows Q3 (based on Q2 answer)
- And so on...

**Current behavior**: No circular dependency detection. Questions are evaluated once per page render.

**Future enhancement**: Detect and warn about circular dependencies.

## Migration Path

1. **Existing workflows**: No migration needed. Questions without conditions behave as before (all visible).
2. **Adding conditions**: Update step records with `visibleIf` JSONB.
3. **Removing conditions**: Set column to `NULL`.

## Performance Considerations

- **Evaluation cost**: O(n) where n = number of questions on page
- **Variable resolution**: O(m) where m = number of step values
- **Caching**: No caching implemented (evaluate on every page render)
- **Optimization**: For pages with many questions (>50), consider caching visibility results

## Known Limitations

1. **No circular dependency detection**: Questions can theoretically hide each other in circular ways
2. **No cross-page dependencies**: Questions can only reference answers from current or previous pages
3. **No "show if answered"**: Can't show Q3 only if Q2 was answered (must use specific value checks)

## Future Enhancements

- [ ] Circular dependency detection
- [ ] Cross-page question dependencies
- [ ] "Show if answered" operator
- [ ] Visibility preview in builder
- [ ] Analytics on most common visibility paths
- [ ] Bulk visibility operations (show/hide groups of questions)

## Files Changed/Added

### New Files

- `server/services/IntakeQuestionVisibilityService.ts` (280 lines)
- `tests/unit/services/intakeQuestionVisibility.test.ts` (700+ lines)
- `migrations/0021_add_question_conditions.sql`
- `docs/STAGE_20_PR3_QUESTION_CONDITIONS.md` (this file)

### Modified Files

- `shared/schema.ts` - Added `visibleIf` column to `steps` table

## Comparison: Page vs Question Conditions

| Feature | Page Conditions (PR 2) | Question Conditions (PR 3) |
|---------|----------------------|---------------------------|
| **Condition field** | `visibleIf`, `skipIf` | `visibleIf` only |
| **Scope** | Entire page (section) | Individual question (step) |
| **Navigation impact** | Yes (skip pages) | No (questions hidden in place) |
| **Validation** | N/A (whole page) | Hidden questions skipped |
| **Value clearing** | N/A | Yes (clear on hide) |
| **Progress impact** | Yes (fewer pages) | No (same page count) |
| **Use case** | Branch workflows | Show/hide related fields |

## Next PR

**PR 4: Repeating Groups (Repeaters)**

Will add repeater field type for collecting multiple instances of the same set of questions (e.g., multiple dependents, multiple addresses).

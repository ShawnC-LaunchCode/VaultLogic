# Vault-Logic Workflow Builder Enhancements — Implementation Summary

## Overview

This document describes the backend enhancements implemented for Vault-Logic's workflow builder, including section skip logic, workflow execution flow, run state tracking, and improved logic evaluation.

---

## 1. Schema Changes

### Modified Tables

#### `workflow_runs` Table
**New Fields:**
- `currentSectionId` (uuid, nullable) - Tracks the current section in workflow execution
- `progress` (integer, default 0) - Progress percentage (0-100)

**New Index:**
- `workflow_runs_current_section_idx` on `currentSectionId`

#### `conditional_action` Enum
**New Value:**
- `skip_to` - Allows logic rules to skip directly to another section

### Migration Required

Before deploying, run:
```bash
npm run db:push
```

This will apply the schema changes to your database.

---

## 2. New Files Created

### `/server/services/LogicService.ts`

Centralized service for workflow logic evaluation and navigation.

**Key Methods:**
- `evaluateNavigation(workflowId, runId, currentSectionId)` - Evaluates logic and determines next section
- `validateCompletion(workflowId, runId)` - Validates that all required steps are complete
- `calculateProgress(currentSectionId, sections, visibleSections)` - Calculates progress percentage

**Returns:**
```typescript
interface NavigationResult {
  visibleSections: string[];       // Array of visible section IDs
  visibleSteps: string[];          // Array of visible step IDs
  requiredSteps: string[];         // Array of required step IDs
  skipToSectionId?: string;        // Section to skip to (if any)
  nextSectionId: string | null;    // Next section ID or null if complete
  currentProgress: number;         // Progress 0-100
}
```

---

## 3. Enhanced Files

### `/shared/schema.ts`
- Added `currentSectionId` and `progress` fields to `workflowRuns` table
- Added `skip_to` action to `conditionalActionEnum`

### `/shared/workflowLogic.ts`
- Added support for `skip_to` action in section-level rules
- Added `calculateNextSection()` function for section navigation
- Added `resolveNextSection()` function to handle skip logic
- Enhanced `WorkflowEvaluationResult` interface with `nextSectionId` field

### `/server/services/RunService.ts`
- Added `next(runId, userId)` method - Calculates next section and updates run state
- Updated `completeRun(runId, userId)` method - Now uses LogicService for validation
- Added dependency injection for LogicService

### `/server/routes/runs.routes.ts`
- Added `POST /api/runs/:runId/next` endpoint

---

## 4. API Endpoints

### **POST /api/runs/:runId/next**

Calculate and navigate to the next section in the workflow.

**Authentication:** Required

**Path Parameters:**
- `runId` (string) - The workflow run ID

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "visibleSections": [
      "section-id-1",
      "section-id-2",
      "section-id-4"
    ],
    "visibleSteps": [
      "step-id-1",
      "step-id-2",
      "step-id-3"
    ],
    "requiredSteps": [
      "step-id-1",
      "step-id-3"
    ],
    "skipToSectionId": null,
    "nextSectionId": "section-id-2",
    "currentProgress": 33
  }
}
```

**Response (With Skip Logic - 200):**
```json
{
  "success": true,
  "data": {
    "visibleSections": [
      "section-id-1",
      "section-id-3",
      "section-id-4"
    ],
    "visibleSteps": [
      "step-id-1",
      "step-id-5",
      "step-id-6"
    ],
    "requiredSteps": [
      "step-id-5"
    ],
    "skipToSectionId": "section-id-4",
    "nextSectionId": "section-id-4",
    "currentProgress": 66
  }
}
```

**Response (Workflow Complete - 200):**
```json
{
  "success": true,
  "data": {
    "visibleSections": [
      "section-id-1",
      "section-id-2",
      "section-id-3"
    ],
    "visibleSteps": [
      "step-id-1",
      "step-id-2",
      "step-id-3"
    ],
    "requiredSteps": [
      "step-id-1",
      "step-id-2"
    ],
    "skipToSectionId": null,
    "nextSectionId": null,
    "currentProgress": 100
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "Run is already completed"
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "error": "Run not found"
}
```

**Response (Error - 403):**
```json
{
  "success": false,
  "error": "Access denied"
}
```

---

### **PUT /api/runs/:runId/complete**

Mark a workflow run as complete (with validation).

**Authentication:** Required

**Path Parameters:**
- `runId` (string) - The workflow run ID

**Response (Success - 200):**
```json
{
  "id": "run-id-123",
  "workflowId": "workflow-id-456",
  "participantId": "participant-id-789",
  "currentSectionId": "section-id-3",
  "progress": 100,
  "completed": true,
  "completedAt": "2025-11-05T16:45:30.123Z",
  "metadata": {},
  "createdAt": "2025-11-05T15:30:00.000Z",
  "updatedAt": "2025-11-05T16:45:30.123Z"
}
```

**Response (Error - 400 Missing Required Steps):**
```json
{
  "message": "Missing required steps: Email Address, Phone Number"
}
```

**Response (Error - 400 Already Complete):**
```json
{
  "message": "Run is already completed"
}
```

---

## 5. Logic Rule Examples

### Skip to Section Rule

Create a logic rule that skips to a specific section based on a condition:

```typescript
{
  "workflowId": "workflow-id-123",
  "conditionStepId": "step-user-type-id",
  "operator": "equals",
  "conditionValue": "premium",
  "targetType": "section",
  "targetSectionId": "section-premium-features-id",
  "action": "skip_to",
  "logicalOperator": "AND",
  "order": 1
}
```

**Behavior:**
- When `step-user-type-id` equals "premium", workflow will skip directly to `section-premium-features-id`
- Normal section progression is bypassed
- If the skip target section is not visible, finds the next visible section

### Hide Section Rule

```typescript
{
  "workflowId": "workflow-id-123",
  "conditionStepId": "step-has-business-id",
  "operator": "equals",
  "conditionValue": false,
  "targetType": "section",
  "targetSectionId": "section-business-info-id",
  "action": "hide",
  "logicalOperator": "AND",
  "order": 1
}
```

**Behavior:**
- When `step-has-business-id` is false, `section-business-info-id` is hidden
- Hidden sections are skipped in navigation
- All steps in hidden sections are also hidden

---

## 6. Frontend Integration Guide

### Workflow Runner Flow

```typescript
// 1. User starts a workflow run
const response = await fetch(`/api/workflows/${workflowId}/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ participantId })
});
const run = await response.json();

// 2. Get first section to display
const navResponse = await fetch(`/api/runs/${run.id}/next`, {
  method: 'POST'
});
const navigation = await navResponse.json();

// Display navigation.data.nextSectionId
// Show only steps in navigation.data.visibleSteps
// Mark steps in navigation.data.requiredSteps as required
// Show progress: navigation.data.currentProgress

// 3. User fills in step values and clicks "Next"
await fetch(`/api/runs/${run.id}/values/bulk`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    values: [
      { stepId: 'step-1', value: 'answer1' },
      { stepId: 'step-2', value: 'answer2' }
    ]
  })
});

// 4. Get next section
const nextNav = await fetch(`/api/runs/${run.id}/next`, {
  method: 'POST'
});
const nextNavigation = await nextNav.json();

if (nextNavigation.data.nextSectionId === null) {
  // Workflow complete - show completion page
  // Or allow user to review and submit
} else {
  // Navigate to nextNavigation.data.nextSectionId
}

// 5. When user clicks "Complete"
const completeResponse = await fetch(`/api/runs/${run.id}/complete`, {
  method: 'PUT'
});

if (completeResponse.ok) {
  // Success - show confirmation
} else {
  const error = await completeResponse.json();
  // Show error: error.message (includes missing step titles)
}
```

---

## 7. Testing Checklist

- [ ] Create workflow with multiple sections
- [ ] Create logic rule with `skip_to` action
- [ ] Start workflow run and verify first section loads
- [ ] Fill in values and call `/next` endpoint
- [ ] Verify `currentSectionId` and `progress` are updated in database
- [ ] Verify skip logic works when condition is met
- [ ] Verify required step validation on completion
- [ ] Verify error handling for missing required steps
- [ ] Verify workflow can be completed successfully
- [ ] Test nested skip logic (skip to section that has skip rules)
- [ ] Test hidden sections are properly skipped
- [ ] Test progress calculation is accurate

---

## 8. Implementation Details

### Section Visibility Logic

By default, all sections are visible unless:
1. A `hide` action rule is triggered for that section
2. The section is not in the workflow's section list

### Step Visibility Logic

Steps are visible if:
1. Their parent section is visible
2. No `hide` action rule is triggered for the step
3. Or a `show` action rule is explicitly triggered

### Navigation Priority

1. **Skip Logic** - If `skipToSectionId` is set, it takes precedence
2. **Next Sequential Section** - Normal progression through sections by order
3. **Completion** - When no more visible sections exist, `nextSectionId` is null

### Progress Calculation

```
progress = (current_section_index + 1) / total_visible_sections * 100
```

- Only counts visible sections
- Ranges from 0 to 100
- Set to 100 on completion

---

## 9. Database Migration Notes

The schema changes are backward compatible:
- `currentSectionId` is nullable (existing runs will have null)
- `progress` has a default value of 0
- `skip_to` action is added to enum (no existing data to migrate)

Existing workflow runs will continue to work but won't have navigation tracking until the `/next` endpoint is called.

---

## 10. Performance Considerations

- Logic evaluation happens on every `/next` call
- Caching may be beneficial for workflows with many rules
- Consider adding indexes on frequently queried fields
- Bulk value updates are more efficient than single updates

---

## 11. Future Enhancements

Potential improvements for future iterations:

1. **Rule Caching** - Cache logic evaluation results
2. **Conditional Branching** - Support multiple skip targets based on different conditions
3. **Section Loops** - Allow repeating sections
4. **Dynamic Section Generation** - Create sections based on runtime data
5. **Progress Checkpoints** - Save/restore run state at specific sections
6. **Rule Testing UI** - Visual rule debugging and testing tool

---

✅ **Vault-Logic backend updated — section skip logic, run navigation, and runtime evaluation implemented successfully.**

## Files Modified

1. `shared/schema.ts` - Schema updates
2. `shared/workflowLogic.ts` - Enhanced logic evaluation
3. `server/services/LogicService.ts` - New service (created)
4. `server/services/RunService.ts` - Added navigation methods
5. `server/routes/runs.routes.ts` - Added `/next` endpoint

## Next Steps

1. Set up `DATABASE_URL` in your `.env` file
2. Run `npm run db:push` to apply schema changes
3. Test the `/next` endpoint with your workflow
4. Integrate frontend workflow runner with navigation API
5. Deploy to production environment

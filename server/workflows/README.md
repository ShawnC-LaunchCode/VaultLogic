# Workflow Condition System

The workflow condition system provides a flexible, expression-based engine for evaluating conditional logic in Intake Runner 2.0.

## Overview

The condition system supports:

- **Basic comparisons**: equals, notEquals, gt, gte, lt, lte
- **Array/string operations**: in, notIn, contains, notContains, startsWith, endsWith
- **Empty checks**: isEmpty, notEmpty
- **Pattern matching**: matches (regex)
- **Composite conditions**: AND, OR, NOT
- **Variable references**: Support for dot notation and array indexing
- **Multiple data sources**: Workflow variables and collection record data

## Basic Usage

```typescript
import { evaluateCondition, varRef, value } from './conditions';

// Simple equality check
const condition = {
  op: 'equals',
  left: varRef('status'),
  right: value('approved'),
};

const context = {
  variables: { status: 'approved' },
};

const result = evaluateCondition(condition, context); // true
```

## Operators

### Comparison Operators

```typescript
// Equals (case-insensitive for strings)
{ op: 'equals', left: varRef('name'), right: value('John') }

// Not equals
{ op: 'notEquals', left: varRef('status'), right: value('banned') }

// Greater than
{ op: 'gt', left: varRef('age'), right: value(18) }

// Greater than or equal
{ op: 'gte', left: varRef('score'), right: value(50) }

// Less than
{ op: 'lt', left: varRef('price'), right: value(100) }

// Less than or equal
{ op: 'lte', left: varRef('items'), right: value(10) }
```

### Array/String Operators

```typescript
// Value in array
{ op: 'in', left: varRef('role'), right: value(['admin', 'manager']) }

// Value not in array
{ op: 'notIn', left: varRef('status'), right: value(['banned', 'suspended']) }

// Array/string contains value
{ op: 'contains', left: varRef('tags'), right: value('urgent') }

// Array/string doesn't contain value
{ op: 'notContains', left: varRef('message'), right: value('error') }

// String starts with
{ op: 'startsWith', left: varRef('email'), right: value('admin@') }

// String ends with
{ op: 'endsWith', left: varRef('filename'), right: value('.pdf') }

// Regex match
{ op: 'matches', left: varRef('phone'), right: value('^\\d{3}-\\d{3}-\\d{4}$') }
```

### Empty Checks

```typescript
// Is empty (null, undefined, empty string, empty array)
{ op: 'isEmpty', left: varRef('optional'), right: value(null) }

// Is not empty
{ op: 'notEmpty', left: varRef('required'), right: value(null) }
```

## Composite Conditions

### AND Condition

All sub-conditions must be true:

```typescript
const condition = {
  and: [
    { op: 'equals', left: varRef('status'), right: value('active') },
    { op: 'gte', left: varRef('age'), right: value(18) },
  ],
};
```

### OR Condition

At least one sub-condition must be true:

```typescript
const condition = {
  or: [
    { op: 'equals', left: varRef('role'), right: value('admin') },
    { op: 'equals', left: varRef('role'), right: value('manager') },
  ],
};
```

### NOT Condition

Negates the sub-condition:

```typescript
const condition = {
  not: {
    op: 'equals',
    left: varRef('status'),
    right: value('banned'),
  },
};
```

### Complex Nested Conditions

Combine AND, OR, NOT for complex logic:

```typescript
// (status = 'active' AND age >= 18) OR (vip = true AND NOT banned)
const condition = {
  or: [
    {
      and: [
        { op: 'equals', left: varRef('status'), right: value('active') },
        { op: 'gte', left: varRef('age'), right: value(18) },
      ],
    },
    {
      and: [
        { op: 'equals', left: varRef('vip'), right: value(true) },
        { not: { op: 'equals', left: varRef('banned'), right: value(true) } },
      ],
    },
  ],
};
```

## Variable Resolution

### Simple Variables

```typescript
// References workflow variable "firstName"
varRef('firstName')
```

### Dot Notation

```typescript
// References nested property
varRef('address.city')
varRef('company.info.name')
```

### Array Indexing

```typescript
// References first item in array
varRef('items[0]')

// References nested property in array item
varRef('users[0].name')
varRef('addresses[1].city')
```

## Data Sources

The evaluation context supports two data sources:

1. **Workflow variables**: Step values collected during workflow run
2. **Collection record data**: Pre-filled data from a collection record

Variables are resolved in order:
1. First check `context.variables`
2. If not found, check `context.record`

```typescript
const context = {
  variables: {
    firstName: 'John',
    lastName: 'Doe',
  },
  record: {
    company: 'Acme Corp',
    industry: 'Technology',
  },
};

// Can reference both sources
const condition1 = { op: 'equals', left: varRef('firstName'), right: value('John') };
const condition2 = { op: 'equals', left: varRef('company'), right: value('Acme Corp') };
```

## Validation

Validate condition structure before evaluation:

```typescript
import { validateConditionExpression } from './conditions';

const condition = {
  op: 'equals',
  left: { type: 'variable', path: 'name' },
  right: { type: 'value', value: 'John' },
};

const errors = validateConditionExpression(condition);
if (errors.length > 0) {
  console.error('Invalid condition:', errors);
}
```

## Integration Examples

### Page-Level Visibility (PR 2)

```typescript
// Page definition with visibleIf condition
const page = {
  id: 'employment-details',
  title: 'Employment Details',
  visibleIf: {
    op: 'equals',
    left: varRef('employmentStatus'),
    right: value('employed'),
  },
  elements: [/* ... */],
};

// Evaluate visibility
const isVisible = evaluateCondition(page.visibleIf, context);
```

### Question-Level Visibility (PR 3)

```typescript
// Question with conditional visibility
const question = {
  id: 'q1',
  type: 'text',
  slug: 'spouseName',
  title: 'Spouse Name',
  visibleIf: {
    op: 'equals',
    left: varRef('maritalStatus'),
    right: value('married'),
  },
};

// Evaluate visibility
const isVisible = evaluateCondition(question.visibleIf, context);
```

### Repeater Visibility (PR 4)

```typescript
// Repeater with conditional display
const repeater = {
  id: 'r1',
  type: 'repeater',
  title: 'Dependents',
  visibleIf: {
    op: 'gt',
    left: varRef('dependentCount'),
    right: value(0),
  },
  fields: [/* ... */],
};
```

### Validation Rules (PR 6)

```typescript
// Field validation with conditional requirement
const field = {
  id: 'ssn',
  title: 'Social Security Number',
  validation: {
    requiredIf: {
      op: 'equals',
      left: varRef('country'),
      right: value('USA'),
    },
  },
};
```

## Best Practices

1. **Use semantic variable names**: `varRef('isEmployed')` instead of `varRef('q3')`
2. **Prefer simple conditions**: Break complex logic into multiple pages/questions
3. **Validate before evaluation**: Use `validateConditionExpression()` in builder UI
4. **Test edge cases**: Consider null, undefined, empty string, empty array
5. **Use case-insensitive comparisons**: String operators are case-insensitive by default
6. **Avoid deep nesting**: Limit nested conditions to 2-3 levels for readability

## Type Safety

All types are exported for TypeScript usage:

```typescript
import type {
  ConditionExpression,
  ConditionOperator,
  ConditionOperand,
  VariableReference,
  ValueLiteral,
  EvaluationContext,
  ComparisonCondition,
  AndCondition,
  OrCondition,
  NotCondition,
} from './conditions';
```

## Testing

See `tests/unit/workflows/conditionTruthTable.test.ts` for comprehensive test coverage including:

- All basic operators
- Composite conditions (AND, OR, NOT)
- Variable resolution (simple, dot notation, array indexing)
- Edge cases and error handling
- Validation tests

## Performance

- Variable resolution is cached within a single evaluation
- Regex compilation is done on-the-fly (not cached)
- For high-frequency evaluations, consider caching evaluation results
- Complex nested conditions may impact performance - profile if needed

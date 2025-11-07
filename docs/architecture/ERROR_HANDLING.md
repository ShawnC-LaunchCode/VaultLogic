# Centralized Error Handler Middleware

A comprehensive error handling infrastructure for Express routes that eliminates duplicate error handling patterns and provides type-safe error classes with automatic error classification.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Usage Patterns](#usage-patterns)
- [Custom Error Classes](#custom-error-classes)
- [Helper Functions](#helper-functions)
- [Migration Guide](#migration-guide)
- [Integration Checklist](#integration-checklist)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

---

## Overview

### Features

- **Custom Error Classes**: Type-safe error classes for common HTTP error codes
- **Automatic Error Classification**: Intelligently maps error messages to appropriate status codes
- **Structured Logging**: Integrates with existing Pino logger with request context
- **Zod Validation Support**: Automatic handling of Zod validation errors
- **Development/Production Modes**: Detailed errors in development, safe errors in production
- **Helper Functions**: Utilities for common error patterns
- **Async Route Wrapper**: Eliminates boilerplate try/catch blocks

### Benefits

| Before | After |
|--------|-------|
| Manual try/catch in every route | Automatic error catching with asyncHandler |
| Manual status code mapping | Automatic status code inference |
| console.error for logging | Structured logging with request context |
| Inconsistent error responses | Standardized error responses |
| ~15-20 lines of error handling | ~5-7 lines of business logic |
| Error logic mixed with route logic | Clear separation of concerns |
| Hard to test error cases | Easy to test by throwing errors |

---

## Quick Start

### Step 1: Register Error Handler

Add the error handler to your main server file **after all route registrations**:

```typescript
// In server/index.ts (or wherever you configure your Express app)

import { errorHandler } from './middleware/errorHandler';
// OR use the index export:
// import { errorHandler } from './middleware';

// ... all your middleware ...
// ... all your route registrations ...

// IMPORTANT: Register error handler LAST (before starting server)
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**IMPORTANT**: The error handler must be the last middleware registered!

### Step 2: Start Using in Routes

```typescript
// In any route file
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

// Wrap async handlers with asyncHandler
app.get('/api/surveys/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
  const survey = await getSurvey(req.params.id);

  // Throw custom errors - they'll be caught automatically
  if (!survey) {
    throw new NotFoundError("Survey not found");
  }

  res.json(survey);
}));
```

---

## Usage Patterns

### Pattern 1: Using asyncHandler with Custom Errors (Recommended)

The `asyncHandler` wrapper automatically catches errors and passes them to the error handler:

```typescript
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

app.get('/api/surveys/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
  const userId = req.user.claims.sub;
  const survey = await getSurvey(req.params.id);

  if (!survey) {
    throw new NotFoundError("Survey not found");
  }

  if (survey.creatorId !== userId) {
    throw new ForbiddenError("Access denied - you do not own this survey");
  }

  res.json(survey);
}));
```

### Pattern 2: Using Helper Functions (Most Concise)

Helper functions provide assertion-style error handling:

```typescript
import { asyncHandler, assertFound, assertAuthorized, assertAuthenticated } from '../middleware/errorHandler';

app.get('/api/surveys/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
  const userId = req.user.claims.sub;
  assertAuthenticated(userId, "Unauthorized - no user ID");

  const survey = await getSurvey(req.params.id);
  assertFound(survey, "Survey not found");
  assertAuthorized(survey.creatorId === userId, "Access denied");

  res.json(survey);
}));
```

### Pattern 3: Throwing from Services

Services can throw custom errors that are automatically handled:

```typescript
// In service file
import { NotFoundError, ForbiddenError, assertFound, assertAuthorized } from '../middleware/errorHandler';

class SurveyService {
  async getSurvey(id: string, userId: string) {
    const survey = await db.findSurvey(id);
    assertFound(survey, "Survey not found");
    assertAuthorized(survey.creatorId === userId, "Access denied");
    return survey;
  }
}

// In route file
app.get('/api/surveys/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
  const survey = await surveyService.getSurvey(req.params.id, req.user.claims.sub);
  res.json(survey);
}));
```

---

## Custom Error Classes

### NotFoundError (404)

Use when a requested resource doesn't exist:

```typescript
throw new NotFoundError("Survey not found");
throw new NotFoundError("User not found");
throw new NotFoundError(); // Default: "Resource not found"
```

### ForbiddenError (403)

Use when user doesn't have permission:

```typescript
throw new ForbiddenError("Access denied - you do not own this survey");
throw new ForbiddenError("Access denied - team admin access required");
throw new ForbiddenError(); // Default: "Access denied"
```

### UnauthorizedError (401)

Use when authentication is required or has failed:

```typescript
throw new UnauthorizedError("Unauthorized - no user ID");
throw new UnauthorizedError("Token expired");
throw new UnauthorizedError(); // Default: "Unauthorized"
```

### BadRequestError (400)

Use for validation errors or bad input:

```typescript
throw new BadRequestError("Invalid email format");
throw new BadRequestError("Cannot delete published survey");
throw new BadRequestError(); // Default: "Bad request"
```

### ConflictError (409)

Use when request conflicts with current state:

```typescript
throw new ConflictError("User is already a team member");
throw new ConflictError("Survey with this name already exists");
throw new ConflictError(); // Default: "Resource conflict"
```

---

## Helper Functions

### assertFound

Throws `NotFoundError` if value is null/undefined:

```typescript
const survey = await getSurvey(id);
assertFound(survey, "Survey not found");
// TypeScript now knows survey is not null/undefined
```

### assertAuthorized

Throws `ForbiddenError` if condition is false:

```typescript
assertAuthorized(survey.creatorId === userId, "Access denied");
assertAuthorized(membership?.role === 'admin', "Admin access required");
```

### assertAuthenticated

Throws `UnauthorizedError` if value is falsy:

```typescript
const userId = req.user?.claims?.sub;
assertAuthenticated(userId, "Unauthorized - no user ID");
```

### validateInput

Validates input using Zod schema:

```typescript
const data = validateInput(createSurveySchema, req.body);
// If validation fails, ZodError is thrown and handled automatically
```

---

## Migration Guide

### Before (Old Pattern)

```typescript
app.get('/api/surveys/:id', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - no user ID" });
    }

    const survey = await getSurvey(req.params.id);

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    if (survey.creatorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(survey);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to fetch survey" });
  }
});
```

### After (New Pattern)

```typescript
import { asyncHandler, assertFound, assertAuthorized, assertAuthenticated } from '../middleware/errorHandler';

app.get('/api/surveys/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
  const userId = req.user.claims.sub;
  assertAuthenticated(userId, "Unauthorized - no user ID");

  const survey = await getSurvey(req.params.id);
  assertFound(survey, "Survey not found");
  assertAuthorized(survey.creatorId === userId, "Access denied");

  res.json(survey);
}));
```

**Results:**
- 15 lines → 7 lines (53% reduction)
- No try/catch boilerplate
- Automatic error handling
- Structured logging
- Type-safe assertions
- Consistent error responses

### Gradual Migration Strategy

You don't need to migrate all routes at once. The error handler works alongside existing error handling patterns.

#### Phase 1: Register Middleware (Day 1)

1. Register `errorHandler` middleware in main server file
2. Test that existing routes still work
3. No code changes needed yet

#### Phase 2: New Routes Use New Pattern (Ongoing)

For any new routes you create, use the new pattern from the start.

#### Phase 3: Migrate Existing Routes (As Needed)

Migrate existing routes gradually, starting with the most error-prone or frequently modified routes.

---

## Integration Checklist

- [ ] Register `errorHandler` middleware in main server file (after all routes)
- [ ] Test that server starts successfully
- [ ] Test existing routes still work
- [ ] Create a test route using new pattern to verify error handler works
- [ ] Update any new routes to use new pattern
- [ ] Gradually migrate existing routes (optional but recommended)

### Testing the Integration

Create a test route to verify the error handler is working:

```typescript
// Add this temporary test route
if (process.env.NODE_ENV === 'development') {
  app.get('/api/test-errors/404', asyncHandler(async (req, res) => {
    throw new NotFoundError("Test 404");
  }));

  app.get('/api/test-errors/403', asyncHandler(async (req, res) => {
    throw new ForbiddenError("Test 403");
  }));

  app.get('/api/test-errors/401', asyncHandler(async (req, res) => {
    throw new UnauthorizedError("Test 401");
  }));

  app.get('/api/test-errors/500', asyncHandler(async (req, res) => {
    throw new Error("Test 500");
  }));
}
```

Test the routes:
```bash
curl http://localhost:3000/api/test-errors/404
# Should return: {"message": "Test 404"} with status 404
```

---

## Best Practices

1. **Always use asyncHandler** for async routes to avoid try/catch boilerplate
2. **Use custom error classes** instead of throwing generic Error objects
3. **Use helper functions** (assertFound, assertAuthorized) for cleaner code
4. **Throw errors from services** - let routes focus on HTTP concerns
5. **Provide descriptive error messages** - they're shown to clients
6. **Don't catch errors in routes** - let the error handler deal with them
7. **Use Zod schemas** for validation and let errors bubble up

---

## API Reference

### Error Classes

- `AppError` - Base class for all custom errors
- `NotFoundError(message?)` - 404 errors
- `ForbiddenError(message?)` - 403 errors
- `UnauthorizedError(message?)` - 401 errors
- `BadRequestError(message?)` - 400 errors
- `ConflictError(message?)` - 409 errors

### Middleware

- `errorHandler(err, req, res, next)` - Main error handler middleware
- `asyncHandler(fn)` - Wrapper for async route handlers

### Helper Functions

- `assertFound<T>(value, message?)` - Assert value exists (throws NotFoundError)
- `assertAuthorized(condition, message?)` - Assert condition is true (throws ForbiddenError)
- `assertAuthenticated(value, message?)` - Assert value is truthy (throws UnauthorizedError)
- `validateInput<T>(schema, data)` - Validate with Zod schema (throws ZodError)

### Response Formats

#### Success Response
```json
{
  "id": "123",
  "title": "My Survey",
  "status": "draft"
}
```

#### Error Response (Production)
```json
{
  "message": "Survey not found"
}
```

#### Error Response (Development)
```json
{
  "message": "Survey not found",
  "error": "Survey not found",
  "stack": "Error: Survey not found\n    at ..."
}
```

#### Validation Error Response
```json
{
  "message": "Validation error",
  "error": "Invalid input",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "path": ["title"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

### Automatic Error Classification

For generic Error objects, the middleware automatically classifies based on message content:

**404 Not Found:**
- "not found"
- "does not exist"
- "cannot find"
- "could not find"

**403 Forbidden:**
- "access denied"
- "forbidden"
- "permission denied"
- "not authorized to"
- "you do not own"
- "you are not a member"
- "admin access required"
- "insufficient permissions"

**401 Unauthorized:**
- "unauthorized"
- "no user id"
- "not logged in"
- "authentication required"
- "invalid token"
- "token expired"
- "must be logged in"

### Logging

All errors are automatically logged with request context:

```typescript
// Error log format:
{
  "level": "error",
  "requestId": "abc123",
  "method": "GET",
  "url": "/api/surveys/123",
  "statusCode": 404,
  "userId": "user-123",
  "error": {
    "name": "NotFoundError",
    "message": "Survey not found",
    "stack": "..."
  },
  "msg": "Client error: Survey not found"
}
```

Server errors (500+) are logged at `error` level.
Client errors (400-499) are logged at `warn` level.

### Zod Validation Errors

Zod validation errors are automatically handled and return 400 status with details:

```typescript
app.post('/api/surveys', isAuthenticated, asyncHandler(async (req: any, res) => {
  // If validation fails, error handler returns formatted response automatically
  const data = createSurveySchema.parse(req.body);

  const survey = await createSurvey(data);
  res.json(survey);
}));
```

---

## Troubleshooting

### Error handler not catching errors

Make sure:
1. Error handler is registered AFTER all routes
2. You're using `asyncHandler` wrapper for async routes
3. You're throwing errors (not returning error responses)

### Errors show stack traces in production

Check that `NODE_ENV` is set to `production`. Stack traces are only shown in development mode.

### TypeScript errors with assertFound

Make sure you're using TypeScript 4.0+ which supports assertion signatures:

```typescript
const survey = await getSurvey(id);
assertFound(survey, "Survey not found");
// TypeScript knows survey is not null here
```

---

## Testing

```typescript
import request from 'supertest';
import { NotFoundError } from '../middleware/errorHandler';

describe('Error Handler', () => {
  it('should return 404 for NotFoundError', async () => {
    app.get('/test', asyncHandler(async (req, res) => {
      throw new NotFoundError("Test not found");
    }));

    const response = await request(app)
      .get('/test')
      .expect(404);

    expect(response.body.message).toBe("Test not found");
  });
});
```

---

**Status:** ✅ Implemented and Available
**Last Updated:** 2025-11-07
**Location:** `server/middleware/errorHandler.ts`

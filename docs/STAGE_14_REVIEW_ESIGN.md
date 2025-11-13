# Stage 14: E-Signature Node + Document Review Portal

**Status:** Backend Complete, Frontend Partial
**Last Updated:** November 13, 2025
**Version:** 1.0.0

---

## Overview

Stage 14 adds **human-in-the-loop workflow capabilities** through two new node types:
- **REVIEW Node**: Human review/approval gates
- **ESIGN Node**: Document e-signature workflows

These nodes pause workflow execution and wait for human action (approval or signature) before resuming.

---

## Architecture

### Core Concepts

1. **Waiting States**: Workflows can pause at REVIEW or ESIGN nodes with statuses:
   - `waiting_review`: Awaiting human review decision
   - `waiting_signature`: Awaiting document signature

2. **Resume Mechanism**: After approval/signing, workflow execution resumes from the next node

3. **Token-Based Access**: Signature requests use secure tokens for anonymous signing

4. **Audit Trail**: All review decisions and signature events are logged

---

## Database Schema

### New Enums

```sql
-- Run status additions
ALTER TYPE run_status ADD VALUE 'waiting_review';
ALTER TYPE run_status ADD VALUE 'waiting_signature';

-- Review task status
CREATE TYPE review_task_status AS ENUM (
  'pending',
  'approved',
  'changes_requested',
  'rejected'
);

-- Signature request status
CREATE TYPE signature_request_status AS ENUM (
  'pending',
  'signed',
  'declined',
  'expired'
);

-- Signature provider
CREATE TYPE signature_provider AS ENUM (
  'native',
  'docusign',
  'hellosign'
);

-- Signature event type
CREATE TYPE signature_event_type AS ENUM (
  'sent',
  'viewed',
  'signed',
  'declined'
);
```

### New Tables

#### `review_tasks`
```sql
CREATE TABLE review_tasks (
  id uuid PRIMARY KEY,
  run_id uuid FK -> runs,
  workflow_id uuid FK -> workflows,
  node_id text NOT NULL,
  tenant_id uuid FK -> tenants,
  project_id uuid FK -> projects,
  status review_task_status DEFAULT 'pending',
  reviewer_id varchar FK -> users (nullable),
  reviewer_email varchar(255),
  message text,
  comment text,
  created_at timestamp,
  updated_at timestamp,
  resolved_at timestamp
);
```

**Purpose**: Tracks review tasks for workflow approval gates

**Key Fields**:
- `reviewer_id`: Internal user (null for external reviewers)
- `reviewer_email`: Email for external reviewers
- `comment`: Reviewer's feedback when requesting changes or rejecting

#### `signature_requests`
```sql
CREATE TABLE signature_requests (
  id uuid PRIMARY KEY,
  run_id uuid FK -> runs,
  workflow_id uuid FK -> workflows,
  node_id text NOT NULL,
  tenant_id uuid FK -> tenants,
  project_id uuid FK -> projects,
  signer_email varchar(255) NOT NULL,
  signer_name varchar(255),
  status signature_request_status DEFAULT 'pending',
  provider signature_provider DEFAULT 'native',
  provider_request_id text,
  token text UNIQUE NOT NULL,
  document_url text,
  redirect_url text,
  message text,
  expires_at timestamp NOT NULL,
  created_at timestamp,
  updated_at timestamp,
  signed_at timestamp
);
```

**Purpose**: Tracks e-signature requests

**Key Fields**:
- `token`: Secure random token for signing links
- `provider`: native (MVP), docusign, or hellosign
- `document_url`: URL to document to be signed
- `expires_at`: Token expiration timestamp (default 72 hours)

#### `signature_events`
```sql
CREATE TABLE signature_events (
  id uuid PRIMARY KEY,
  signature_request_id uuid FK -> signature_requests,
  type signature_event_type NOT NULL,
  timestamp timestamp DEFAULT now(),
  payload jsonb
);
```

**Purpose**: Audit log for signature request lifecycle

---

## Backend Implementation

### 1. Engine Nodes

#### REVIEW Node (`/server/engine/nodes/review.ts`)

**Config**:
```typescript
{
  reviewerType: 'internal' | 'external',
  reviewerUserId?: string,
  reviewerEmail?: string,
  message?: string,
  allowEdit?: boolean,           // Reserved for future
  autoApproveIfNoChange?: boolean, // Reserved for future
  condition?: string
}
```

**Behavior**:
- Stores pending review task info in context
- Returns status: 'waiting'
- Service layer creates ReviewTask and updates run status

#### ESIGN Node (`/server/engine/nodes/esign.ts`)

**Config**:
```typescript
{
  signerType: 'internal' | 'external',
  signerEmailVar: string,
  signerNameVar?: string,
  provider: 'native' | 'docusign' | 'hellosign',
  documentOutputRef?: string,
  message?: string,
  redirectUrlAfterSign?: string,
  expiryHours?: number,          // Default 72
  condition?: string
}
```

**Behavior**:
- Resolves signer email/name from context variables
- Resolves document URL from previous node outputs (e.g., Template node)
- Stores pending signature request info in context
- Returns status: 'waiting'

### 2. Repositories

**ReviewTaskRepository** (`/server/repositories/ReviewTaskRepository.ts`):
- `findByRunId(runId)`
- `findByWorkflowId(workflowId)`
- `findByReviewerId(reviewerId)`
- `findPendingByProjectId(projectId)`
- `findByRunAndNode(runId, nodeId)`
- `updateStatus(taskId, status, comment?)`

**SignatureRequestRepository** (`/server/repositories/SignatureRequestRepository.ts`):
- `findByRunId(runId)`
- `findByWorkflowId(workflowId)`
- `findByToken(token)`
- `findByRunAndNode(runId, nodeId)`
- `findPendingByProjectId(projectId)`
- `findExpired()`
- `updateStatus(requestId, status)`
- `createEvent(signatureRequestId, type, payload?)`
- `getEvents(signatureRequestId)`

### 3. Services

**ReviewTaskService** (`/server/services/ReviewTaskService.ts`):
- `createReviewTask(data)` - Create review task
- `getReviewTask(taskId, userId)` - Get task with access control
- `getTasksForReviewer(reviewerId)` - Get user's assigned tasks
- `getPendingTasksByProject(projectId, userId)` - Get project tasks
- `approveTask(taskId, userId, comment?)` - Approve review
- `requestChanges(taskId, userId, comment)` - Request changes
- `rejectTask(taskId, userId, comment?)` - Reject review
- `makeDecision(taskId, userId, decision, comment?)` - Unified decision method

**SignatureRequestService** (`/server/services/SignatureRequestService.ts`):
- `createSignatureRequest(data)` - Create signature request with token
- `getSignatureRequest(requestId, userId)` - Get request (authenticated)
- `getSignatureRequestByToken(token)` - Get request (public, for portal)
- `signDocument(token)` - Sign document
- `declineSignature(token, reason?)` - Decline signature
- `getSignatureEvents(requestId, userId)` - Get event log
- `getPendingRequestsByProject(projectId, userId)` - Get project requests
- `markExpiredRequests()` - Cron job to expire old requests

**Run Resume Mechanism** (`/server/services/runs.ts`):
```typescript
async function resumeRunFromNode(
  runId: string,
  nodeId: string
): Promise<Run>
```
- Verifies run is in waiting state
- Logs resumption
- Parses graph JSON to find next nodes
- **MVP**: Marks run as success (full graph traversal TODO)
- **Production**: Would continue executing subsequent nodes

### 4. API Routes

#### Review Tasks (`/server/routes/reviewTasks.ts`)

```
GET    /api/review/tasks/:id           # Get review task
GET    /api/review/tasks/project/:projectId  # Get project tasks
GET    /api/review/my-tasks             # Get user's assigned tasks
POST   /api/review/tasks/:id/decision  # Make decision
       Body: { decision: 'approved'|'changes_requested'|'rejected', comment?: string }
```

#### Signatures (`/server/routes/signatures.ts`)

```
GET    /api/signatures/requests/:id    # Get signature request (auth)
GET    /api/signatures/requests/project/:projectId  # Get project requests
GET    /api/signatures/requests/:id/events  # Get signature events
GET    /api/sign/:token                 # Get signature request (public)
POST   /api/sign/:token                 # Sign/decline document (public)
       Body: { action: 'sign'|'decline', reason?: string }
```

---

## Frontend Implementation

### 1. Review Portal (`/client/app/review/[taskId]/`)

**NOT YET IMPLEMENTED**

Required components:
- `page.tsx` - Main review portal page
- `ReviewHeader.tsx` - Task status and info
- `DocumentViewer.tsx` - PDF/DOCX viewer
- `DecisionForm.tsx` - Approve/Request Changes/Reject UI
- `hooks/useReviewAPI.ts` - API integration

**Routes**:
- `/review/:taskId` - Review task portal

**Features**:
- Display review task details
- Show generated documents (from Template node outputs)
- Approve/Request Changes/Reject buttons
- Comment field for feedback
- RBAC: Only designated reviewer can make decisions

### 2. E-Signature Portal (`/client/app/sign/[token]/`)

**NOT YET IMPLEMENTED**

Required components:
- `page.tsx` - Main signing portal page
- `SignHeader.tsx` - Signer info and workflow name
- `DocumentViewer.tsx` - Document viewer
- `SignatureForm.tsx` - "I agree" checkbox + Sign button
- `StatusMessage.tsx` - Success/error messages
- `hooks/useSignAPI.ts` - API integration

**Routes**:
- `/sign/:token` - Public signing portal (no auth required)

**Features**:
- Display document to be signed
- Show signer email/name and message
- "I agree" checkbox
- Sign/Decline buttons
- Token expiration handling
- Redirect after signing (if `redirectUrl` provided)

### 3. Builder UI Integration

**NOT YET IMPLEMENTED**

Required updates to Builder (`/client/app/builder/`):

1. Add REVIEW node to node palette
2. Add ESIGN node to node palette
3. Inspector panels for both node types:
   - REVIEW: reviewerType, reviewer selection, message
   - ESIGN: signerEmailVar, signerNameVar, provider, message, expiryHours
4. Visual indicators ("Review" / "E-Sign" badges)
5. Validation warnings (e.g., ESIGN requires prior Template node)

---

## Security

### Review Tasks
- **Authentication**: Requires user session via `requireAuth`
- **Authorization**: Only designated reviewer can make decisions
- **RBAC**: Project-level access control (TODO: Full ACL integration)

### Signature Requests
- **Token Security**:
  - 32-byte cryptographically secure random tokens
  - Base64url encoding (URL-safe)
  - Unique constraint in database
  - Expiration enforcement (default 72 hours)
- **No Authentication**: Public signing links (by design)
- **Rate Limiting**: Should be added to prevent abuse
- **HTTPS**: Required for production to protect tokens in transit

---

## Testing

### Backend Tests (NOT YET IMPLEMENTED)

Required test files:
- `/tests/engine.review-node.test.ts`
  - REVIEW node creates ReviewTask
  - Approving review resumes run
  - Rejecting review fails run
- `/tests/engine.esign-node.test.ts`
  - ESIGN node creates SignatureRequest
  - Signing resumes run
  - Declining fails run
- `/tests/api.review.test.ts`
  - Task retrieval and RBAC
  - Decision making (approve/reject/changes)
  - Invalid decisions
- `/tests/api.sign.test.ts`
  - Token validation
  - Expiry handling
  - Sign/decline flows

### Frontend Tests (NOT YET IMPLEMENTED)

Required test files:
- `/tests/ui.review.portal.test.tsx`
  - Review portal renders correctly
  - Approve/reject flows work
  - Comment validation
- `/tests/ui.sign.portal.test.tsx`
  - Signing portal renders correctly
  - Sign/decline feedback
  - Token expiration handling

---

## Migration Guide

### Database Migration

Run migration:
```bash
npm run db:migrate
```

Or manually:
```bash
psql $DATABASE_URL -f migrations/0015_add_review_and_esign_tables.sql
```

### Code Integration

1. **Register routes** in `/server/index.ts`:
   ```typescript
   import reviewTasksRouter from "./routes/reviewTasks";
   import signaturesRouter from "./routes/signatures";

   app.use("/api/review", reviewTasksRouter);
   app.use("/api/signatures", signaturesRouter);
   app.use("/api", signaturesRouter); // For /api/sign/:token
   ```

2. **Update engine execution** to handle waiting states

3. **Add frontend routes** for review and signing portals

---

## Known Limitations (MVP)

1. **Resume Mechanism**: Simplified implementation
   - Currently marks run as 'success' after approval/signing
   - Does NOT continue executing subsequent nodes
   - Full graph traversal TODO for production

2. **Email Notifications**: Not implemented
   - Should notify reviewers when task is created
   - Should notify signers with signing link
   - Should notify workflow creator of decisions

3. **Document Handling**: Basic
   - Relies on `documentUrl` from previous nodes
   - No built-in PDF generation for ESIGN node
   - Should integrate with Template node outputs

4. **External Providers**: Stubs only
   - DocuSign and HelloSign are placeholders
   - Only 'native' provider is functional

5. **ACL Integration**: Partial
   - Basic project-level checks
   - Full ACL integration with AclService TODO

6. **Signature Canvas**: Not implemented
   - Native provider doesn't include visual signature
   - Just "I agree" checkbox for MVP
   - Visual signature canvas TODO

7. **Multi-Signer**: Not supported
   - ESIGN node only supports single signer
   - Sequential or parallel signing TODO

---

## Future Enhancements

### Short Term
1. Implement email notifications
2. Add signature canvas for native provider
3. Full resume mechanism with graph traversal
4. Complete frontend portals

### Medium Term
1. Multi-signer support (sequential/parallel)
2. Signature field positioning in PDFs
3. DocuSign integration
4. HelloSign integration
5. Review task reassignment
6. Reminder emails for pending tasks

### Long Term
1. Mobile-optimized signing
2. Biometric signatures
3. Advanced audit trail viewer
4. Signature templates
5. Batch signing
6. API webhooks for signature events

---

## API Examples

### Create Review Task (Internal)
```typescript
const task = await reviewTaskService.createReviewTask({
  runId: 'run-uuid',
  workflowId: 'workflow-uuid',
  nodeId: 'review-node-1',
  tenantId: 'tenant-uuid',
  projectId: 'project-uuid',
  status: 'pending',
  reviewerId: 'user-uuid',
  message: 'Please review the compliance checklist',
});
```

### Approve Review
```bash
POST /api/review/tasks/:taskId/decision
{
  "decision": "approved",
  "comment": "Looks good!"
}
```

### Create Signature Request
```typescript
const request = await signatureRequestService.createSignatureRequest({
  runId: 'run-uuid',
  workflowId: 'workflow-uuid',
  nodeId: 'esign-node-1',
  tenantId: 'tenant-uuid',
  projectId: 'project-uuid',
  signerEmail: '[email protected]',
  signerName: 'John Doe',
  status: 'pending',
  provider: 'native',
  documentUrl: 'https://example.com/docs/contract.pdf',
  message: 'Please sign the service agreement',
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
});
```

### Sign Document
```bash
POST /api/sign/:token
{
  "action": "sign"
}
```

---

## Troubleshooting

### Issue: Review task not created
**Symptoms**: REVIEW node executes but no task appears
**Cause**: Node config incomplete or missing required fields
**Fix**: Verify `reviewerType` and corresponding `reviewerId`/`reviewerEmail`

### Issue: Signature link expired
**Symptoms**: Token returns 400 error
**Cause**: `expiresAt` timestamp passed
**Fix**: Regenerate signature request with new token

### Issue: Workflow not resuming
**Symptoms**: Task approved but run stays in waiting state
**Cause**: Resume mechanism not called or failed
**Fix**: Check logs for `resumeRunFromNode` errors

### Issue: Token not found
**Symptoms**: Invalid signature link error
**Cause**: Token invalid or database issue
**Fix**: Verify token exists in `signature_requests` table

---

## Resources

### Documentation
- [Workflow Engine Architecture](./WORKFLOW_ENGINE.md)
- [Run Architecture](./RUNS_ARCHITECTURE.md)
- [API Reference](./api/API.md)

### Related Stages
- **Stage 6**: Template Node (document generation)
- **Stage 9**: HTTP Node + Secrets (external integrations)
- **Stage 13**: Publishing & Versioning

---

**Document Maintainer:** Development Team
**Review Cycle:** Monthly
**Next Review:** December 13, 2025

**For questions or issues:** Create a GitHub issue with label `stage-14`

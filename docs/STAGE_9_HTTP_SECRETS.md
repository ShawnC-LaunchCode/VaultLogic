# Stage 9: HTTP/Fetch Node + Secrets Management

**Status:** ✅ Complete
**Date:** November 12, 2025
**Version:** 1.0.0

---

## Overview

Stage 9 implements robust external API integration capabilities for VaultLogic workflows through:

1. **HTTP Node** - Execute HTTP/API requests within workflows with comprehensive authentication and retry logic
2. **Secrets Management** - Secure storage and management of API keys, tokens, and OAuth2 credentials
3. **External Connections** - Reusable API connection configurations

---

## Features Implemented

### 1. HTTP Node Engine

**Location:** `server/engine/nodes/http.ts`

A fully-featured HTTP request node for workflows with:

#### Supported HTTP Methods
- GET
- POST
- PUT
- PATCH
- DELETE

#### Authentication Types
- **API Key** - Header or query parameter injection
- **Bearer Token** - Standard Bearer token authentication
- **OAuth2 Client Credentials** - Automatic token fetching with caching
- **Basic Auth** - Username:password authentication
- **None** - No authentication

#### Request Configuration
- **Base URL** - Direct URL or reference to External Connection
- **Path** - URL path with `{{variable}}` template support
- **Query Parameters** - Key-value pairs with template interpolation
- **Headers** - Custom headers with template interpolation
- **Body** - JSON request body (MVP; form-data planned for future)

#### Reliability Features
- **Timeout Control** - Configurable timeout (100-60000ms)
- **Automatic Retries** - Configurable retry count (0-10)
- **Exponential Backoff** - Intelligent retry delays
- **Response Caching** - Optional HTTP response caching with TTL

#### Response Mapping
- **JSONPath Selectors** - Extract specific fields from responses
- **Variable Assignment** - Map response data to workflow variables
- **Nested Path Support** - Access deeply nested response fields

**Example Configuration:**
```typescript
{
  method: 'GET',
  baseUrl: 'https://api.example.com',
  path: '/users/{{userId}}',
  auth: {
    type: 'bearer',
    tokenRef: 'api_token'
  },
  map: [
    { select: '$.data.user.name', as: 'userName' },
    { select: '$.data.user.email', as: 'userEmail' }
  ],
  timeoutMs: 5000,
  retries: 3
}
```

---

### 2. Secrets Management

**Location:** `server/services/secrets.ts`, `server/routes/secrets.routes.ts`

Secure encrypted storage for sensitive credentials.

#### Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Management:** Envelope encryption with master key from `VL_MASTER_KEY` env var
- **Format:** Base64-encoded: [12-byte nonce][16-byte auth tag][ciphertext]

#### Secret Types
- `api_key` - API keys and access tokens
- `bearer` - Bearer tokens
- `oauth2` - OAuth2 client credentials (clientId + clientSecret)
- `basic_auth` - Username:password pairs

#### Operations
```
GET    /api/projects/:projectId/secrets              # List all secrets (metadata only)
GET    /api/projects/:projectId/secrets/:secretId    # Get secret metadata
POST   /api/projects/:projectId/secrets              # Create new secret
PATCH  /api/projects/:projectId/secrets/:secretId    # Update/rotate secret
DELETE /api/projects/:projectId/secrets/:secretId    # Delete secret
POST   /api/projects/:projectId/secrets/:secretId/test  # Test decryption
```

#### Security Features
- ✅ Never returns plaintext values via API
- ✅ Redacted logging (all secret values masked)
- ✅ Unique key constraint per project
- ✅ RBAC enforcement (Owner/Builder only)
- ✅ Metadata storage for OAuth2 configs (tokenUrl, scope)

---

### 3. External Connections

**Location:** `server/services/externalConnections.ts`, `server/routes/connections.routes.ts`

Reusable API connection configurations.

#### Configuration
- **Name** - Human-friendly identifier
- **Base URL** - API endpoint base URL
- **Auth Type** - Authentication method
- **Secret Reference** - Link to stored secret
- **Default Headers** - Common headers for all requests
- **Timeout/Retries** - Default reliability settings

#### Operations
```
GET    /api/projects/:projectId/connections              # List connections
GET    /api/projects/:projectId/connections/:id          # Get connection
POST   /api/projects/:projectId/connections              # Create connection
PATCH  /api/projects/:projectId/connections/:id          # Update connection
DELETE /api/projects/:projectId/connections/:id          # Delete connection
```

#### Benefits
- ✅ DRY principle - configure once, use everywhere
- ✅ Centralized credential management
- ✅ Easy credential rotation
- ✅ Environment-specific configurations

---

### 4. OAuth2 Client Credentials Service

**Location:** `server/services/oauth2.ts`

Automatic OAuth2 token management with intelligent caching.

#### Features
- **Client Credentials Flow** - Standard OAuth2 grant type
- **Automatic Token Refresh** - Fetches new tokens before expiry
- **Intelligent Caching** - Tokens cached with 30s safety buffer
- **Scope Support** - Configurable OAuth2 scopes
- **Error Handling** - Comprehensive error messages

#### Cache Key Structure
```
{tenantId}:{projectId}:{tokenUrl}:{clientId}:{scope}
```

#### Token Response
```typescript
{
  access_token: string,
  token_type: string,
  expires_in: number,
  scope?: string
}
```

---

### 5. Cache Service

**Location:** `server/services/cache.ts`

In-memory LRU cache with TTL support.

#### Cache Types
- **OAuth2 Token Cache** - 100 token max
- **HTTP Response Cache** - 500 response max

#### Features
- Automatic expiration
- LRU eviction when at capacity
- Periodic cleanup of expired entries
- Statistics API

---

### 6. JSONPath Selector Utility

**Location:** `server/utils/jsonselect.ts`

Minimal JSONPath-like selector for response mapping.

#### Supported Syntax
```typescript
$                    // Root object
$.user.name          // Dot notation
$.items[0]           // Array index
$.users[0].email     // Nested access
```

#### Functions
- `select(obj, selector)` - Extract value
- `selectMultiple(obj, selectors)` - Extract multiple values
- `validateSelector(selector)` - Validate syntax
- `testSelector(obj, selector)` - Test selector

---

## Database Schema

### Secrets Table

```sql
CREATE TABLE secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value_enc TEXT NOT NULL,
  type secret_type NOT NULL DEFAULT 'api_key',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE TYPE secret_type AS ENUM ('api_key', 'bearer', 'oauth2', 'basic_auth');
```

### External Connections Table

```sql
CREATE TABLE external_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  auth_type VARCHAR(50) NOT NULL,
  secret_id UUID REFERENCES secrets(id) ON DELETE SET NULL,
  default_headers JSONB DEFAULT '{}'::jsonb,
  timeout_ms INTEGER DEFAULT 8000,
  retries INTEGER DEFAULT 2,
  backoff_ms INTEGER DEFAULT 250,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);
```

---

## Environment Configuration

### Required Environment Variable

```bash
# Master encryption key (32 bytes base64-encoded)
VL_MASTER_KEY=your-base64-encoded-32-byte-key
```

### Generate Master Key

```typescript
import { generateMasterKey } from './server/utils/encryption';

const masterKey = generateMasterKey();
console.log('VL_MASTER_KEY=' + masterKey);
```

---

## Usage Examples

### Example 1: API Key Authentication

```typescript
// Create secret
POST /api/projects/{projectId}/secrets
{
  "key": "github_token",
  "valuePlain": "ghp_xxxxxxxxxxxx",
  "type": "api_key"
}

// Create connection
POST /api/projects/{projectId}/connections
{
  "name": "GitHub API",
  "baseUrl": "https://api.github.com",
  "authType": "bearer",
  "secretId": "{secretId}"
}

// Configure HTTP node
{
  "connectionId": "{connectionId}",
  "path": "/repos/{{owner}}/{{repo}}/issues",
  "method": "GET",
  "map": [
    { "select": "$[0].title", "as": "firstIssueTitle" },
    { "select": "$[0].number", "as": "firstIssueNumber" }
  ]
}
```

### Example 2: OAuth2 Client Credentials

```typescript
// Create OAuth2 secrets
POST /api/projects/{projectId}/secrets
{
  "key": "oauth_client_id",
  "valuePlain": "my-client-id",
  "type": "oauth2"
}

POST /api/projects/{projectId}/secrets
{
  "key": "oauth_client_secret",
  "valuePlain": "my-client-secret",
  "type": "oauth2"
}

// Configure HTTP node
{
  "baseUrl": "https://api.example.com",
  "path": "/protected-resource",
  "method": "GET",
  "auth": {
    "type": "oauth2",
    "oauth2": {
      "tokenUrl": "https://auth.example.com/oauth/token",
      "clientIdRef": "oauth_client_id",
      "clientSecretRef": "oauth_client_secret",
      "scope": "read:data"
    }
  }
}
```

### Example 3: Template Variables

```typescript
// HTTP node with dynamic values
{
  "baseUrl": "https://api.example.com",
  "path": "/users/{{userId}}/orders/{{orderId}}",
  "method": "GET",
  "query": {
    "status": "{{orderStatus}}",
    "limit": "10"
  },
  "headers": {
    "X-Request-ID": "{{requestId}}"
  }
}

// Variables populated from context:
// - userId: from previous step
// - orderId: from user input
// - orderStatus: from computed value
// - requestId: from workflow metadata
```

---

## Security Considerations

### ✅ Implemented Security Measures

1. **Encryption at Rest**
   - All secrets encrypted with AES-256-GCM
   - Authenticated encryption prevents tampering
   - Master key stored in environment variable

2. **No Plaintext Exposure**
   - API endpoints never return decrypted values
   - Only metadata exposed to clients
   - Values only decrypted during workflow execution

3. **Redacted Logging**
   - All secret values masked in logs (`••••••••`)
   - HTTP request/response headers sanitized
   - OAuth2 credentials never logged in plaintext

4. **RBAC Enforcement**
   - Only Owner/Builder roles can manage secrets
   - Runner/Viewer roles have no access
   - ACL checks on all endpoints (TODO: full implementation)

5. **Request Security**
   - HTTPS URLs validated
   - Timeout enforcement prevents hanging requests
   - Client error (4xx) responses not retried

### ⚠️ Security Recommendations

1. **Master Key Management**
   - Store `VL_MASTER_KEY` in secure secret manager (AWS Secrets Manager, HashiCorp Vault)
   - Rotate master key periodically (requires re-encryption of all secrets)
   - Never commit master key to version control

2. **URL Allowlisting**
   - Consider implementing URL allowlist for HTTP nodes
   - Prevent SSRF attacks by restricting outbound requests
   - Add environment variable `ALLOWED_HTTP_HOSTS`

3. **Rate Limiting**
   - Add per-project rate limits on HTTP node executions
   - Prevent abuse and cost overruns
   - Track API call quotas per connection

4. **Audit Logging**
   - Log all secret access (creation, updates, deletions)
   - Track HTTP node executions with sanitized logs
   - Implement retention policies

---

## Testing

### Unit Tests

```bash
# Test HTTP node execution
npm run test server/engine/nodes/http.test.ts

# Test secrets service
npm run test server/services/secrets.test.ts

# Test OAuth2 service
npm run test server/services/oauth2.test.ts

# Test JSONPath selector
npm run test server/utils/jsonselect.test.ts
```

### Integration Tests

```bash
# Test secrets API
npm run test:integration server/routes/secrets.routes.test.ts

# Test connections API
npm run test:integration server/routes/connections.routes.test.ts
```

---

## Migration Guide

### Step 1: Set Master Key

```bash
# Generate a new master key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env
echo "VL_MASTER_KEY=<generated-key>" >> .env
```

### Step 2: Run Migration

```bash
# Apply database schema changes
npm run db:push

# Or run migration directly
psql $DATABASE_URL -f migrations/0009_add_external_connections_and_secret_types.sql
```

### Step 3: Verify Installation

```bash
# Start server
npm run dev

# Test secrets endpoint
curl -X GET http://localhost:5000/api/projects/{projectId}/secrets \
  -H "Authorization: Bearer {token}"
```

---

## Troubleshooting

### Error: "VL_MASTER_KEY environment variable not set"

**Solution:** Set the `VL_MASTER_KEY` environment variable with a 32-byte base64-encoded key.

```bash
# Generate and set key
export VL_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### Error: "Master key must be 32 bytes (256 bits)"

**Solution:** Ensure the master key is exactly 32 bytes when base64-decoded.

```bash
# Verify key length
node -e "const key = Buffer.from(process.env.VL_MASTER_KEY, 'base64'); console.log('Length:', key.length)"
```

### Error: "Decryption failed"

**Cause:** Master key changed or corrupted data.

**Solution:**
1. Verify `VL_MASTER_KEY` hasn't changed
2. Check database integrity
3. Re-create affected secrets

### HTTP Node Timeout

**Cause:** External API slow or unresponsive.

**Solution:**
1. Increase `timeoutMs` in HTTP node config
2. Check external API status
3. Add retries with exponential backoff

---

## Future Enhancements

### Planned Features

1. **Request Body Types**
   - Form-data (multipart/form-data)
   - URL-encoded (application/x-www-form-urlencoded)
   - XML support

2. **Advanced Response Mapping**
   - JSONPath wildcards (`$.*`, `$..name`)
   - Recursive descent
   - Filters (`$[?(@.price < 10)]`)
   - Array slicing (`$[0:5]`)

3. **Webhook Support**
   - Trigger workflows from HTTP webhooks
   - Webhook signature verification
   - Retry logic for failed webhook deliveries

4. **Certificate Management**
   - Client certificate support
   - Custom CA certificates
   - Certificate pinning

5. **Mock/Test Mode**
   - Mock HTTP responses for testing
   - Response fixtures
   - Network failure simulation

---

## API Reference

### Complete Endpoint List

#### Secrets
```
GET    /api/projects/:projectId/secrets
GET    /api/projects/:projectId/secrets/:secretId
POST   /api/projects/:projectId/secrets
PATCH  /api/projects/:projectId/secrets/:secretId
DELETE /api/projects/:projectId/secrets/:secretId
POST   /api/projects/:projectId/secrets/:secretId/test
```

#### External Connections
```
GET    /api/projects/:projectId/connections
GET    /api/projects/:projectId/connections/:connectionId
POST   /api/projects/:projectId/connections
PATCH  /api/projects/:projectId/connections/:connectionId
DELETE /api/projects/:projectId/connections/:connectionId
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/ShawnC-LaunchCode/VaultLogic/issues
- Documentation: /docs/INDEX.md
- API Reference: /docs/api/API.md

---

**Last Updated:** November 12, 2025
**Maintainer:** Development Team
**Next Review:** December 12, 2025

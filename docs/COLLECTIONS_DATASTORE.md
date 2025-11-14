# Collections / Datastore System

**Stage 19: Collections / Datastore**
**Status:** Complete
**Last Updated:** November 14, 2025

## Overview

The Collections/Datastore system provides a flexible, schema-driven database layer within VaultLogic, similar to Airtable bases, Retool resources, Afterpattern collections, and Notion databases. It allows users to define custom data structures (collections) with typed fields and store records that conform to those schemas.

### Key Features

- **Schema-driven collections** with customizable fields
- **9 field types** supporting diverse data models
- **CRUD operations** for collections, fields, and records
- **Workflow integration** via blocks (prefill, save, query, delete)
- **Multi-tenant architecture** with tenant-scoped data
- **Auto-generated slugs** for collections and fields
- **Type-safe API** with comprehensive validation
- **Real-time stats** (field count, record count)

---

## Architecture

### Data Model

```
Tenant
  └── Collection (e.g., "Customers", "Products")
        ├── Fields (schema definition)
        │     ├── Field 1: name, slug, type, options, defaultValue, isRequired
        │     ├── Field 2: ...
        │     └── Field N: ...
        └── Records (data instances)
              ├── Record 1: { fieldSlug: value, ... }
              ├── Record 2: { fieldSlug: value, ... }
              └── Record N: { fieldSlug: value, ... }
```

### Database Schema

**Collections Table** (`collections`)
- `id` (uuid, PK)
- `tenantId` (uuid, FK → tenants.id)
- `name` (varchar) - Human-readable name
- `slug` (varchar) - URL-safe identifier (auto-generated)
- `description` (text, nullable)
- `createdAt`, `updatedAt` (timestamps)
- **Unique constraint:** (tenantId, slug)

**Collection Fields Table** (`collection_fields`)
- `id` (uuid, PK)
- `collectionId` (uuid, FK → collections.id, cascade delete)
- `name` (varchar) - Human-readable name
- `slug` (varchar) - Underscore-separated identifier (auto-generated)
- `type` (field_type_enum) - Field data type
- `isRequired` (boolean) - Validation flag
- `options` (jsonb) - For select/multi_select types
- `defaultValue` (jsonb) - Default value for new records
- `order` (integer) - Display order
- `createdAt`, `updatedAt` (timestamps)
- **Unique constraint:** (collectionId, slug)

**Records Table** (`records`)
- `id` (uuid, PK)
- `collectionId` (uuid, FK → collections.id, cascade delete)
- `tenantId` (uuid, FK → tenants.id, for direct queries)
- `data` (jsonb) - Schemaless record data
- `createdAt`, `updatedAt` (timestamps)
- **Indexes:** collectionId, tenantId, data (GIN)

---

## Field Types

### Supported Types

| Type | Description | Example Value |
|------|-------------|---------------|
| `text` | Short or long text | `"John Doe"` |
| `number` | Numeric values | `42` |
| `boolean` | True/false flags | `true` |
| `date` | Date only (YYYY-MM-DD) | `"2025-11-14"` |
| `datetime` | Date and time | `"2025-11-14T10:30:00Z"` |
| `file` | File path or URL | `"/uploads/doc.pdf"` |
| `select` | Single choice from options | `"active"` |
| `multi_select` | Multiple choices | `["tag1", "tag2"]` |
| `json` | Arbitrary JSON object | `{"nested": "data"}` |

### Field Configuration

```typescript
{
  name: "Status",           // Human-readable name
  slug: "status",           // Auto-generated (or custom)
  type: "select",           // One of 9 types
  isRequired: true,         // Validation
  options: ["active", "inactive", "pending"], // For select/multi_select
  defaultValue: "pending",  // Default for new records
  order: 0                  // Display order
}
```

---

## API Reference

### Collections

**Create Collection**
```http
POST /api/tenants/:tenantId/collections
Content-Type: application/json

{
  "name": "Customers",
  "description": "Customer database",
  "slug": "customers"  // Optional, auto-generated if omitted
}
```

**List Collections**
```http
GET /api/tenants/:tenantId/collections?withStats=true
```

Response (with stats):
```json
[
  {
    "id": "uuid",
    "name": "Customers",
    "slug": "customers",
    "description": "Customer database",
    "tenantId": "uuid",
    "fieldCount": 5,
    "recordCount": 142,
    "createdAt": "2025-11-14T10:00:00Z",
    "updatedAt": "2025-11-14T10:00:00Z"
  }
]
```

**Get Collection**
```http
GET /api/tenants/:tenantId/collections/:collectionId?withStats=true
```

**Update Collection**
```http
PATCH /api/tenants/:tenantId/collections/:collectionId
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Delete Collection**
```http
DELETE /api/tenants/:tenantId/collections/:collectionId
```

### Fields

**Create Field**
```http
POST /api/tenants/:tenantId/collections/:collectionId/fields
Content-Type: application/json

{
  "name": "Email Address",
  "type": "text",
  "isRequired": true,
  "slug": "email_address"  // Optional, auto-generated if omitted
}
```

**List Fields**
```http
GET /api/tenants/:tenantId/collections/:collectionId/fields
```

**Update Field**
```http
PATCH /api/tenants/:tenantId/collections/:collectionId/fields/:fieldId
Content-Type: application/json

{
  "name": "Email",
  "isRequired": false
}
```

**Delete Field**
```http
DELETE /api/tenants/:tenantId/collections/:collectionId/fields/:fieldId
```

**Bulk Create Fields**
```http
POST /api/tenants/:tenantId/collections/:collectionId/fields/bulk
Content-Type: application/json

{
  "fields": [
    { "name": "First Name", "type": "text", "isRequired": true },
    { "name": "Last Name", "type": "text", "isRequired": true },
    { "name": "Age", "type": "number", "isRequired": false }
  ]
}
```

### Records

**Create Record**
```http
POST /api/tenants/:tenantId/collections/:collectionId/records
Content-Type: application/json

{
  "data": {
    "first_name": "John",
    "last_name": "Doe",
    "email_address": "john@example.com",
    "age": 30,
    "status": "active",
    "is_premium": true
  }
}
```

**List Records**
```http
GET /api/tenants/:tenantId/collections/:collectionId/records?page=1&limit=50
```

Response:
```json
{
  "records": [
    {
      "id": "uuid",
      "collectionId": "uuid",
      "tenantId": "uuid",
      "data": {
        "first_name": "John",
        "email_address": "john@example.com",
        "age": 30
      },
      "createdAt": "2025-11-14T10:00:00Z",
      "updatedAt": "2025-11-14T10:00:00Z"
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

**Get Record**
```http
GET /api/tenants/:tenantId/collections/:collectionId/records/:recordId
```

**Update Record**
```http
PATCH /api/tenants/:tenantId/collections/:collectionId/records/:recordId
Content-Type: application/json

{
  "data": {
    "age": 31,
    "status": "inactive"
  }
}
```

**Delete Record**
```http
DELETE /api/tenants/:tenantId/collections/:collectionId/records/:recordId
```

**Query Records**
```http
POST /api/tenants/:tenantId/collections/:collectionId/records/query
Content-Type: application/json

{
  "filters": {
    "status": "active",
    "is_premium": true
  },
  "page": 1,
  "limit": 50
}
```

**Count Records**
```http
POST /api/tenants/:tenantId/collections/:collectionId/records/count
Content-Type: application/json

{
  "filters": {
    "status": "active"
  }
}
```

---

## Workflow Integration

Collections can be integrated into workflows using **collection blocks**. These blocks execute at various workflow phases and interact with collection data.

### Block Types

#### 1. CREATE_RECORD Block

Creates a new record in a collection.

**Configuration:**
```typescript
{
  type: "create_record",
  phase: "onSectionSubmit",  // or "onRunComplete"
  config: {
    collectionId: "uuid",
    fieldMap: {
      "first_name": "firstName",  // fieldSlug → stepAlias
      "email": "emailAddress",
      "age": "userAge"
    },
    outputKey: "customerId"  // Optional: store created record ID
  }
}
```

**Behavior:**
- Executes at specified phase
- Resolves tenantId from workflow
- Maps step values to collection fields
- Creates record in collection
- Optionally stores record ID in workflow data

#### 2. UPDATE_RECORD Block

Updates an existing record.

**Configuration:**
```typescript
{
  type: "update_record",
  phase: "onSectionSubmit",
  config: {
    collectionId: "uuid",
    recordIdKey: "customerId",  // Step alias containing record ID
    fieldMap: {
      "status": "orderStatus",
      "total": "orderTotal"
    }
  }
}
```

**Behavior:**
- Retrieves record ID from workflow data
- Maps step values to update fields
- Updates record in collection

#### 3. FIND_RECORD Block

Queries records and stores results in workflow data.

**Configuration:**
```typescript
{
  type: "find_record",
  phase: "onRunStart",  // Prefill data
  config: {
    collectionId: "uuid",
    filters: {
      "email": "{{userEmail}}",  // Template variable interpolation
      "status": "active"
    },
    limit: 1,  // Single record or array
    outputKey: "customer",  // Where to store result
    failIfNotFound: false  // Optional: fail workflow if no match
  }
}
```

**Behavior:**
- Queries records with filters
- Returns single record (limit=1) or array
- Stores result in workflow data
- Optionally fails if no records found

#### 4. DELETE_RECORD Block

Deletes a record from a collection.

**Configuration:**
```typescript
{
  type: "delete_record",
  phase: "onRunComplete",
  config: {
    collectionId: "uuid",
    recordIdKey: "tempRecordId"  // Step alias containing record ID
  }
}
```

**Behavior:**
- Retrieves record ID from workflow data
- Deletes record from collection

### Execution Phases

Blocks can execute at different workflow phases:

- **onRunStart** - Run creation (prefill data)
- **onSectionEnter** - Entering a section
- **onSectionSubmit** - Submitting a section (save data)
- **onNext** - Navigating to next section
- **onRunComplete** - Workflow completion (final save)

---

## Code Examples

### Service Layer Usage

```typescript
import { collectionService } from './services/CollectionService';
import { collectionFieldService } from './services/CollectionFieldService';
import { recordService } from './services/RecordService';

// Create a collection
const collection = await collectionService.createCollection(tenantId, {
  name: 'Customers',
  description: 'Customer database',
});

// Add fields
await collectionFieldService.createField(tenantId, collection.id, {
  name: 'First Name',
  type: 'text',
  isRequired: true,
});

await collectionFieldService.createField(tenantId, collection.id, {
  name: 'Email',
  type: 'text',
  isRequired: true,
});

// Create a record
const record = await recordService.createRecord(tenantId, collection.id, {
  first_name: 'John',
  email: 'john@example.com',
});

// Query records
const results = await recordService.findByFilters(
  tenantId,
  collection.id,
  { email: 'john@example.com' },
  { page: 1, limit: 10 }
);

// Update record
await recordService.updateRecord(
  tenantId,
  collection.id,
  record.id,
  { first_name: 'Jane' }
);

// Delete record
await recordService.deleteRecord(tenantId, collection.id, record.id);
```

### React Frontend Usage

```tsx
import {
  useCollections,
  useCreateCollection,
  useCollectionFields,
  useCreateCollectionField,
  useCollectionRecords,
  useCreateCollectionRecord,
} from '@/lib/vault-hooks';

function CollectionManager() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // List collections
  const { data: collections } = useCollections(tenantId, true);

  // Create collection mutation
  const createCollection = useCreateCollection();

  const handleCreate = async () => {
    await createCollection.mutateAsync({
      tenantId,
      name: 'Products',
      description: 'Product catalog',
    });
  };

  return (
    <div>
      {collections?.map(collection => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
      <button onClick={handleCreate}>Create Collection</button>
    </div>
  );
}
```

---

## Best Practices

### Slug Generation

- **Collections:** Use dashes (e.g., `customer-orders`)
- **Fields:** Use underscores (e.g., `email_address`)
- Auto-generated slugs handle name collisions with numeric suffixes

### Field Design

1. **Use required fields sparingly** - Only for critical data
2. **Provide defaults** - Especially for select/boolean fields
3. **Keep options concise** - For select/multi_select types
4. **Use appropriate types** - number for numeric operations, text for strings

### Record Data

1. **Use field slugs as keys** - Not field names
2. **Validate data types** - Match field type expectations
3. **Handle nulls** - Optional fields may be undefined
4. **Avoid deeply nested JSON** - Keep json fields flat when possible

### Workflow Integration

1. **Use onRunStart for prefill** - Load existing data
2. **Use onSectionSubmit for incremental saves** - Save as user progresses
3. **Use onRunComplete for final saves** - Commit all data at once
4. **Name output keys clearly** - Use descriptive step aliases

---

## Troubleshooting

### Common Issues

**Issue:** "Collection slug already exists"
**Solution:** Use a different name or provide a custom slug

**Issue:** "Required field missing"
**Solution:** Ensure all required fields are provided in record data

**Issue:** "Record not found"
**Solution:** Verify tenantId, collectionId, and recordId are correct

**Issue:** "Workflow block fails to resolve tenantId"
**Solution:** Ensure workflow has a projectId and project has a tenantId

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

Check block execution:
```typescript
logger.info({ tenantId, collectionId, data }, "Creating record via block");
```

---

## Migration Guide

### From Legacy Surveys

If migrating from surveys to collections:

1. Create a collection for each survey type
2. Map survey questions to collection fields
3. Import survey responses as records
4. Update workflows to use collection blocks

### From External Systems

1. Create collections matching external schema
2. Use bulk field creation API
3. Import records via POST API
4. Map external IDs to record IDs

---

## Performance Considerations

- **Indexes:** Records have GIN index on `data` for fast JSONB queries
- **Pagination:** Always use page/limit for large datasets
- **Filtering:** Use indexed fields (tenantId, collectionId) first
- **Cascade Deletes:** Deleting collections removes all fields and records

---

## Security

- **Multi-tenant isolation:** All queries filtered by tenantId
- **RBAC:** Owner/Builder roles required for modifications
- **Input validation:** Zod schemas validate all inputs
- **SQL injection protection:** Drizzle ORM parameterization

---

## Future Enhancements

- [ ] Advanced filtering (AND/OR logic)
- [ ] Relationships between collections (foreign keys)
- [ ] Computed fields (formulas)
- [ ] Versioning and audit trails
- [ ] Export to CSV/Excel
- [ ] Import from CSV/Excel
- [ ] Real-time updates (WebSocket)
- [ ] Collection templates

---

## Related Documentation

- [Workflow Blocks](./WORKFLOW_BLOCKS.md)
- [API Reference](./api/API.md)
- [Testing Guide](./testing/TESTING.md)
- [Database Schema](./SCHEMA.md)

---

**Last Updated:** November 14, 2025
**Maintainer:** VaultLogic Development Team

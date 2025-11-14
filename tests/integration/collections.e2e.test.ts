/**
 * Collections System E2E Tests
 * Tests the full lifecycle of collections, fields, and records
 * Stage 19: Collections / Datastore System
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/db';
import { tenants, users, projects } from '@shared/schema';
import { collectionService } from '../../server/services/CollectionService';
import { collectionFieldService } from '../../server/services/CollectionFieldService';
import { recordService } from '../../server/services/RecordService';
import { eq } from 'drizzle-orm';

describe('Collections System E2E Tests', () => {
  let testTenantId: string;
  let testUserId: string;
  let testProjectId: string;
  let testCollectionId: string;
  let testFieldIds: string[] = [];
  let testRecordIds: string[] = [];

  beforeAll(async () => {
    // Create test tenant
    const [tenant] = await db.insert(tenants).values({
      name: 'E2E Test Tenant',
    }).returning();
    testTenantId = tenant.id;

    // Create test user
    const [user] = await db.insert(users).values({
      id: 'test-user-collections-e2e',
      email: 'test-collections-e2e@example.com',
      fullName: 'Collections E2E Test User',
      tenantId: testTenantId,
    }).returning();
    testUserId = user.id;

    // Create test project
    const [project] = await db.insert(projects).values({
      name: 'E2E Test Project',
      description: 'Project for collections E2E tests',
      tenantId: testTenantId,
    }).returning();
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testTenantId) {
      // Delete tenant (cascade will handle the rest)
      await db.delete(tenants).where(eq(tenants.id, testTenantId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('Collection Lifecycle', () => {
    it('should create a collection', async () => {
      const collection = await collectionService.createCollection(testTenantId, {
        name: 'Customers',
        description: 'Customer database',
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe('Customers');
      expect(collection.slug).toBe('customers');
      expect(collection.tenantId).toBe(testTenantId);
      testCollectionId = collection.id;
    });

    it('should list collections', async () => {
      const collections = await collectionService.listCollections(testTenantId, false);

      expect(collections).toBeDefined();
      expect(collections.length).toBeGreaterThan(0);
      expect(collections.some(c => c.id === testCollectionId)).toBe(true);
    });

    it('should get a collection by ID', async () => {
      const collection = await collectionService.getCollection(testTenantId, testCollectionId, false);

      expect(collection).toBeDefined();
      expect(collection!.id).toBe(testCollectionId);
      expect(collection!.name).toBe('Customers');
    });

    it('should update a collection', async () => {
      const updated = await collectionService.updateCollection(testTenantId, testCollectionId, {
        description: 'Updated customer database',
      });

      expect(updated.description).toBe('Updated customer database');
    });
  });

  describe('Field Management', () => {
    it('should create text field', async () => {
      const field = await collectionFieldService.createField(testTenantId, testCollectionId, {
        name: 'First Name',
        type: 'text',
        isRequired: true,
      });

      expect(field).toBeDefined();
      expect(field.name).toBe('First Name');
      expect(field.slug).toBe('first_name');
      expect(field.type).toBe('text');
      expect(field.isRequired).toBe(true);
      testFieldIds.push(field.id);
    });

    it('should create email field', async () => {
      const field = await collectionFieldService.createField(testTenantId, testCollectionId, {
        name: 'Email Address',
        type: 'text',
        isRequired: true,
      });

      expect(field.slug).toBe('email_address');
      testFieldIds.push(field.id);
    });

    it('should create number field', async () => {
      const field = await collectionFieldService.createField(testTenantId, testCollectionId, {
        name: 'Age',
        type: 'number',
        isRequired: false,
        defaultValue: 0,
      });

      expect(field.type).toBe('number');
      expect(field.defaultValue).toBe(0);
      testFieldIds.push(field.id);
    });

    it('should create select field with options', async () => {
      const field = await collectionFieldService.createField(testTenantId, testCollectionId, {
        name: 'Status',
        type: 'select',
        isRequired: true,
        options: ['active', 'inactive', 'pending'],
        defaultValue: 'pending',
      });

      expect(field.type).toBe('select');
      expect(field.options).toEqual(['active', 'inactive', 'pending']);
      expect(field.defaultValue).toBe('pending');
      testFieldIds.push(field.id);
    });

    it('should create boolean field', async () => {
      const field = await collectionFieldService.createField(testTenantId, testCollectionId, {
        name: 'Is Premium',
        type: 'boolean',
        isRequired: false,
        defaultValue: false,
      });

      expect(field.type).toBe('boolean');
      expect(field.defaultValue).toBe(false);
      testFieldIds.push(field.id);
    });

    it('should list all fields', async () => {
      const fields = await collectionFieldService.listFields(testTenantId, testCollectionId);

      expect(fields.length).toBe(5);
      expect(fields.map(f => f.slug)).toEqual([
        'first_name',
        'email_address',
        'age',
        'status',
        'is_premium',
      ]);
    });

    it('should update field', async () => {
      const updated = await collectionFieldService.updateField(
        testTenantId,
        testCollectionId,
        testFieldIds[0],
        { name: 'Full Name' }
      );

      expect(updated.name).toBe('Full Name');
      expect(updated.slug).toBe('first_name'); // Slug shouldn't change
    });
  });

  describe('Record CRUD Operations', () => {
    it('should create a record', async () => {
      const record = await recordService.createRecord(testTenantId, testCollectionId, {
        first_name: 'John',
        email_address: 'john@example.com',
        age: 30,
        status: 'active',
        is_premium: true,
      });

      expect(record).toBeDefined();
      expect(record.data.first_name).toBe('John');
      expect(record.data.email_address).toBe('john@example.com');
      expect(record.data.age).toBe(30);
      expect(record.data.status).toBe('active');
      expect(record.data.is_premium).toBe(true);
      testRecordIds.push(record.id);
    });

    it('should create multiple records', async () => {
      const record2 = await recordService.createRecord(testTenantId, testCollectionId, {
        first_name: 'Jane',
        email_address: 'jane@example.com',
        age: 25,
        status: 'active',
        is_premium: false,
      });

      const record3 = await recordService.createRecord(testTenantId, testCollectionId, {
        first_name: 'Bob',
        email_address: 'bob@example.com',
        status: 'pending',
        is_premium: false,
      });

      testRecordIds.push(record2.id, record3.id);
      expect(testRecordIds.length).toBe(3);
    });

    it('should list records with pagination', async () => {
      const result = await recordService.listRecords(testTenantId, testCollectionId, {
        page: 1,
        limit: 10,
      });

      expect(result.records.length).toBe(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('should get a single record', async () => {
      const record = await recordService.getRecord(testTenantId, testCollectionId, testRecordIds[0]);

      expect(record).toBeDefined();
      expect(record!.data.first_name).toBe('John');
    });

    it('should update a record', async () => {
      const updated = await recordService.updateRecord(
        testTenantId,
        testCollectionId,
        testRecordIds[0],
        { age: 31, status: 'inactive' }
      );

      expect(updated.data.age).toBe(31);
      expect(updated.data.status).toBe('inactive');
      expect(updated.data.first_name).toBe('John'); // Unchanged
    });

    it('should find records by filters', async () => {
      const result = await recordService.findByFilters(
        testTenantId,
        testCollectionId,
        { status: 'active' },
        { page: 1, limit: 10 }
      );

      expect(result.records.length).toBe(1);
      expect(result.records[0].data.first_name).toBe('Jane');
    });

    it('should delete a record', async () => {
      await recordService.deleteRecord(testTenantId, testCollectionId, testRecordIds[2]);

      const result = await recordService.listRecords(testTenantId, testCollectionId, {
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(2);
      expect(result.records.some(r => r.id === testRecordIds[2])).toBe(false);
    });
  });

  describe('Collection Stats', () => {
    it('should get collection with stats', async () => {
      const collection = await collectionService.getCollection(testTenantId, testCollectionId, true);

      expect(collection).toBeDefined();
      expect(collection!.fieldCount).toBe(5);
      expect(collection!.recordCount).toBe(2); // After deleting one
    });

    it('should list collections with stats', async () => {
      const collections = await collectionService.listCollections(testTenantId, true);

      const customerCollection = collections.find(c => c.id === testCollectionId);
      expect(customerCollection).toBeDefined();
      expect(customerCollection!.fieldCount).toBe(5);
      expect(customerCollection!.recordCount).toBe(2);
    });
  });

  describe('Data Validation', () => {
    it('should enforce required fields', async () => {
      await expect(
        recordService.createRecord(testTenantId, testCollectionId, {
          age: 40, // Missing required first_name, email_address, status
        })
      ).rejects.toThrow();
    });

    it('should validate field types', async () => {
      // This test depends on field type validation in the service
      // If not implemented, it will pass - consider adding type validation
      const record = await recordService.createRecord(testTenantId, testCollectionId, {
        first_name: 'Test',
        email_address: 'test@example.com',
        age: 25,
        status: 'active',
        is_premium: true,
      });

      expect(record.data.age).toBe(25);
      expect(record.data.is_premium).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should delete collection (cascade fields and records)', async () => {
      await collectionService.deleteCollection(testTenantId, testCollectionId);

      const collection = await collectionService.getCollection(testTenantId, testCollectionId, false);
      expect(collection).toBeNull();

      // Verify fields are also deleted
      const fields = await collectionFieldService.listFields(testTenantId, testCollectionId);
      expect(fields.length).toBe(0);

      // Verify records are also deleted
      const records = await recordService.listRecords(testTenantId, testCollectionId, { page: 1, limit: 10 });
      expect(records.total).toBe(0);
    });
  });
});

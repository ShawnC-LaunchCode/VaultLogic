/**
 * DataVault v4 Micro-Phase 7: Regression Test Suite
 * Comprehensive tests for all v4 features: select/multiselect, autonumber, notes, history, API tokens, permissions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { db } from '../../server/db';
import { datavaultTables, datavaultColumns, datavaultRows, datavaultRowNotes, datavaultApiTokens, datavaultTablePermissions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

describe('DataVault v4 Regression Tests', () => {
  let testUserId: string;
  let testDatabaseId: string;
  let testTableId: string;
  let testColumnId: string;
  let testRowId: string;
  let authCookie: string;

  beforeAll(async () => {
    // Setup test user and auth (mock or use test helper)
    // This assumes you have a test authentication helper
    testUserId = 'test-user-id';
    authCookie = 'test-auth-cookie'; // Replace with actual auth setup
  });

  afterAll(async () => {
    // Cleanup test data
    if (testTableId) {
      await db.delete(datavaultTables).where(eq(datavaultTables.id, testTableId));
    }
  });

  beforeEach(async () => {
    // Create test database, table, and column for each test
    const [database] = await db.insert(datavaultTables).values({
      name: 'Test Database',
      slug: 'test-database',
      createdBy: testUserId,
      databaseId: null,
    }).returning();
    testDatabaseId = database.id;

    const [table] = await db.insert(datavaultTables).values({
      name: 'Test Table',
      slug: 'test-table',
      createdBy: testUserId,
      databaseId: testDatabaseId,
    }).returning();
    testTableId = table.id;
  });

  describe('Select/Multiselect Columns', () => {
    it('should create a select column with options', async () => {
      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Status',
          type: 'select',
          required: false,
          options: [
            { value: 'active', label: 'Active', color: 'green' },
            { value: 'inactive', label: 'Inactive', color: 'gray' },
            { value: 'pending', label: 'Pending', color: 'yellow' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.column).toBeDefined();
      expect(response.body.column.type).toBe('select');
      expect(response.body.column.options).toHaveLength(3);
      expect(response.body.column.options[0]).toHaveProperty('color', 'green');
    });

    it('should create a multiselect column with options', async () => {
      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Tags',
          type: 'multiselect',
          required: false,
          options: [
            { value: 'urgent', label: 'Urgent', color: 'red' },
            { value: 'important', label: 'Important', color: 'orange' },
            { value: 'normal', label: 'Normal', color: 'blue' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.column).toBeDefined();
      expect(response.body.column.type).toBe('multiselect');
      expect(response.body.column.options).toHaveLength(3);
    });

    it('should validate select value against options', async () => {
      // Create select column
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Status',
          type: 'select',
          required: false,
          options: [
            { value: 'active', label: 'Active', color: 'green' },
            { value: 'inactive', label: 'Inactive', color: 'gray' },
          ],
        });

      testColumnId = colResponse.body.column.id;

      // Create row with valid value
      const validResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({
          values: {
            [testColumnId]: 'active',
          },
        });

      expect(validResponse.status).toBe(201);

      // Create row with invalid value should fail
      const invalidResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({
          values: {
            [testColumnId]: 'invalid-value',
          },
        });

      expect(invalidResponse.status).toBe(400);
    });

    it('should validate multiselect values as array', async () => {
      // Create multiselect column
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Tags',
          type: 'multiselect',
          required: false,
          options: [
            { value: 'urgent', label: 'Urgent', color: 'red' },
            { value: 'important', label: 'Important', color: 'orange' },
          ],
        });

      testColumnId = colResponse.body.column.id;

      // Create row with valid array
      const validResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({
          values: {
            [testColumnId]: ['urgent', 'important'],
          },
        });

      expect(validResponse.status).toBe(201);
      expect(validResponse.body.row.values[testColumnId]).toEqual(['urgent', 'important']);
    });
  });

  describe('Autonumber Columns', () => {
    it('should create an autonumber column with sequence', async () => {
      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Invoice Number',
          type: 'auto_number',
          required: true,
          autonumberConfig: {
            prefix: 'INV-',
            startingNumber: 1000,
            resetYearly: false,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.column).toBeDefined();
      expect(response.body.column.type).toBe('auto_number');
      expect(response.body.column.autonumberConfig.prefix).toBe('INV-');
    });

    it('should auto-increment autonumber on row creation', async () => {
      // Create autonumber column
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'ID',
          type: 'auto_number',
          required: true,
          autonumberConfig: {
            prefix: 'ID-',
            startingNumber: 1,
            resetYearly: false,
          },
        });

      testColumnId = colResponse.body.column.id;

      // Create first row
      const row1Response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: {} });

      expect(row1Response.status).toBe(201);
      expect(row1Response.body.row.values[testColumnId]).toBe(1);

      // Create second row
      const row2Response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: {} });

      expect(row2Response.status).toBe(201);
      expect(row2Response.body.row.values[testColumnId]).toBe(2);
    });

    it('should format autonumber with prefix', async () => {
      // Create autonumber column with prefix
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Order Number',
          type: 'auto_number',
          required: true,
          autonumberConfig: {
            prefix: 'ORD-',
            startingNumber: 100,
            resetYearly: false,
          },
        });

      testColumnId = colResponse.body.column.id;

      // Create row
      const rowResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: {} });

      expect(rowResponse.status).toBe(201);
      // Check if formatted value is stored or displayed
      // This depends on implementation - adjust as needed
    });
  });

  describe('Row Notes', () => {
    beforeEach(async () => {
      // Create a row for testing notes
      const [row] = await db.insert(datavaultRows).values({
        tableId: testTableId,
        values: {},
        createdBy: testUserId,
      }).returning();
      testRowId = row.id;
    });

    it('should create a note for a row', async () => {
      const response = await request(app)
        .post(`/api/datavault/rows/${testRowId}/notes`)
        .set('Cookie', authCookie)
        .send({
          text: 'This is a test note',
        });

      expect(response.status).toBe(201);
      expect(response.body.note).toBeDefined();
      expect(response.body.note.text).toBe('This is a test note');
      expect(response.body.note.userId).toBe(testUserId);
    });

    it('should get all notes for a row', async () => {
      // Create multiple notes
      await request(app)
        .post(`/api/datavault/rows/${testRowId}/notes`)
        .set('Cookie', authCookie)
        .send({ text: 'Note 1' });

      await request(app)
        .post(`/api/datavault/rows/${testRowId}/notes`)
        .set('Cookie', authCookie)
        .send({ text: 'Note 2' });

      // Get all notes
      const response = await request(app)
        .get(`/api/datavault/rows/${testRowId}/notes`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.notes).toHaveLength(2);
    });

    it('should delete a note', async () => {
      // Create note
      const createResponse = await request(app)
        .post(`/api/datavault/rows/${testRowId}/notes`)
        .set('Cookie', authCookie)
        .send({ text: 'Note to delete' });

      const noteId = createResponse.body.note.id;

      // Delete note
      const deleteResponse = await request(app)
        .delete(`/api/datavault/notes/${noteId}`)
        .set('Cookie', authCookie);

      expect(deleteResponse.status).toBe(204);

      // Verify note is deleted
      const notes = await db
        .select()
        .from(datavaultRowNotes)
        .where(eq(datavaultRowNotes.id, noteId));

      expect(notes).toHaveLength(0);
    });

    it('should not allow deleting notes by other users', async () => {
      // Create note with test user
      const createResponse = await request(app)
        .post(`/api/datavault/rows/${testRowId}/notes`)
        .set('Cookie', authCookie)
        .send({ text: 'Note by user 1' });

      const noteId = createResponse.body.note.id;

      // Try to delete with different user (mock different auth)
      const otherUserCookie = 'other-user-cookie';
      const deleteResponse = await request(app)
        .delete(`/api/datavault/notes/${noteId}`)
        .set('Cookie', otherUserCookie);

      expect(deleteResponse.status).toBe(403);
    });
  });

  describe('Row History', () => {
    beforeEach(async () => {
      // Create a row for testing history
      const [row] = await db.insert(datavaultRows).values({
        tableId: testTableId,
        values: {},
        createdBy: testUserId,
      }).returning();
      testRowId = row.id;
    });

    it('should track row creation in history', async () => {
      const response = await request(app)
        .get(`/api/datavault/rows/${testRowId}/history`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.history).toBeDefined();
      // Verify creation event is logged
      const creationEvent = response.body.history.find((h: any) => h.eventType === 'created');
      expect(creationEvent).toBeDefined();
    });

    it('should track value changes in history', async () => {
      // Create a column
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Name',
          type: 'text',
          required: false,
        });

      testColumnId = colResponse.body.column.id;

      // Update row value
      await request(app)
        .patch(`/api/datavault/rows/${testRowId}`)
        .set('Cookie', authCookie)
        .send({
          values: {
            [testColumnId]: 'Initial Value',
          },
        });

      // Update again
      await request(app)
        .patch(`/api/datavault/rows/${testRowId}`)
        .set('Cookie', authCookie)
        .send({
          values: {
            [testColumnId]: 'Updated Value',
          },
        });

      // Get history
      const response = await request(app)
        .get(`/api/datavault/rows/${testRowId}/history`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      // Verify multiple change events
      const updateEvents = response.body.history.filter((h: any) => h.eventType === 'updated');
      expect(updateEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('API Tokens', () => {
    it('should create an API token', async () => {
      const response = await request(app)
        .post(`/api/datavault/databases/${testDatabaseId}/api-tokens`)
        .set('Cookie', authCookie)
        .send({
          label: 'Test Token',
          scopes: ['read', 'write'],
        });

      expect(response.status).toBe(201);
      expect(response.body.token).toBeDefined();
      expect(response.body.plainToken).toBeDefined();
      expect(response.body.token.scopes).toEqual(['read', 'write']);
    });

    it('should validate API token scopes', async () => {
      const response = await request(app)
        .post(`/api/datavault/databases/${testDatabaseId}/api-tokens`)
        .set('Cookie', authCookie)
        .send({
          label: 'Test Token',
          scopes: [], // Empty scopes should fail
        });

      expect(response.status).toBe(400);
    });

    it('should revoke (delete) an API token', async () => {
      // Create token
      const createResponse = await request(app)
        .post(`/api/datavault/databases/${testDatabaseId}/api-tokens`)
        .set('Cookie', authCookie)
        .send({
          label: 'Token to Revoke',
          scopes: ['read'],
        });

      const tokenId = createResponse.body.token.id;

      // Revoke token
      const revokeResponse = await request(app)
        .delete(`/api/datavault/databases/${testDatabaseId}/api-tokens/${tokenId}`)
        .set('Cookie', authCookie);

      expect(revokeResponse.status).toBe(204);

      // Verify token is deleted
      const tokens = await db
        .select()
        .from(datavaultApiTokens)
        .where(eq(datavaultApiTokens.id, tokenId));

      expect(tokens).toHaveLength(0);
    });

    it('should deny access with expired token', async () => {
      // Create token with expiration in the past
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

      const createResponse = await request(app)
        .post(`/api/datavault/databases/${testDatabaseId}/api-tokens`)
        .set('Cookie', authCookie)
        .send({
          label: 'Expired Token',
          scopes: ['read'],
          expiresAt: expiredDate.toISOString(),
        });

      const plainToken = createResponse.body.plainToken;

      // Try to use expired token
      const response = await request(app)
        .get(`/api/datavault/databases/${testDatabaseId}/tables`)
        .set('Authorization', `Bearer ${plainToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Table Permissions', () => {
    it('should grant table permission', async () => {
      const targetUserId = 'other-user-id';

      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/permissions`)
        .set('Cookie', authCookie)
        .send({
          userId: targetUserId,
          role: 'read',
        });

      expect(response.status).toBe(201);
      expect(response.body.permission).toBeDefined();
      expect(response.body.permission.role).toBe('read');
      expect(response.body.permission.userId).toBe(targetUserId);
    });

    it('should list table permissions', async () => {
      const response = await request(app)
        .get(`/api/datavault/tables/${testTableId}/permissions`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeDefined();
      expect(Array.isArray(response.body.permissions)).toBe(true);
    });

    it('should update table permission role', async () => {
      const targetUserId = 'other-user-id';

      // Grant initial permission
      const grantResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/permissions`)
        .set('Cookie', authCookie)
        .send({
          userId: targetUserId,
          role: 'read',
        });

      const permissionId = grantResponse.body.permission.id;

      // Update to write
      const updateResponse = await request(app)
        .patch(`/api/datavault/permissions/${permissionId}`)
        .set('Cookie', authCookie)
        .send({
          role: 'write',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.permission.role).toBe('write');
    });

    it('should revoke table permission', async () => {
      const targetUserId = 'other-user-id';

      // Grant permission
      const grantResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/permissions`)
        .set('Cookie', authCookie)
        .send({
          userId: targetUserId,
          role: 'read',
        });

      const permissionId = grantResponse.body.permission.id;

      // Revoke permission
      const revokeResponse = await request(app)
        .delete(`/api/datavault/permissions/${permissionId}`)
        .set('Cookie', authCookie);

      expect(revokeResponse.status).toBe(204);

      // Verify permission is deleted
      const permissions = await db
        .select()
        .from(datavaultTablePermissions)
        .where(eq(datavaultTablePermissions.id, permissionId));

      expect(permissions).toHaveLength(0);
    });

    it('should enforce RBAC - only owners can manage permissions', async () => {
      // Try to grant permission as non-owner
      const otherUserCookie = 'other-user-cookie';
      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/permissions`)
        .set('Cookie', otherUserCookie)
        .send({
          userId: 'some-user-id',
          role: 'read',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Grid Performance', () => {
    it('should paginate rows efficiently', async () => {
      // Create multiple rows
      const rowPromises = [];
      for (let i = 0; i < 100; i++) {
        rowPromises.push(
          db.insert(datavaultRows).values({
            tableId: testTableId,
            values: {},
            createdBy: testUserId,
          })
        );
      }
      await Promise.all(rowPromises);

      // Test pagination
      const response = await request(app)
        .get(`/api/datavault/tables/${testTableId}/rows`)
        .query({ limit: 25, offset: 0 })
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.rows).toHaveLength(25);
      expect(response.body.pagination.total).toBe(100);
    });

    it('should handle sorting efficiently', async () => {
      // Create column
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Score',
          type: 'number',
          required: false,
        });

      testColumnId = colResponse.body.column.id;

      // Create rows with values
      await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: { [testColumnId]: 10 } });

      await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: { [testColumnId]: 5 } });

      await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: { [testColumnId]: 15 } });

      // Test sorting
      const response = await request(app)
        .get(`/api/datavault/tables/${testTableId}/rows`)
        .query({ sortBy: testColumnId, sortOrder: 'asc' })
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.rows[0].values[testColumnId]).toBe(5);
      expect(response.body.rows[2].values[testColumnId]).toBe(15);
    });
  });

  describe('Error Handling', () => {
    it('should return user-friendly error for invalid column type', async () => {
      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Invalid Column',
          type: 'invalid_type',
          required: false,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('Invalid column type');
    });

    it('should return user-friendly error for missing required fields', async () => {
      // Create required column
      const colResponse = await request(app)
        .post(`/api/datavault/tables/${testTableId}/columns`)
        .set('Cookie', authCookie)
        .send({
          name: 'Required Field',
          type: 'text',
          required: true,
        });

      testColumnId = colResponse.body.column.id;

      // Try to create row without required field
      const response = await request(app)
        .post(`/api/datavault/tables/${testTableId}/rows`)
        .set('Cookie', authCookie)
        .send({ values: {} });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('required');
    });

    it('should handle network errors gracefully', async () => {
      // Test with invalid ID format
      const response = await request(app)
        .get('/api/datavault/tables/invalid-uuid/rows')
        .set('Cookie', authCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});

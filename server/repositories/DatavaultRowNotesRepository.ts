import { BaseRepository, type DbTransaction } from "./BaseRepository";
import {
  datavaultRowNotes,
  type DatavaultRowNote,
  type InsertDatavaultRowNote,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";

/**
 * Repository for DataVault row notes data access
 * Handles CRUD operations for row-level comments/notes
 */
export class DatavaultRowNotesRepository extends BaseRepository<
  typeof datavaultRowNotes,
  DatavaultRowNote,
  InsertDatavaultRowNote
> {
  constructor(dbInstance?: typeof db) {
    super(datavaultRowNotes, dbInstance);
  }

  /**
   * Find notes for a specific row, ordered by creation time (newest first)
   */
  async findByRowId(
    rowId: string,
    tx?: DbTransaction
  ): Promise<DatavaultRowNote[]> {
    const database = this.getDb(tx);

    return await database
      .select()
      .from(datavaultRowNotes)
      .where(eq(datavaultRowNotes.rowId, rowId))
      .orderBy(desc(datavaultRowNotes.createdAt));
  }

  /**
   * Find notes by row ID and tenant ID (for authorization)
   */
  async findByRowIdAndTenant(
    rowId: string,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<DatavaultRowNote[]> {
    const database = this.getDb(tx);

    return await database
      .select()
      .from(datavaultRowNotes)
      .where(
        and(
          eq(datavaultRowNotes.rowId, rowId),
          eq(datavaultRowNotes.tenantId, tenantId)
        )
      )
      .orderBy(desc(datavaultRowNotes.createdAt));
  }

  /**
   * Create a new note
   */
  async createNote(
    data: InsertDatavaultRowNote,
    tx?: DbTransaction
  ): Promise<DatavaultRowNote> {
    return await this.create(data, tx);
  }

  /**
   * Delete a note by ID
   */
  async deleteNote(noteId: string, tx?: DbTransaction): Promise<void> {
    await this.delete(noteId, tx);
  }

  /**
   * Find a note by ID with tenant verification
   */
  async findByIdAndTenant(
    noteId: string,
    tenantId: string,
    tx?: DbTransaction
  ): Promise<DatavaultRowNote | undefined> {
    const database = this.getDb(tx);

    const [note] = await database
      .select()
      .from(datavaultRowNotes)
      .where(
        and(
          eq(datavaultRowNotes.id, noteId),
          eq(datavaultRowNotes.tenantId, tenantId)
        )
      );

    return note;
  }

  /**
   * Delete all notes for a specific row
   * Used when row is deleted (though cascade should handle this)
   */
  async deleteByRowId(rowId: string, tx?: DbTransaction): Promise<void> {
    const database = this.getDb(tx);
    await database
      .delete(datavaultRowNotes)
      .where(eq(datavaultRowNotes.rowId, rowId));
  }
}

// Singleton instance
export const datavaultRowNotesRepository = new DatavaultRowNotesRepository();

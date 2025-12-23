/**
 * Storage Provider Interface
 * Abstraction layer for file storage (local filesystem, S3, Azure Blob, etc.)
 */

export interface StorageMetadata {
  contentType: string;
  size: number;
  etag?: string;
  lastModified?: Date;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface SignedUrlOptions {
  expiresIn: number; // seconds
  contentType?: string;
  contentDisposition?: string;
}

export interface IStorageProvider {
  /**
   * Upload a file to storage
   * @param buffer - File buffer to upload
   * @param key - Storage key (path/filename)
   * @param options - Upload options
   * @returns URL or storage reference
   */
  upload(buffer: Buffer, key: string, options?: UploadOptions): Promise<string>;

  /**
   * Download a file from storage
   * @param key - Storage key
   * @returns File buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   * @param key - Storage key
   * @returns True if file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   * @param key - Storage key
   * @returns File metadata
   */
  getMetadata(key: string): Promise<StorageMetadata>;

  /**
   * Generate a signed URL for temporary access
   * @param key - Storage key
   * @param options - Signed URL options
   * @returns Signed URL
   */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;

  /**
   * Get the public URL for a file (if applicable)
   * @param key - Storage key
   * @returns Public URL or null if not public
   */
  getPublicUrl(key: string): string | null;

  /**
   * Copy a file within storage
   * @param sourceKey - Source key
   * @param destKey - Destination key
   */
  copy(sourceKey: string, destKey: string): Promise<void>;

  /**
   * List files with a given prefix
   * @param prefix - Key prefix
   * @param maxKeys - Maximum number of keys to return
   * @returns Array of storage keys
   */
  list(prefix: string, maxKeys?: number): Promise<string[]>;
}

/**
 * Storage Service - Unified File Storage Abstraction
 *
 * This module provides a pluggable storage system that works with:
 * - Local filesystem (development)
 * - AWS S3 (production)
 * - Other S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
 *
 * Usage:
 * ```typescript
 * import { getStorageProvider } from './services/storage';
 *
 * const storage = getStorageProvider();
 * const key = await storage.upload(buffer, 'templates/my-template.pdf');
 * const data = await storage.download(key);
 * ```
 *
 * Configuration (environment variables):
 * - FILE_STORAGE_PROVIDER: 'local' or 's3' (default: 'local')
 *
 * For S3:
 * - AWS_S3_BUCKET: Bucket name
 * - AWS_REGION: AWS region (default: 'us-east-1')
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_S3_ENDPOINT: Custom endpoint for S3-compatible services (optional)
 */

export * from './IStorageProvider';
export { LocalStorageProvider } from './LocalStorageProvider';
export { S3StorageProvider } from './S3StorageProvider';
export { getStorageProvider, resetStorageProvider, setStorageProvider } from './StorageFactory';

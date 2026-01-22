import { ConcurrencyLimiter } from '../utils/concurrency';

// Max concurrent document global processes (scan, convert, etc.)
// Default 2 to keep CPU usage low on small instances (Railway)
const MAX_CONCURRENT_DOCS = parseInt(process.env.MAX_CONCURRENT_DOC_PROCESSES ?? '2');

export const documentProcessingLimiter = new ConcurrencyLimiter(MAX_CONCURRENT_DOCS);

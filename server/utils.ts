import { logger } from './logger';

export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

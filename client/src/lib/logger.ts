
/**
 * Structured Client-Side Logger
 * Wrapper around console.* with log levels, context, and production filtering.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    module: string;
}

class Logger {
    private module: string;
    private isDevelopment: boolean;

    constructor(config: LoggerConfig) {
        this.module = config.module;
        // In Vite, import.meta.env.PROD is true in production
        // Fallback to checking hostname or manual flag if needed
        this.isDevelopment = import.meta.env.DEV;
    }

    private formatMessage(message: string): string {
        return `[${this.module}] ${message}`;
    }

    debug(message: string, ...args: any[]) {
        if (this.isDevelopment) {
            console.debug(this.formatMessage(message), ...args);
        }
    }

    info(message: string, ...args: any[]) {
        console.info(this.formatMessage(message), ...args);
    }

    warn(message: string, ...args: any[]) {
        console.warn(this.formatMessage(message), ...args);
    }

    error(message: string, ...args: any[]) {
        console.error(this.formatMessage(message), ...args);
    }
}

export const createLogger = (config: LoggerConfig) => new Logger(config);

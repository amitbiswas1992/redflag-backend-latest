import { Injectable } from '@nestjs/common';
import {
    createLogger,
    format,
    transports,
    Logger as WinstonLogger,
} from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, errors, json, colorize, printf } = format;

const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, ...meta }) => {
        const extra = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `[${timestamp}] ${level}: ${message} ${extra}`;
    }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

@Injectable()
export class LoggerService {
    private readonly winston: WinstonLogger;
    private service = 'redflag';

    constructor() {
        this.winston = createLogger({
            level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
            format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
            defaultMeta: { service: this.service },
            transports: [
                // Always log to console
                new transports.Console(),

                // Rotating file log — info and above
                new (transports as any).DailyRotateFile({
                    filename: `logs/${this.service}-%DATE%.log`,
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d',
                    level: 'info',
                }),

                // Separate error-only log file
                new (transports as any).DailyRotateFile({
                    filename: `logs/${this.service}-errors-%DATE%.log`,
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '30d',
                    level: 'error',
                }),
            ],
        });
    }

    setServiceContext(service: string): void {
        this.service = service;
        this.winston.defaultMeta = { service };
    }

    error(message: string, payload?: Record<string, unknown>): void {
        this.winston.error(message, { ...payload, service: this.service });
    }

    warn(message: string, payload?: Record<string, unknown>): void {
        this.winston.warn(message, { ...payload, service: this.service });
    }

    log(message: string, payload?: Record<string, unknown>): void {
        this.winston.info(message, { ...payload, service: this.service });
    }

    debug(message: string, payload?: Record<string, unknown>): void {
        this.winston.debug(message, { ...payload, service: this.service });
    }
}

import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../logger/logger.service';
import { Request } from 'express';

/**
 * Global logging interceptor — registered in main.ts.
 * Wraps every request lifecycle:
 *  - Logs incoming requests (method, path, tenant)
 *  - Records response time on success
 *  - Re-throws errors so GlobalExceptionFilter handles formatting
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: LoggerService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const { method, url } = request;
        const organizationId = request.headers['x-organization-id'] ?? 'anonymous';
        const correlationId =
            (request.headers['x-correlation-id'] as string) ??
            `req_${Date.now().toString(36)}`;
        const startTime = Date.now();

        this.logger.log(`→ ${method} ${url}`, {
            correlationId,
            organizationId,
        });

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                this.logger.log(`← ${method} ${url} [${duration}ms]`, {
                    correlationId,
                    duration,
                });
            }),
            catchError((error) => {
                // Re-throw — GlobalExceptionFilter handles the response format
                // This interceptor only adds extra request-level context logging here if needed
                return throwError(() => error);
            }),
        );
    }
}

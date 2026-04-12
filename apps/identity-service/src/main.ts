import { GlobalExceptionFilter, LoggerService, LoggingInterceptor } from '@app/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { IdentityModule } from './identity.module';

async function bootstrap() {
    const app = await NestFactory.create(IdentityModule);

    // ─── Centralized Error Pipeline ──────────────────────────────────────────
    const logger = app.get(LoggerService);
    logger.setServiceContext('identity-service');
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger));

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled Promise Rejection', { reason: String(reason) });
    });
    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
        process.exit(1);
    });
    // ────────────────────────────────────────────────────────────────────────

    // Allow requests from the NextJS frontend dev server
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'http://localhost:3002',
        ],
        credentials: true,
    });

    await app.listen(process.env.IDENTITY_PORT ?? 3001);
    logger.log(`Identity Service listening on port ${process.env.IDENTITY_PORT ?? 3001}`);
}
bootstrap();

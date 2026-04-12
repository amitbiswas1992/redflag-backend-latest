import {
  GlobalExceptionFilter,
  LoggerService,
  LoggingInterceptor,
} from '@app/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

/**
 * Basic authentication middleware for Swagger documentation
 * Protects all routes under /api/docs
 */
function swaggerBasicAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/docs')) {
    return next();
  }

  const swaggerUsername = process.env.SWAGGER_USERNAME || 'admin';
  const swaggerPassword = process.env.SWAGGER_PASSWORD || 'admin';
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader(
      'WWW-Authenticate',
      'Basic realm="Swagger API Documentation"',
    );
    return res.status(401).send('Unauthorized');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString(
    'utf-8',
  );
  const [username, password] = credentials.split(':');

  if (username === swaggerUsername && password === swaggerPassword) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
  return res.status(401).send('Unauthorized');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Centralized Error Pipeline ────────────────────────────────────────────
  const logger = app.get(LoggerService);
  logger.setServiceContext('core-service');
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Catch errors from background jobs, BullMQ workers, and async code
  // that runs outside NestJS request lifecycle
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1); // Safe exit — let the orchestrator restart cleanly
  });
  // ───────────────────────────────────────────────────────────────────────────

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-tenant-id',
      'x-organization-id',
      'x-correlation-id',
    ],
  });

  // Enable validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Redflag Epic Integration API')
    .setDescription(
      'NestJS microservice for Epic EHR integration via SMART on FHIR (R4). Provides internal REST APIs for accessing clinical data.',
    )
    .setVersion('1.0')
    .addTag('auth', 'SMART on FHIR authentication endpoints')
    .addTag('clinical', 'Internal clinical data APIs')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use(swaggerBasicAuth);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Epic Integration API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Core Service listening on port ${process.env.PORT ?? 3000}`);
}
void bootstrap();

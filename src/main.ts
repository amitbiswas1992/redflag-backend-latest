import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';

/**
 * Basic authentication middleware for Swagger documentation
 * Protects all routes under /api/docs
 */
function swaggerBasicAuth(req: Request, res: Response, next: NextFunction) {
  // Only apply auth to Swagger routes
  if (!req.path.startsWith('/api/docs')) {
    return next();
  }

  const swaggerUsername = process.env.SWAGGER_USERNAME || 'admin';
  const swaggerPassword = process.env.SWAGGER_PASSWORD || 'admin';

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
    return res.status(401).send('Unauthorized');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (username === swaggerUsername && password === swaggerPassword) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Documentation"');
  return res.status(401).send('Unauthorized');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins (or specify specific origins)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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

  // Protect Swagger documentation routes with basic auth
  // Apply middleware before Swagger setup to protect all routes under /api/docs
  app.use(swaggerBasicAuth);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Epic Integration API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

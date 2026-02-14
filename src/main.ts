import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Epic Integration API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

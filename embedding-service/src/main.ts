import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/services/app-logger';

// Batches of up to 64 code chunks per /api/embed request can exceed Express's
// default 100kb JSON body limit — bump it well above what any real batch needs.
const JSON_BODY_LIMIT = '25mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
    bodyParser: false,
  });
  app.use(json({ limit: JSON_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  app.getHttpAdapter().getInstance().disable('etag');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT ?? '8000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Embedding-service listening on port ${port}`);
}

bootstrap();

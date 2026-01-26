// NestJS Application Entry Point
// v1.3 - Fixed dotenv path to work from any working directory

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from the api directory regardless of where the command is run
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  override: true
});

// Debug: Log loaded credentials status
console.log('[ENV] XUNFEI_APP_ID:', process.env.XUNFEI_APP_ID ? 'SET' : 'NOT SET');
console.log('[ENV] GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
console.log('[ENV] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`Lingtin API running on http://localhost:${port}`);
}

bootstrap();

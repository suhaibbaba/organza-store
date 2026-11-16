import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureApp, createFastifyAdapter } from './bootstrap.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter());
  await configureApp(app);
  await app.listen({ port: env().PORT, host: env().HOST });
}

void main();

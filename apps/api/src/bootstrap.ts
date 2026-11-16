import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { env } from './config/env.js';
import { AllExceptionsFilter } from './common/lib/exception-filter.js';

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: env().TRUST_PROXY, bodyLimit: 2 * 1024 * 1024 });
}

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  await app.register(cookie as never);
  await app.register(multipart as never, {
    limits: { fileSize: env().UPLOAD_MAX_SIZE_MB * 1024 * 1024, files: 1 },
  });
  const uploads = resolve(env().UPLOAD_DIR);
  mkdirSync(uploads, { recursive: true });
  // Photos have unique names per crop, so they can be cached for good.
  await app.register(fastifyStatic as never, {
    root: uploads,
    prefix: '/uploads/',
    decorateReply: false,
    immutable: true,
    maxAge: '30d',
    index: false,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: env().CORS_ORIGIN.split(','), credentials: true });
  app.enableShutdownHooks();
}

export type App = INestApplication & NestFastifyApplication;

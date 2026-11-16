import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ERROR_CODES, type ApiErrorBody } from '@organza/shared';
import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { PG, pgError } from './postgres-errors.js';

const HTTP_CODES: Record<number, string> = {
  400: ERROR_CODES.VALIDATION,
  401: ERROR_CODES.UNAUTHENTICATED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const [status, body] = this.describe(exception);
    if (status >= 500)
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    void reply.status(status).send(body);
  }

  private describe(exception: unknown): [number, ApiErrorBody] {
    if (exception instanceof AppError) {
      return [
        exception.status,
        {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined && { details: exception.details }),
        },
      ];
    }
    if (exception instanceof ZodError) {
      return [
        400,
        { code: ERROR_CODES.VALIDATION, message: 'Invalid input', details: exception.issues },
      ];
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return [
        status,
        { code: HTTP_CODES[status] ?? ERROR_CODES.INTERNAL, message: exception.message },
      ];
    }
    const pg = pgError(exception);
    if (pg?.code === PG.INSUFFICIENT_PRIVILEGE) {
      return [409, { code: ERROR_CODES.APPEND_ONLY, message: pg.message }];
    }
    if (pg?.code === PG.CHECK_VIOLATION || pg?.code === PG.UNIQUE_VIOLATION) {
      return [
        409,
        {
          code: ERROR_CODES.CONSTRAINT,
          message: pg.message,
          details: { constraint: pg.constraint },
        },
      ];
    }
    return [500, { code: ERROR_CODES.INTERNAL, message: 'Internal error' }];
  }
}

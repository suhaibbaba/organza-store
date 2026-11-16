import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../../config/env.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../constants.js';

function secure(request: FastifyRequest): boolean {
  const mode = env().AUTH_COOKIE_SECURE;
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return request.protocol === 'https';
}

export function readRefreshToken(request: FastifyRequest, fromBody?: string): string | undefined {
  return request.cookies[REFRESH_COOKIE_NAME] ?? fromBody;
}

export function setRefreshCookie(reply: FastifyReply, token: string, persistent: boolean): void {
  void reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(reply.request),
    path: REFRESH_COOKIE_PATH,
    ...(persistent && { maxAge: env().JWT_REFRESH_TTL_DAYS * 86_400 }),
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  void reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

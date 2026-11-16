import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Capability, ERROR_CODES, roleCan } from '@organza/shared';
import type { FastifyRequest } from 'fastify';
import { TokenService } from '../../modules/auth/services/token.service.js';
import { SessionStateService } from '../../modules/auth/services/session-state.service.js';
import { type Actor, CAPABILITY_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators.js';
import { AppError } from '../lib/app-error.js';

/**
 * One global guard: public routes pass; every other route needs a valid access token for an
 * active user, and that user's fixed role must hold the route's declared capability.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest & { actor?: Actor }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? await this.tokens.verifyAccessToken(token) : null;
    if (!claims) throw new AppError(401, ERROR_CODES.UNAUTHENTICATED, 'Sign in required');

    const state = await this.sessions.get(claims.sub);
    if (!state?.isActive || state.role !== claims.role) {
      throw new AppError(401, ERROR_CODES.UNAUTHENTICATED, 'Session no longer valid');
    }
    request.actor = { id: state.id, role: state.role, name: state.name };

    const capability = this.reflector.getAllAndOverride<Capability | undefined>(
      CAPABILITY_KEY,
      targets,
    );
    if (!capability) throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Route declares no capability');
    if (!roleCan(state.role, capability)) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, `Missing capability ${capability}`);
    }
    return true;
  }
}

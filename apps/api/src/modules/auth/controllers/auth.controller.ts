import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  changeOwnPasswordSchema,
  ERROR_CODES,
  type LoginResponse,
  loginSchema,
  refreshSchema,
  type SessionUser,
} from '@organza/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import {
  type Actor,
  Can,
  CurrentUser,
  Public,
} from '../../../common/decorators/auth.decorators.js';
import { AppError } from '../../../common/lib/app-error.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from '../lib/refresh-cookie.js';
import { AuthService, type IssuedSession } from '../services/auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(zod(loginSchema)) body: z.output<typeof loginSchema>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const session = await this.auth.login(body.email, body.password, body.persistent, body.client);
    return this.respond(reply, session, body.client === 'desktop');
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(zod(refreshSchema)) body: z.output<typeof refreshSchema>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const fromCookie = request.cookies['organza_refresh'];
    const token = readRefreshToken(request, body.refreshToken);
    if (!token) {
      clearRefreshCookie(reply);
      throw new AppError(401, ERROR_CODES.UNAUTHENTICATED, 'No refresh token');
    }
    const session = await this.auth.refresh(token);
    return this.respond(reply, session, !fromCookie);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(zod(refreshSchema)) body: z.output<typeof refreshSchema>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(readRefreshToken(request, body.refreshToken));
    clearRefreshCookie(reply);
  }

  @Can('account.self')
  @Get('me')
  me(@CurrentUser() actor: Actor): Promise<SessionUser> {
    return this.auth.me(actor.id);
  }

  @Can('account.self')
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() actor: Actor,
    @Body(zod(changeOwnPasswordSchema)) body: z.output<typeof changeOwnPasswordSchema>,
  ): Promise<void> {
    await this.auth.changeOwnPassword(actor.id, body.currentPassword, body.newPassword);
  }

  private respond(
    reply: FastifyReply,
    session: IssuedSession,
    tokenInBody: boolean,
  ): LoginResponse {
    const { refreshToken, persistent, ...response } = session;
    if (tokenInBody) return { ...response, refreshToken };
    setRefreshCookie(reply, refreshToken, persistent);
    return response;
  }
}

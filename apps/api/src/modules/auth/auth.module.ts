import { Global, Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CapabilityCoverage } from '../../common/guards/capability-coverage.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { LoginThrottleService } from './services/login-throttle.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionStateService } from './services/session-state.service.js';
import { TokenService } from './services/token.service.js';

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    LoginThrottleService,
    SessionStateService,
    CapabilityCoverage,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PasswordService, SessionStateService, TokenService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [DatabaseModule, CommonModule, AuthModule, HealthModule, UsersModule, SettingsModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogueModule } from './modules/catalogue/catalogue.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { StockModule } from './modules/stock/stock.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    AuthModule,
    HealthModule,
    UsersModule,
    SettingsModule,
    LedgerModule,
    StockModule,
    CatalogueModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogueModule } from './modules/catalogue/catalogue.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { ApprovalsModule } from './modules/approvals/approvals.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
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
    JobsModule,
    LedgerModule,
    StockModule,
    CatalogueModule,
    SalesModule,
    ApprovalsModule,
    OrdersModule,
    PurchasingModule,
    ReportsModule,
  ],
})
export class AppModule {}

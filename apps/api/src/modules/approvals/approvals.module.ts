import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { StockModule } from '../stock/stock.module.js';
import { ApprovalsController } from './controllers/approvals.controller.js';
import { ApprovalsService } from './services/approvals.service.js';

@Module({
  imports: [CatalogueModule, StockModule, SalesModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}

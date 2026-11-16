import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module.js';
import { StockModule } from '../stock/stock.module.js';
import { PurchasingController } from './controllers/purchasing.controller.js';
import { SuppliersController } from './controllers/suppliers.controller.js';
import { PurchasingService } from './services/purchasing.service.js';
import { SuppliersService } from './services/suppliers.service.js';

@Module({
  imports: [SalesModule, StockModule],
  controllers: [SuppliersController, PurchasingController],
  providers: [SuppliersService, PurchasingService],
  exports: [SuppliersService, PurchasingService],
})
export class PurchasingModule {}

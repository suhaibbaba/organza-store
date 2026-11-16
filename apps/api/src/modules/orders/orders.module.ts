import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module.js';
import { StockModule } from '../stock/stock.module.js';
import { CouriersController } from './controllers/couriers.controller.js';
import { OrdersController } from './controllers/orders.controller.js';
import { CouriersService } from './services/couriers.service.js';
import { OrdersService } from './services/orders.service.js';

@Module({
  imports: [SalesModule, StockModule],
  controllers: [OrdersController, CouriersController],
  providers: [OrdersService, CouriersService],
  exports: [OrdersService, CouriersService],
})
export class OrdersModule {}

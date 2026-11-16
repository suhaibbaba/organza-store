import { Module } from '@nestjs/common';
import { CustomersController } from './controllers/customers.controller.js';
import { SalesController } from './controllers/sales.controller.js';
import { ShiftsController } from './controllers/shifts.controller.js';
import { CustomersService } from './services/customers.service.js';
import { PaymentsService } from './services/payments.service.js';
import { ReturnsService } from './services/returns.service.js';
import { SalesService } from './services/sales.service.js';
import { ShiftsService } from './services/shifts.service.js';

@Module({
  controllers: [CustomersController, SalesController, ShiftsController],
  providers: [CustomersService, PaymentsService, ReturnsService, SalesService, ShiftsService],
  exports: [CustomersService, PaymentsService, ReturnsService, SalesService, ShiftsService],
})
export class SalesModule {}

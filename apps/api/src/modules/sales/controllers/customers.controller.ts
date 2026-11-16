import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  customerInputSchema,
  customerListQuerySchema,
  mergeCustomersSchema,
  receivePaymentSchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { CustomersService } from '../services/customers.service.js';
import { SalesService } from '../services/sales.service.js';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly sales: SalesService,
  ) {}

  @Can('customers.view')
  @Get()
  list(@Query(zod(customerListQuerySchema)) query: z.output<typeof customerListQuerySchema>) {
    return this.customers.list(query);
  }

  @Can('customers.edit')
  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(customerInputSchema)) body: z.output<typeof customerInputSchema>,
  ) {
    return this.customers.create(actor, body);
  }

  @Can('customers.view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(id);
  }

  @Can('customers.edit')
  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(customerInputSchema)) body: z.output<typeof customerInputSchema>,
  ) {
    return this.customers.update(actor, id, body);
  }

  @Can('customers.view')
  @Get(':id/statement')
  statement(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.statement(id);
  }

  @Can('customers.view')
  @Get(':id/open-sales')
  openSales(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.openSales(undefined, id);
  }

  @Can('payments.receive')
  @Post(':id/payments')
  receive(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(receivePaymentSchema)) body: z.output<typeof receivePaymentSchema>,
  ) {
    return this.sales.receivePayment(actor, id, body);
  }

  @Can('customers.merge')
  @Post(':id/merge')
  merge(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(mergeCustomersSchema)) body: z.output<typeof mergeCustomersSchema>,
  ) {
    return this.customers.merge(actor, id, body.fromId, body.reason);
  }
}

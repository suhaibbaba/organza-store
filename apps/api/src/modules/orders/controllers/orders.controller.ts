import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  cancelOrderSchema,
  collectOrderSchema,
  createOrderSchema,
  orderDepositSchema,
  orderListQuerySchema,
  orderStepSchema,
  returnedOrderSchema,
  shipOrderSchema,
  updateOrderSchema,
} from '@organza/shared';
import { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { OrdersService } from '../services/orders.service.js';

const pickListQuerySchema = z.object({
  ids: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).min(1).max(50)),
});

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Can('orders.view')
  @Get()
  list(@Query(zod(orderListQuerySchema)) query: z.output<typeof orderListQuerySchema>) {
    return this.orders.list(query);
  }

  @Can('orders.view')
  @Get('pick-list')
  pickList(@Query(zod(pickListQuerySchema)) query: z.output<typeof pickListQuerySchema>) {
    return this.orders.pickList(query.ids);
  }

  @Can('orders.view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Can('orders.create')
  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(createOrderSchema)) body: z.output<typeof createOrderSchema>,
  ) {
    return this.orders.create(actor, body);
  }

  @Can('orders.create')
  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateOrderSchema)) body: z.output<typeof updateOrderSchema>,
  ) {
    return this.orders.update(actor, id, body);
  }

  @Can('orders.fulfil')
  @Post(':id/confirm')
  confirm(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(orderStepSchema)) body: z.output<typeof orderStepSchema>,
  ) {
    return this.orders.confirm(actor, id, body.note);
  }

  @Can('orders.fulfil')
  @Post(':id/prepare')
  prepare(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(orderStepSchema)) body: z.output<typeof orderStepSchema>,
  ) {
    return this.orders.prepare(actor, id, body.note);
  }

  @Can('orders.fulfil')
  @Post(':id/ready')
  ready(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(orderStepSchema)) body: z.output<typeof orderStepSchema>,
  ) {
    return this.orders.ready(actor, id, body.note);
  }

  @Can('orders.fulfil')
  @Post(':id/reserve')
  reserve(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.reserveAgain(actor, id);
  }

  @Can('orders.cancel')
  @Post(':id/cancel')
  cancel(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(cancelOrderSchema)) body: z.output<typeof cancelOrderSchema>,
  ) {
    return this.orders.cancel(actor, id, body.reason);
  }

  @Can('orders.fulfil')
  @Post(':id/ship')
  ship(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(shipOrderSchema)) body: z.output<typeof shipOrderSchema>,
  ) {
    return this.orders.ship(actor, id, body);
  }

  @Can('orders.fulfil')
  @Post(':id/collect')
  collect(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(collectOrderSchema)) body: z.output<typeof collectOrderSchema>,
  ) {
    return this.orders.collect(actor, id, body);
  }

  @Can('orders.fulfil')
  @Post(':id/returned')
  returned(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(returnedOrderSchema)) body: z.output<typeof returnedOrderSchema>,
  ) {
    return this.orders.returned(actor, id, body);
  }

  @Can('payments.receive')
  @Post(':id/deposits')
  deposit(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(orderDepositSchema)) body: z.output<typeof orderDepositSchema>,
  ) {
    return this.orders.deposit(actor, id, body);
  }
}

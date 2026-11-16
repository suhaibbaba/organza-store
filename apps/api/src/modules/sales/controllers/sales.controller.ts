import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  cancelHeldSchema,
  checkoutSchema,
  handoverSchema,
  saleListQuerySchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { SalesService } from '../services/sales.service.js';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Can('sales.view')
  @Get()
  list(@Query(zod(saleListQuerySchema)) query: z.output<typeof saleListQuerySchema>) {
    return this.sales.list(query);
  }

  @Can('sales.create')
  @Post()
  checkout(
    @CurrentUser() actor: Actor,
    @Body(zod(checkoutSchema)) body: z.output<typeof checkoutSchema>,
  ) {
    return this.sales.checkout(actor, body);
  }

  @Can('sales.view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.get(id);
  }

  @Can('sales.view')
  @Get(':id/receipt')
  receipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.receipt(id);
  }

  @Can('sales.handover')
  @Post(':id/handover')
  handover(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(handoverSchema)) body: z.output<typeof handoverSchema>,
  ) {
    return this.sales.handover(actor, id, body);
  }

  @Can('sales.cancelHeld')
  @Post(':id/cancel-held')
  cancelHeld(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(cancelHeldSchema)) body: z.output<typeof cancelHeldSchema>,
  ) {
    return this.sales.cancelHeld(actor, id, body);
  }
}

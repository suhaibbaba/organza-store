import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  closePurchaseOrderSchema,
  createCreditNoteSchema,
  createPurchaseOrderSchema,
  createReceiptSchema,
  receiptListQuerySchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { purchaseOrderListQuerySchema, PurchasingService } from '../services/purchasing.service.js';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Can('purchasing.receive')
  @Get('orders')
  orders(
    @Query(zod(purchaseOrderListQuerySchema)) query: z.output<typeof purchaseOrderListQuerySchema>,
  ) {
    return this.purchasing.orders(query);
  }

  @Can('purchasing.receive')
  @Get('orders/:id')
  order(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.order(id);
  }

  @Can('purchasing.order')
  @Post('orders')
  createOrder(
    @CurrentUser() actor: Actor,
    @Body(zod(createPurchaseOrderSchema)) body: z.output<typeof createPurchaseOrderSchema>,
  ) {
    return this.purchasing.createOrder(actor, body);
  }

  @Can('purchasing.order')
  @Post('orders/:id/close')
  closeOrder(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(closePurchaseOrderSchema)) body: z.output<typeof closePurchaseOrderSchema>,
  ) {
    return this.purchasing.closeOrder(actor, id, body);
  }

  @Can('suppliers.view')
  @Get('receipts')
  receipts(@Query(zod(receiptListQuerySchema)) query: z.output<typeof receiptListQuerySchema>) {
    return this.purchasing.receipts(query);
  }

  @Can('purchasing.receive')
  @Get('receipts/:id')
  receipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.receipt(id);
  }

  @Can('purchasing.receive')
  @Post('receipts')
  receive(
    @CurrentUser() actor: Actor,
    @Body(zod(createReceiptSchema)) body: z.output<typeof createReceiptSchema>,
  ) {
    return this.purchasing.receive(actor, body);
  }

  @Can('purchasing.credit')
  @Post('credit-notes')
  creditNote(
    @CurrentUser() actor: Actor,
    @Body(zod(createCreditNoteSchema)) body: z.output<typeof createCreditNoteSchema>,
  ) {
    return this.purchasing.creditNote(actor, body);
  }

  @Can('suppliers.view')
  @Get('credit-notes/:id')
  creditNoteView(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.creditNoteView(id);
  }

  @Can('stock.history')
  @Get('items/:itemId/costs')
  costs(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.purchasing.costHistory(itemId);
  }
}

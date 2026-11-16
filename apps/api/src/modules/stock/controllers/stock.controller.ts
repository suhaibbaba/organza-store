import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  countLinesSchema,
  createAdjustmentSchema,
  createCountSchema,
  reverseDocumentSchema,
  stockListQuerySchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { StockDocumentsService } from '../services/stock-documents.service.js';
import { StockService } from '../services/stock.service.js';

@Controller('stock')
export class StockController {
  constructor(
    private readonly docs: StockDocumentsService,
    private readonly stock: StockService,
  ) {}

  @Can('stock.view')
  @Get()
  list(@Query(zod(stockListQuerySchema)) query: z.output<typeof stockListQuerySchema>) {
    return this.docs.list(query);
  }

  @Can('stock.history')
  @Get('items/:id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.history(id);
  }

  @Can('stock.history')
  @Get('check')
  check() {
    return this.stock.verify();
  }

  @Can('stock.adjust')
  @Get('adjustments')
  adjustments(@Query('page') page?: string) {
    return this.docs.listAdjustments(Math.max(1, Number(page) || 1));
  }

  @Can('stock.adjust')
  @Get('adjustments/:id')
  adjustment(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.getAdjustment(id);
  }

  @Can('stock.adjust')
  @Post('adjustments')
  adjust(
    @CurrentUser() actor: Actor,
    @Body(zod(createAdjustmentSchema)) body: z.output<typeof createAdjustmentSchema>,
  ) {
    return this.docs.createAdjustment(actor, body);
  }

  @Can('stock.adjust')
  @Post('adjustments/:id/reverse')
  reverse(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(reverseDocumentSchema)) body: z.output<typeof reverseDocumentSchema>,
  ) {
    return this.docs.reverseAdjustment(actor, id, body.reason);
  }

  @Can('stock.count')
  @Get('counts')
  counts() {
    return this.docs.listCounts();
  }

  @Can('stock.count')
  @Post('counts')
  createCount(
    @CurrentUser() actor: Actor,
    @Body(zod(createCountSchema)) body: z.output<typeof createCountSchema>,
  ) {
    return this.docs.createCount(actor, body);
  }

  @Can('stock.count')
  @Get('counts/:id')
  count(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.getCount(id);
  }

  @Can('stock.count')
  @Post('counts/:id/lines')
  countLines(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(countLinesSchema)) body: z.output<typeof countLinesSchema>,
  ) {
    return this.docs.countLines(actor, id, body);
  }

  @Can('stock.count')
  @Post('counts/:id/post')
  postCount(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.postCount(actor, id);
  }

  @Can('stock.count')
  @Post('counts/:id/cancel')
  cancelCount(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.cancelCount(actor, id);
  }
}

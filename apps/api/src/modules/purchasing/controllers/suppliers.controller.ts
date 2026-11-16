import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  supplierListQuerySchema,
  supplierPaySchema,
  supplierSchema,
  updateSupplierSchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { PurchasingService } from '../services/purchasing.service.js';
import { SuppliersService } from '../services/suppliers.service.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly purchasing: PurchasingService,
  ) {}

  /** Receiving staff pick the supplier, so the names are open to them too. */
  @Can('purchasing.receive')
  @Get()
  list(@Query(zod(supplierListQuerySchema)) query: z.output<typeof supplierListQuerySchema>) {
    return this.suppliers.list(query);
  }

  @Can('suppliers.view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.get(id);
  }

  @Can('suppliers.manage')
  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(supplierSchema)) body: z.output<typeof supplierSchema>,
  ) {
    return this.suppliers.create(actor, body);
  }

  @Can('suppliers.manage')
  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateSupplierSchema)) body: z.output<typeof updateSupplierSchema>,
  ) {
    return this.suppliers.update(actor, id, body);
  }

  @Can('suppliers.view')
  @Get(':id/statement')
  statement(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.statement(id);
  }

  @Can('suppliers.view')
  @Get(':id/payments')
  payments(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.paymentsOf(id);
  }

  @Can('suppliers.view')
  @Get(':id/credit-notes')
  creditNotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.creditNotes(id);
  }

  @Can('suppliers.pay')
  @Post(':id/payments')
  pay(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(supplierPaySchema)) body: z.output<typeof supplierPaySchema>,
  ) {
    return this.suppliers.pay(actor, id, body);
  }
}

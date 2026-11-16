import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { courierSchema, courierSettlementSchema, updateCourierSchema } from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { CouriersService } from '../services/couriers.service.js';

@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Can('couriers.view')
  @Get()
  list() {
    return this.couriers.list();
  }

  @Can('couriers.view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.couriers.get(id);
  }

  @Can('couriers.manage')
  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(courierSchema)) body: z.output<typeof courierSchema>,
  ) {
    return this.couriers.create(actor, body);
  }

  @Can('couriers.manage')
  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateCourierSchema)) body: z.output<typeof updateCourierSchema>,
  ) {
    return this.couriers.update(actor, id, body);
  }

  @Can('couriers.view')
  @Get(':id/settlements')
  settlements(@Param('id', ParseUUIDPipe) id: string) {
    return this.couriers.settlements(id);
  }

  @Can('couriers.settle')
  @Post(':id/settlements')
  settle(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(courierSettlementSchema)) body: z.output<typeof courierSettlementSchema>,
  ) {
    return this.couriers.settle(actor, id, body);
  }
}

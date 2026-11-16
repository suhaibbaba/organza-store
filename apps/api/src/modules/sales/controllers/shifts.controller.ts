import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  cashMovementInputSchema,
  closeShiftSchema,
  countShiftSchema,
  openShiftSchema,
  registerInputSchema,
  signOffShiftSchema,
} from '@organza/shared';
import { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { ShiftsService } from '../services/shifts.service.js';

const updateRegisterSchema = registerInputSchema.extend({ isActive: z.boolean().default(true) });

@Controller()
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Can('shifts.operate')
  @Get('registers')
  registers() {
    return this.shifts.registers();
  }

  @Can('registers.manage')
  @Post('registers')
  createRegister(
    @CurrentUser() actor: Actor,
    @Body(zod(registerInputSchema)) body: z.output<typeof registerInputSchema>,
  ) {
    return this.shifts.saveRegister(actor, null, body.name);
  }

  @Can('registers.manage')
  @Patch('registers/:id')
  updateRegister(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateRegisterSchema)) body: z.output<typeof updateRegisterSchema>,
  ) {
    return this.shifts.saveRegister(actor, id, body.name, body.isActive);
  }

  @Can('shifts.viewAll')
  @Get('shifts')
  list(
    @Query('registerId') registerId?: string,
    @Query('attention') attention?: string,
    @Query('page') page?: string,
  ) {
    return this.shifts.list({
      registerId: registerId || undefined,
      needsAttention: attention === 'true',
      page: Math.max(1, Number(page) || 1),
    });
  }

  @Can('shifts.operate')
  @Post('shifts')
  open(
    @CurrentUser() actor: Actor,
    @Body(zod(openShiftSchema)) body: z.output<typeof openShiftSchema>,
  ) {
    return this.shifts.open(actor, body);
  }

  @Can('shifts.operate')
  @Get('shifts/:id')
  get(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.shifts.get(actor, id);
  }

  @Can('cash.paidInOut')
  @Post('shifts/:id/movements')
  movement(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(cashMovementInputSchema)) body: z.output<typeof cashMovementInputSchema>,
  ) {
    return this.shifts.addMovement(actor, id, body);
  }

  @Can('shifts.operate')
  @Post('shifts/:id/count')
  count(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(countShiftSchema)) body: z.output<typeof countShiftSchema>,
  ) {
    return this.shifts.count(actor, id, body);
  }

  @Can('shifts.recount')
  @Post('shifts/:id/recount')
  recount(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(countShiftSchema)) body: z.output<typeof countShiftSchema>,
  ) {
    return this.shifts.recount(actor, id, body);
  }

  @Can('shifts.operate')
  @Post('shifts/:id/close')
  close(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(closeShiftSchema)) body: z.output<typeof closeShiftSchema>,
  ) {
    return this.shifts.close(actor, id, body);
  }

  @Can('shifts.signOff')
  @Post('shifts/:id/sign-off')
  signOff(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(signOffShiftSchema)) body: z.output<typeof signOffShiftSchema>,
  ) {
    return this.shifts.signOff(actor, id, body.note);
  }
}

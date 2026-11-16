import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { createUserSchema, updateUserSchema } from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { type StaffRow, UsersService } from '../services/users.service.js';

@Controller('staff')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Can('staff.view')
  @Get()
  list(): Promise<StaffRow[]> {
    return this.users.list();
  }

  @Can('staff.manage')
  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(createUserSchema)) body: z.output<typeof createUserSchema>,
  ): Promise<StaffRow> {
    return this.users.create(actor, body);
  }

  @Can('staff.manage')
  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateUserSchema)) body: z.output<typeof updateUserSchema>,
  ): Promise<StaffRow> {
    return this.users.update(actor, id, body);
  }
}

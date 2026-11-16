import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  approvalDecisionSchema,
  approvalListQuerySchema,
  approvalRejectSchema,
  approvalRequestSchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { ApprovalsService } from '../services/approvals.service.js';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  /** Managers see everyone's requests; others only their own. */
  @Can('approvals.request')
  @Get()
  list(
    @CurrentUser() actor: Actor,
    @Query(zod(approvalListQuerySchema)) query: z.output<typeof approvalListQuerySchema>,
  ) {
    return this.approvals.list(actor, query);
  }

  @Can('approvals.request')
  @Post()
  request(
    @CurrentUser() actor: Actor,
    @Body(zod(approvalRequestSchema)) body: z.output<typeof approvalRequestSchema>,
  ) {
    return this.approvals.request(actor, body);
  }

  @Can('approvals.decide')
  @Post(':id/approve')
  approve(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(approvalDecisionSchema)) body: z.output<typeof approvalDecisionSchema>,
  ) {
    return this.approvals.approve(actor, id, body.note);
  }

  @Can('approvals.decide')
  @Post(':id/reject')
  reject(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(approvalRejectSchema)) body: z.output<typeof approvalRejectSchema>,
  ) {
    return this.approvals.reject(actor, id, body.note);
  }

  @Can('approvals.request')
  @Post(':id/cancel')
  cancel(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.cancel(actor, id);
  }
}

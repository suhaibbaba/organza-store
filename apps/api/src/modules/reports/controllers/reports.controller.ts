import { Controller, Get, Query } from '@nestjs/common';
import { dailyQuerySchema, reportRangeSchema, salesReportQuerySchema } from '@organza/shared';
import { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { ReportsService } from '../services/reports.service.js';

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** The Today screen; what it shows depends on the role. */
  @Can('activity.view')
  @Get('dashboard/today')
  today(@CurrentUser() actor: Actor) {
    return this.reports.today(actor);
  }

  @Can('activity.view')
  @Get('activity')
  activity(
    @CurrentUser() actor: Actor,
    @Query(zod(activityQuerySchema)) query: z.output<typeof activityQuerySchema>,
  ) {
    return this.reports.activity(actor, query.limit);
  }

  @Can('reports.view')
  @Get('reports/profit-and-loss')
  profitAndLoss(
    @CurrentUser() actor: Actor,
    @Query(zod(reportRangeSchema)) range: z.output<typeof reportRangeSchema>,
  ) {
    return this.reports.profitAndLoss(actor, range);
  }

  @Can('reports.view')
  @Get('reports/sales')
  sales(
    @CurrentUser() actor: Actor,
    @Query(zod(salesReportQuerySchema)) query: z.output<typeof salesReportQuerySchema>,
  ) {
    return this.reports.sales(actor, query);
  }

  @Can('reports.view')
  @Get('reports/cash')
  cash(@Query(zod(reportRangeSchema)) range: z.output<typeof reportRangeSchema>) {
    return this.reports.cash(range);
  }

  @Can('reports.view')
  @Get('reports/payment-methods')
  paymentMethods(@Query(zod(reportRangeSchema)) range: z.output<typeof reportRangeSchema>) {
    return this.reports.paymentMethods(range);
  }

  @Can('reports.view')
  @Get('reports/expenses')
  expenses(@Query(zod(reportRangeSchema)) range: z.output<typeof reportRangeSchema>) {
    return this.reports.expenses(range);
  }

  @Can('reports.view')
  @Get('reports/debts')
  debts() {
    return this.reports.debts();
  }

  @Can('reports.view')
  @Get('reports/supplier-debts')
  supplierDebts() {
    return this.reports.supplierDebts();
  }

  /** Inventory value is cost: Admin only. */
  @Can('reports.cost')
  @Get('reports/inventory')
  inventory() {
    return this.reports.inventory();
  }

  @Can('reports.view')
  @Get('reports/daily')
  daily(
    @CurrentUser() actor: Actor,
    @Query(zod(dailyQuerySchema)) query: z.output<typeof dailyQuerySchema>,
  ) {
    return this.reports.daily(actor, query.date);
  }
}

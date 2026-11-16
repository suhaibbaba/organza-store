import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  createCurrencySchema,
  currencyCodeSchema,
  type Currency,
  setRateSchema,
  type ShopSettings,
  updateCurrencySchema,
  updateShopSettingsSchema,
} from '@organza/shared';
import type { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { CurrenciesService } from '../services/currencies.service.js';
import { SettingsService } from '../services/settings.service.js';

@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly currencies: CurrenciesService,
  ) {}

  @Can('settings.view')
  @Get('settings')
  get(): Promise<ShopSettings> {
    return this.settings.get();
  }

  @Can('settings.manage')
  @Patch('settings')
  update(
    @CurrentUser() actor: Actor,
    @Body(zod(updateShopSettingsSchema)) body: z.output<typeof updateShopSettingsSchema>,
  ): Promise<ShopSettings> {
    return this.settings.update(actor, body);
  }

  @Can('currencies.view')
  @Get('currencies')
  list(): Promise<Currency[]> {
    return this.currencies.list();
  }

  @Can('currencies.manage')
  @Post('currencies')
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(createCurrencySchema)) body: z.output<typeof createCurrencySchema>,
  ): Promise<Currency> {
    return this.currencies.create(actor, body.code, body.rate);
  }

  @Can('currencies.setRate')
  @Put('currencies/:code/rate')
  setRate(
    @CurrentUser() actor: Actor,
    @Param('code', zod(currencyCodeSchema)) code: string,
    @Body(zod(setRateSchema)) body: z.output<typeof setRateSchema>,
  ): Promise<Currency> {
    return this.currencies.setRate(actor, code, body.rate);
  }

  @Can('currencies.manage')
  @Patch('currencies/:code')
  setActive(
    @CurrentUser() actor: Actor,
    @Param('code', zod(currencyCodeSchema)) code: string,
    @Body(zod(updateCurrencySchema)) body: z.output<typeof updateCurrencySchema>,
  ): Promise<Currency> {
    return this.currencies.setActive(actor, code, body.isActive);
  }
}

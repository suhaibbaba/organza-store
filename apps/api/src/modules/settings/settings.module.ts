import { Global, Module } from '@nestjs/common';
import { SettingsController } from './controllers/settings.controller.js';
import { CurrenciesService } from './services/currencies.service.js';
import { SettingsService } from './services/settings.service.js';

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, CurrenciesService],
  exports: [SettingsService, CurrenciesService],
})
export class SettingsModule {}

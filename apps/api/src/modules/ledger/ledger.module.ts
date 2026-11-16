import { Global, Module } from '@nestjs/common';
import { LedgerService } from './services/ledger.service.js';

@Global()
@Module({ providers: [LedgerService], exports: [LedgerService] })
export class LedgerModule {}

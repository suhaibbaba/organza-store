import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { OutboxService } from './services/outbox.service.js';

@Global()
@Module({
  providers: [AuditService, IdempotencyService, OutboxService],
  exports: [AuditService, IdempotencyService, OutboxService],
})
export class CommonModule {}

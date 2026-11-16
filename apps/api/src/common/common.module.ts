import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service.js';
import { DocumentsService } from './services/documents.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { OutboxService } from './services/outbox.service.js';

@Global()
@Module({
  providers: [AuditService, IdempotencyService, OutboxService, DocumentsService],
  exports: [AuditService, IdempotencyService, OutboxService, DocumentsService],
})
export class CommonModule {}

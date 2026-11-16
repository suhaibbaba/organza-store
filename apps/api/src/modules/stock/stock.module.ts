import { Global, Module } from '@nestjs/common';
import { StockController } from './controllers/stock.controller.js';
import { StockDocumentsService } from './services/stock-documents.service.js';
import { StockService } from './services/stock.service.js';

@Global()
@Module({
  controllers: [StockController],
  providers: [StockService, StockDocumentsService],
  exports: [StockService, StockDocumentsService],
})
export class StockModule {}

import { Module } from '@nestjs/common';
import { CatalogueImporter } from './catalogue-import.js';
import { HistoryImporter } from './history-import.js';

/** Cut-over tools. Not part of the running API; loaded only by the import CLIs and tests. */
@Module({
  providers: [CatalogueImporter, HistoryImporter],
  exports: [CatalogueImporter, HistoryImporter],
})
export class MigrationModule {}

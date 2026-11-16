import { Module } from '@nestjs/common';
import { CatalogueController } from './controllers/catalogue.controller.js';
import { ImagesController } from './controllers/images.controller.js';
import { BarcodesService } from './services/barcodes.service.js';
import { ImagesService } from './services/images.service.js';
import { CategoriesService } from './services/categories.service.js';
import { ItemsService } from './services/items.service.js';
import { ProductsService } from './services/products.service.js';

@Module({
  controllers: [CatalogueController, ImagesController],
  providers: [ProductsService, ImagesService, ItemsService, CategoriesService, BarcodesService],
  exports: [ProductsService, ItemsService, BarcodesService],
})
export class CatalogueModule {}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  addBarcodeSchema,
  addItemsSchema,
  archiveProductSchema,
  categoryInputSchema,
  labelsQuerySchema,
  createProductSchema,
  optionTypeInputSchema,
  optionValueInputSchema,
  productListQuerySchema,
  type ProductView,
  roleCan,
  setItemCostSchema,
  updateItemSchema,
  updateProductSchema,
} from '@organza/shared';
import { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { CategoriesService } from '../services/categories.service.js';
import { ItemsService } from '../services/items.service.js';
import { ProductsService } from '../services/products.service.js';

const categoryUpdateSchema = categoryInputSchema
  .partial()
  .extend({ archived: z.boolean().optional() });
const optionValueUpdateSchema = optionValueInputSchema
  .partial()
  .extend({ archived: z.boolean().optional() });
const labelsPrintedSchema = z.object({ productIds: z.array(z.uuid()).min(1).max(500) });

@Controller()
export class CatalogueController {
  constructor(
    private readonly products: ProductsService,
    private readonly itemsService: ItemsService,
    private readonly categories: CategoriesService,
  ) {}

  // Categories and options
  @Can('products.view')
  @Get('categories')
  listCategories(@Query('archived') archived?: string) {
    return this.categories.listCategories(archived === 'true');
  }

  @Can('catalogue.manage')
  @Post('categories')
  createCategory(
    @CurrentUser() actor: Actor,
    @Body(zod(categoryInputSchema)) body: z.output<typeof categoryInputSchema>,
  ) {
    return this.categories.createCategory(actor, body);
  }

  @Can('catalogue.manage')
  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(categoryUpdateSchema)) body: z.output<typeof categoryUpdateSchema>,
  ) {
    return this.categories.updateCategory(actor, id, body);
  }

  @Can('products.view')
  @Get('option-types')
  listOptionTypes() {
    return this.categories.listOptionTypes();
  }

  @Can('catalogue.manage')
  @Post('option-types')
  createOptionType(
    @CurrentUser() actor: Actor,
    @Body(zod(optionTypeInputSchema)) body: z.output<typeof optionTypeInputSchema>,
  ) {
    return this.categories.createOptionType(actor, body);
  }

  /** Employees add values while creating a variant product (a new colour), so products.create. */
  @Can('products.create')
  @Post('option-types/:id/values')
  createOptionValue(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(optionValueInputSchema)) body: z.output<typeof optionValueInputSchema>,
  ) {
    return this.categories.createOptionValue(actor, id, body);
  }

  @Can('catalogue.manage')
  @Patch('option-values/:id')
  updateOptionValue(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(optionValueUpdateSchema)) body: z.output<typeof optionValueUpdateSchema>,
  ) {
    return this.categories.updateOptionValue(actor, id, body);
  }

  // Products
  @Can('products.view')
  @Get('products')
  list(@Query(zod(productListQuerySchema)) query: z.output<typeof productListQuerySchema>) {
    return this.products.list(query);
  }

  @Can('products.view')
  @Get('products/lookup/:code')
  lookup(@Param('code') code: string) {
    return this.products.lookup(code);
  }

  @Can('products.viewCost')
  @Get('products/unknown-cost')
  unknownCost() {
    return this.products.unknownCostItems();
  }

  @Can('products.view')
  @Get('products/:id')
  get(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string): Promise<ProductView> {
    return this.products.get(id, actor);
  }

  @Can('products.create')
  @Post('products')
  create(
    @CurrentUser() actor: Actor,
    @Body(zod(createProductSchema)) body: z.output<typeof createProductSchema>,
  ): Promise<ProductView> {
    return this.products.create(actor, body);
  }

  @Can('products.edit')
  @Patch('products/:id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateProductSchema)) body: z.output<typeof updateProductSchema>,
  ): Promise<ProductView> {
    return this.products.update(actor, id, body, (c) => roleCan(actor.role, c));
  }

  @Can('products.archive')
  @Post('products/:id/archive')
  archive(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(archiveProductSchema)) body: z.output<typeof archiveProductSchema>,
  ) {
    return this.itemsService.archiveProduct(actor, id, body);
  }

  @Can('products.create')
  @Post('products/:id/items')
  addItems(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(addItemsSchema)) body: z.output<typeof addItemsSchema>,
  ) {
    return this.itemsService.addItems(actor, id, body);
  }

  @Can('products.edit')
  @Post('products/:id/barcodes')
  addBarcode(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(addBarcodeSchema)) body: z.output<typeof addBarcodeSchema>,
  ) {
    return this.itemsService.addBarcode(actor, id, body.code, body.itemId);
  }

  @Can('products.edit')
  @Patch('items/:id')
  updateItem(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(updateItemSchema)) body: z.output<typeof updateItemSchema>,
  ) {
    return this.itemsService.updateItem(actor, id, body, roleCan(actor.role, 'products.editPrice'));
  }

  @Can('products.viewCost')
  @Post('items/:id/cost')
  setCost(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(setItemCostSchema)) body: z.output<typeof setItemCostSchema>,
  ) {
    return this.itemsService.setCost(actor, id, body.cost);
  }

  @Can('labels.print')
  @Get('labels')
  labels(@Query(zod(labelsQuerySchema)) query: z.output<typeof labelsQuerySchema>) {
    return this.products.labels(query.productIds, query.itemIds);
  }

  @Can('labels.print')
  @Post('labels/printed')
  labelsPrinted(
    @CurrentUser() actor: Actor,
    @Body(zod(labelsPrintedSchema)) body: z.output<typeof labelsPrintedSchema>,
  ) {
    return this.itemsService.markLabelsPrinted(actor, body.productIds);
  }
}

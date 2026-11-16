import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { IDENTITY_IMAGE_EDIT, imageEditSchema } from '@organza/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { type Actor, Can, CurrentUser } from '../../../common/decorators/auth.decorators.js';
import { badRequest } from '../../../common/lib/app-error.js';
import { zod } from '../../../common/lib/zod-pipe.js';
import { ImagesService } from '../services/images.service.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const uploadFieldsSchema = z.object({
  productId: z.uuid().optional(),
  itemId: z.uuid().optional(),
  edit: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return IDENTITY_IMAGE_EDIT;
      try {
        return imageEditSchema.parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'INVALID_EDIT' });
        return z.NEVER;
      }
    }),
});

@Controller()
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  /** multipart/form-data: `file`, plus optional `productId`, `itemId`, `edit` (JSON). */
  @Can('images.upload')
  @Post('images')
  async upload(@CurrentUser() actor: Actor, @Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw badRequest('IMAGE_MISSING', 'No file');
    if (!ALLOWED.includes(part.mimetype))
      throw badRequest('IMAGE_INVALID', 'JPEG, PNG or WebP only');
    const buffer = await part.toBuffer();
    const fields = Object.fromEntries(
      Object.entries(part.fields)
        .filter(([key]) => key !== 'file')
        .map(([key, field]) => [key, field && 'value' in field ? String(field.value) : undefined]),
    );
    const parsed = uploadFieldsSchema.parse(fields);
    return this.images.upload(actor, buffer, parsed.edit, {
      ...(parsed.productId && { productId: parsed.productId }),
      ...(parsed.itemId && { itemId: parsed.itemId }),
    });
  }

  @Can('images.upload')
  @Post('images/:id/crop')
  recrop(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(imageEditSchema)) edit: z.output<typeof imageEditSchema>,
  ) {
    return this.images.recrop(actor, id, edit);
  }

  @Can('images.upload')
  @Patch('images/:id')
  setItem(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(z.object({ itemId: z.uuid().nullable() }))) body: { itemId: string | null },
  ) {
    return this.images.setItem(actor, id, body.itemId);
  }

  @Can('products.edit')
  @Post('products/:id/images/order')
  reorder(
    @CurrentUser() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zod(z.object({ imageIds: z.array(z.uuid()).min(1).max(20) })))
    body: { imageIds: string[] },
  ) {
    return this.images.reorder(actor, id, body.imageIds);
  }

  @Can('images.delete')
  @Delete('images/:id')
  async remove(@CurrentUser() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    await this.images.remove(actor, id);
    return { ok: true };
  }
}

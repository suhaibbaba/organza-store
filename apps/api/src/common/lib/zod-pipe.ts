import { type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** `@Body(zod(schema))`: parses and strips the input with a shared schema. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}

export const zod = <T>(schema: ZodType<T>): ZodPipe<T> => new ZodPipe(schema);

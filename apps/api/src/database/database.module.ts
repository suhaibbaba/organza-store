import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';
import type { Database } from './unit-of-work.js';

export const DATABASE = Symbol('DATABASE');
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export const InjectDb = (): ParameterDecorator => Inject(DATABASE);

export function createClient(url = env().DATABASE_URL): postgres.Sql {
  return postgres(url, {
    max: 10,
    onnotice: () => undefined,
    // numeric and bigint stay strings so money is never a float.
    types: { bigint: postgres.BigInt },
  });
}

@Global()
@Module({
  providers: [
    { provide: POSTGRES_CLIENT, useFactory: () => createClient() },
    {
      provide: DATABASE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: postgres.Sql): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DATABASE, POSTGRES_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createUserSchema } from '@organza/shared';
import { AppModule } from '../app.module.js';
import { UsersService } from '../modules/users/services/users.service.js';

/** `node dist/database/create-admin-cli.js <email> <name> <password>`: first admin account. */
async function main(): Promise<void> {
  const [email, name, password] = process.argv.slice(2);
  const input = createUserSchema.parse({ email, name, password, role: 'ADMIN' });
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const user = await app.get(UsersService).create(null, input);
    process.stdout.write(`Created admin ${user.email}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});

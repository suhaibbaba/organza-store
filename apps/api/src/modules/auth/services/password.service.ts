import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { ARGON2_OPTIONS } from '../constants.js';

@Injectable()
export class PasswordService {
  private decoy: Promise<string> | undefined;

  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTIONS);
  }

  async verify(digest: string, plain: string): Promise<boolean> {
    try {
      return await verify(digest, plain, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }

  /** Spends the same time as a real check so a missing account cannot be told apart. */
  async burnTiming(plain: string): Promise<void> {
    this.decoy ??= this.hash('decoy-password-for-timing');
    await this.verify(await this.decoy, plain);
  }
}

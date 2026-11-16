import { scrypt, timingSafeEqual } from 'node:crypto';
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

  /**
   * Checks a password against a hash carried over from the old system (Better Auth's scrypt:
   * N=16384, r=16, p=1, 64-byte key; stored as "<hex salt>:<hex key>", the salt string itself is
   * the salt). Used once per person: a match is re-hashed with argon2.
   */
  async verifyLegacy(stored: string, plain: string): Promise<boolean> {
    const [salt, key] = stored.split(':');
    if (!salt || !key || !/^[0-9a-f]+$/i.test(key)) return false;
    const target = Buffer.from(key, 'hex');
    const derived = await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        plain.normalize('NFKC'),
        salt,
        64,
        { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
        (err, out) => (err ? reject(err) : resolve(out)),
      ),
    );
    return derived.length === target.length && timingSafeEqual(derived, target);
  }

  /** Spends the same time as a real check so a missing account cannot be told apart. */
  async burnTiming(plain: string): Promise<void> {
    this.decoy ??= this.hash('decoy-password-for-timing');
    await this.verify(await this.decoy, plain);
  }
}

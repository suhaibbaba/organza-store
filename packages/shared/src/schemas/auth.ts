import { z } from 'zod';
import { LANGUAGES, ROLES } from '../roles.js';

export const emailSchema = z.string().trim().toLowerCase().max(200).pipe(z.email());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  persistent: z.boolean().default(true),
  /** Desktop keeps the refresh token in the OS secure store and receives it in the body. */
  client: z.enum(['web', 'desktop']).default('web'),
});
export type LoginInput = z.input<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10).max(200).optional() });

export const passwordSchema = z.string().min(8).max(200);

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(32).optional(),
  role: z.enum(ROLES),
  language: z.enum(LANGUAGES).default('ar'),
  password: passwordSchema,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  role: z.enum(ROLES).optional(),
  language: z.enum(LANGUAGES).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: (typeof ROLES)[number];
  language: (typeof LANGUAGES)[number];
  capabilities: string[];
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
  /** Only for the desktop client; the web client gets an httpOnly cookie instead. */
  refreshToken?: string;
}

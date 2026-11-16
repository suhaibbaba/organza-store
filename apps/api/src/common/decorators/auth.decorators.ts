import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Capability, Role } from '@organza/shared';

export const IS_PUBLIC_KEY = 'organza:public';
export const CAPABILITY_KEY = 'organza:capability';

/** No sign-in needed (login, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The capability a route needs. Every non-public route must declare one (checked at boot). */
export const Can = (capability: Capability) => SetMetadata(CAPABILITY_KEY, capability);

export interface Actor {
  id: string;
  role: Role;
  name: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<{ actor?: Actor }>();
  if (!request.actor) throw new Error('CurrentUser used on a public route');
  return request.actor;
});

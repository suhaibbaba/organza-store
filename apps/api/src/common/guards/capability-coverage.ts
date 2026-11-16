import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { CAPABILITY_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators.js';

/** Refuses to start if any route is neither @Public() nor declares a capability with @Can(). */
@Injectable()
export class CapabilityCoverage implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const missing: string[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const prototype = Object.getPrototypeOf(instance) as object;
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[name] as object;
        if (this.reflector.get(PATH_METADATA, handler as never) === undefined) continue;
        const targets = [handler, metatype] as never[];
        if (this.reflector.getAllAndOverride(IS_PUBLIC_KEY, targets)) continue;
        if (this.reflector.getAllAndOverride(CAPABILITY_KEY, targets)) continue;
        missing.push(`${metatype.name}.${name}`);
      }
    }
    if (missing.length) throw new Error(`Routes without @Can or @Public: ${missing.join(', ')}`);
  }
}

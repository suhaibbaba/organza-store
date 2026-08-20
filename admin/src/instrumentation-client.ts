/*
 * Next runs this file on the client before any of the app's own code, which
 * makes it the one place a polyfill can be installed early enough to matter.
 *
 * Nothing else belongs here. It is on the critical path of every cold start,
 * so anything added is time the shop spends looking at the boot splash.
 */
import { installLegacyPolyfills } from "@/lib/compat/polyfills";

installLegacyPolyfills();

import { LOCALHOST } from "@/constants";

function appOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);
}

// The longest domain every app shares (admin.x + pos.x → x), so one passkey signs in to both.
function sharedDomain(hostnames: string[]): string | undefined {
  if (hostnames.length === 0) {
    return undefined;
  }
  const labels = hostnames.map((host) => host.split(".").reverse());
  const shared: string[] = [];
  for (let i = 0; labels.every((parts) => i < parts.length && parts[i] === labels[0][i]); i += 1) {
    shared.push(labels[0][i]);
  }
  const domain = shared.reverse().join(".");
  return domain === LOCALHOST || shared.length >= 2 ? domain : undefined;
}

// PASSKEY_RP_ID wins; otherwise the apps' shared domain, read from CORS_ORIGINS.
export function passkeyRpId(): string | undefined {
  if (process.env.PASSKEY_RP_ID) {
    return process.env.PASSKEY_RP_ID;
  }
  const hostnames = appOrigins().flatMap((origin) => {
    try {
      return [new URL(origin).hostname];
    } catch {
      return [];
    }
  });
  return sharedDomain(hostnames);
}

// Only the shop's own apps may complete a passkey ceremony, never whatever Origin a caller sends.
export function passkeyOrigins(): string[] {
  return appOrigins();
}

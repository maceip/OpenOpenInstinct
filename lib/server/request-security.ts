import "server-only";
import { env } from "@/lib/env";

const configuredOrigin = new URL(env.PUBLIC_URL);

export function isAllowedRequestHost(headers: Headers) {
  const host = headers.get("host")?.trim().toLowerCase();
  return host === configuredOrigin.host.toLowerCase();
}

export function isAllowedMutationOrigin(headers: Headers) {
  const origin = headers.get("origin")?.trim();
  if (!origin) return false;

  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin && parsed.origin === configuredOrigin.origin
    );
  } catch {
    return false;
  }
}

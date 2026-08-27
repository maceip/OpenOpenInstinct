import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export function principalIdForInstance(instanceId = env.AUTH_INSTANCE_ID) {
  return createHash("sha256")
    .update("openopeninstinct-principal-v1\0")
    .update(instanceId)
    .digest("base64url");
}

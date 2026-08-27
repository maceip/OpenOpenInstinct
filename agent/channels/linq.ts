/* oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Eve's Linq adapter exposes the thread through a transitive Chat SDK type; TypeScript still checks this contextual handler. */
import { defaultLinqAuth, linqChannel } from "eve/channels/linq";
import { accessScopeForUser } from "@/lib/access-scope";
import { env } from "@/lib/env";
import { normalizeAuthPhoneNumber } from "@/lib/phone-number";
import { principalIdForInstance } from "@/lib/server/auth-identity";

export default linqChannel({
  credentials: {
    apiKey: env.LINQ_API_KEY,
    signingSecret: env.LINQ_WEBHOOK_SECRET,
  },
  async onMessage(_context, message) {
    if (message.author.isBot) return null;

    const auth = defaultLinqAuth(message);
    const authorUserName: unknown = message.author.userName;
    const phoneNumber =
      typeof authorUserName === "string"
        ? normalizeAuthPhoneNumber(authorUserName)
        : undefined;
    if (!phoneNumber || phoneNumber !== env.OWNER_PHONE_NUMBER) return null;

    const principalId = `device-auth:${principalIdForInstance()}`;
    const scope = accessScopeForUser(principalId);
    return {
      auth: {
        ...auth,
        attributes: {
          ...auth.attributes,
          workspaceId: scope.workspaceId,
        },
        principalId,
      },
    };
  },
});

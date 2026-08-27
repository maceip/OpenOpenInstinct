import { ensureScope } from "@/db/services/scope";
import { listVaultItems } from "@/db/services/vault";
import type { AccessScope } from "@/lib/access-scope";
import { hasSecret } from "@/lib/server/secret-store";

export async function readManagerVaultItems(scope: AccessScope) {
  await ensureScope(scope);
  const rows = await listVaultItems(scope);
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      hasSecret: await hasSecret({
        id: row.id,
        namespace: "vault",
        scope,
      }),
    }))
  );
}

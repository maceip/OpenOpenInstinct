import { z } from "zod";
import type { AccessScope } from "@/lib/access-scope";
import { vaultItemKindSchema } from "@/lib/manager";
import { getDatabase } from "@/db";

const vaultRecordSchema = z.object({
  account: z.string(),
  createdAt: z.string(),
  id: z.string(),
  kind: vaultItemKindSchema,
  label: z.string(),
  updatedAt: z.string(),
});

type VaultRecord = z.infer<typeof vaultRecordSchema>;

export async function createVaultItem(scope: AccessScope, record: VaultRecord) {
  getDatabase()
    .prepare(
      `INSERT INTO vault_items
         (id, workspace_id, kind, label, account, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      scope.workspaceId,
      record.kind,
      record.label,
      record.account,
      record.createdAt,
      record.updatedAt
    );
}

export async function listVaultItems(scope: AccessScope) {
  return vaultRecordSchema.array().parse(
    getDatabase()
      .prepare(
        `SELECT
             id,
             kind,
             label,
             account,
             created_at AS createdAt,
             updated_at AS updatedAt
           FROM vault_items
           WHERE workspace_id = ?
           ORDER BY updated_at DESC`
      )
      .all(scope.workspaceId)
  );
}

export async function readVaultItem(scope: AccessScope, id: string) {
  return vaultRecordSchema.optional().parse(
    getDatabase()
      .prepare(
        `SELECT
           id,
           kind,
           label,
           account,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM vault_items
         WHERE workspace_id = ? AND id = ?`
      )
      .get(scope.workspaceId, id)
  );
}

export async function deleteVaultItem(scope: AccessScope, id: string) {
  const result = getDatabase()
    .prepare("DELETE FROM vault_items WHERE workspace_id = ? AND id = ?")
    .run(scope.workspaceId, id);
  return result.changes > 0;
}

import type { AccessScope } from "@/lib/access-scope";
import { getDatabase } from "@/db";

export async function writeEncryptedSecret(
  scope: AccessScope,
  id: string,
  encryptedValue: string
) {
  const updatedAt = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO encrypted_secrets
         (workspace_id, namespace, id, encrypted_value, updated_at)
       VALUES (?, 'vault', ?, ?, ?)
       ON CONFLICT(workspace_id, namespace, id) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_at = excluded.updated_at`
    )
    .run(scope.workspaceId, id, encryptedValue, updatedAt);
}

export async function readEncryptedSecret(scope: AccessScope, id: string) {
  const row = getDatabase()
    .prepare(
      `SELECT encrypted_value AS encryptedValue
       FROM encrypted_secrets
       WHERE workspace_id = ? AND namespace = 'vault' AND id = ?`
    )
    .get(scope.workspaceId, id);
  return typeof row?.encryptedValue === "string"
    ? row.encryptedValue
    : undefined;
}

export async function deleteEncryptedSecret(scope: AccessScope, id: string) {
  getDatabase()
    .prepare(
      `DELETE FROM encrypted_secrets
       WHERE workspace_id = ? AND namespace = 'vault' AND id = ?`
    )
    .run(scope.workspaceId, id);
}

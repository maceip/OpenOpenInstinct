import type { AccessScope } from "@/lib/access-scope";
import { getDatabase } from "@/db";

export type SecretNamespace = "google-oauth" | "vault";

export async function writeEncryptedSecret(
  scope: AccessScope,
  namespace: SecretNamespace,
  id: string,
  encryptedValue: string
) {
  const updatedAt = new Date().toISOString();
  getDatabase()
    .prepare(
      `INSERT INTO encrypted_secrets
         (workspace_id, namespace, id, encrypted_value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, namespace, id) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_at = excluded.updated_at`
    )
    .run(scope.workspaceId, namespace, id, encryptedValue, updatedAt);
}

export async function readEncryptedSecret(
  scope: AccessScope,
  namespace: SecretNamespace,
  id: string
) {
  const row = getDatabase()
    .prepare(
      `SELECT encrypted_value AS encryptedValue
       FROM encrypted_secrets
       WHERE workspace_id = ? AND namespace = ? AND id = ?`
    )
    .get(scope.workspaceId, namespace, id);
  return typeof row?.encryptedValue === "string"
    ? row.encryptedValue
    : undefined;
}

export async function deleteEncryptedSecret(
  scope: AccessScope,
  namespace: SecretNamespace,
  id: string
) {
  getDatabase()
    .prepare(
      `DELETE FROM encrypted_secrets
       WHERE workspace_id = ? AND namespace = ? AND id = ?`
    )
    .run(scope.workspaceId, namespace, id);
}

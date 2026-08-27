import type { AccessScope } from "@/lib/access-scope";
import { withTransaction } from "@/db";

export async function ensureScope(scope: AccessScope) {
  const createdAt = new Date().toISOString();
  withTransaction((database) => {
    database
      .prepare(
        `INSERT INTO workspaces (id, created_at)
         VALUES (?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(scope.workspaceId, createdAt);
    database
      .prepare(
        `INSERT INTO workspace_memberships
           (workspace_id, user_id, role, created_at)
         VALUES (?, ?, 'owner', ?)
         ON CONFLICT(workspace_id, user_id) DO NOTHING`
      )
      .run(scope.workspaceId, scope.userId, createdAt);
  });
}

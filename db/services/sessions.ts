import type { AccessScope } from "@/lib/access-scope";
import { getDatabase } from "@/db";

export async function claimSession(scope: AccessScope, sessionId: string) {
  getDatabase()
    .prepare(
      `INSERT INTO agent_sessions
         (session_id, workspace_id, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO NOTHING`
    )
    .run(sessionId, scope.workspaceId, scope.userId, new Date().toISOString());
}

export async function isSessionOwned(scope: AccessScope, sessionId: string) {
  return Boolean(
    getDatabase()
      .prepare(
        `SELECT 1
         FROM agent_sessions
         WHERE workspace_id = ? AND session_id = ?`
      )
      .get(scope.workspaceId, sessionId)
  );
}

export async function listOwnedSessionIds(scope: AccessScope) {
  const rows = getDatabase()
    .prepare(
      `SELECT session_id AS sessionId
       FROM agent_sessions
       WHERE workspace_id = ?`
    )
    .all(scope.workspaceId);
  return new Set(
    rows.flatMap((row) =>
      typeof row.sessionId === "string" ? [row.sessionId] : []
    )
  );
}

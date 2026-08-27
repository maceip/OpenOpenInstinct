import { z } from "zod";
import type { AccessScope } from "@/lib/access-scope";
import { getDatabase } from "@/db";

const browserSessionSchema = z.object({
  createdAt: z.string(),
  sessionId: z.string().min(1),
});
type BrowserSessionRecord = z.infer<typeof browserSessionSchema>;

export async function createBrowserSession(
  scope: AccessScope,
  record: BrowserSessionRecord
) {
  getDatabase()
    .prepare(
      `INSERT INTO browser_sessions
         (session_id, workspace_id, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(record.sessionId, scope.workspaceId, scope.userId, record.createdAt);
}

export async function listBrowserSessions(scope: AccessScope) {
  return browserSessionSchema.array().parse(
    getDatabase()
      .prepare(
        `SELECT created_at AS createdAt, session_id AS sessionId
         FROM browser_sessions
         WHERE workspace_id = ?
         ORDER BY created_at DESC`
      )
      .all(scope.workspaceId)
  );
}

export async function readBrowserSession(
  scope: AccessScope,
  sessionId: string
) {
  return browserSessionSchema.optional().parse(
    getDatabase()
      .prepare(
        `SELECT created_at AS createdAt, session_id AS sessionId
         FROM browser_sessions
         WHERE workspace_id = ? AND session_id = ?`
      )
      .get(scope.workspaceId, sessionId)
  );
}

export async function deleteBrowserSession(
  scope: AccessScope,
  sessionId: string
) {
  const result = getDatabase()
    .prepare(
      `DELETE FROM browser_sessions
       WHERE workspace_id = ? AND session_id = ?`
    )
    .run(scope.workspaceId, sessionId);
  return result.changes > 0;
}

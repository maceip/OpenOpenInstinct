import { z } from "zod";
import type { AccessScope } from "@/lib/access-scope";
import { chatListSchema, type ChatSummary, type SaveChat } from "@/lib/chat";
import { getDatabase } from "@/db";
import { ensureScope } from "./scope";

const chatRowSchema = z.object({
  costUsd: z.number().nonnegative().nullable(),
  createdAt: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  title: z.string().min(1),
  updatedAt: z.string(),
});

function toChatSummary(row: z.infer<typeof chatRowSchema>): ChatSummary {
  const { costUsd, inputTokens, outputTokens, ...chat } = row;
  return {
    ...chat,
    usage: { costUsd, inputTokens, outputTokens },
  };
}

export async function listChats(scope: AccessScope) {
  const rows = chatRowSchema
    .array()
    .parse(
      getDatabase()
        .prepare(
          `SELECT
             session_id AS sessionId,
             title,
             created_at AS createdAt,
             updated_at AS updatedAt,
             input_tokens AS inputTokens,
             output_tokens AS outputTokens,
             cost_usd AS costUsd
           FROM chats
           WHERE workspace_id = ?
           ORDER BY updated_at DESC`
        )
        .all(scope.workspaceId)
    );
  return chatListSchema.parse(rows.map(toChatSummary));
}

export async function readChat(scope: AccessScope, sessionId: string) {
  const row = chatRowSchema.optional().parse(
    getDatabase()
      .prepare(
        `SELECT
           session_id AS sessionId,
           title,
           created_at AS createdAt,
           updated_at AS updatedAt,
           input_tokens AS inputTokens,
           output_tokens AS outputTokens,
           cost_usd AS costUsd
         FROM chats
         WHERE workspace_id = ? AND session_id = ?`
      )
      .get(scope.workspaceId, sessionId)
  );
  return row ? toChatSummary(row) : undefined;
}

export async function saveChat(scope: AccessScope, chat: SaveChat) {
  await ensureScope(scope);
  const now = new Date().toISOString();
  const database = getDatabase();
  const existing = database
    .prepare(
      `SELECT 1 FROM chats WHERE workspace_id = ? AND session_id = ?`
    )
    .get(scope.workspaceId, chat.sessionId);
  if (!existing) {
    database
      .prepare(
        `INSERT INTO chats
           (session_id, workspace_id, title, created_at, updated_at,
            input_tokens, output_tokens, cost_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chat.sessionId,
        scope.workspaceId,
        chat.title ?? "New chat",
        now,
        now,
        chat.usage?.inputTokens ?? 0,
        chat.usage?.outputTokens ?? 0,
        chat.usage?.costUsd ?? null
      );
    return;
  }

  const assignments = ["updated_at = ?"];
  const values: Array<number | string | null> = [now];
  if (chat.title !== undefined) {
    assignments.push("title = ?");
    values.push(chat.title);
  }
  if (chat.usage !== undefined) {
    assignments.push(
      "input_tokens = ?",
      "output_tokens = ?",
      "cost_usd = ?"
    );
    values.push(
      chat.usage.inputTokens,
      chat.usage.outputTokens,
      chat.usage.costUsd
    );
  }
  database
    .prepare(
      `UPDATE chats SET ${assignments.join(", ")}
       WHERE workspace_id = ? AND session_id = ?`
    )
    .run(...values, scope.workspaceId, chat.sessionId);
}

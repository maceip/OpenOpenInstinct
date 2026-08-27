import { listOwnedSessionIds } from "@/db/services/sessions";
import { taskHistoryPageSchema } from "@/lib/task-history";
import {
  InvalidTaskHistoryCursorError,
  listLocalTaskHistory,
} from "@/lib/server/local-task-history";
import {
  requireRequestScope,
  UnauthenticatedError,
  unauthorizedResponse,
} from "@/lib/server/request-scope";

export const runtime = "nodejs";

const pageSize = 25;
export async function GET(request: Request) {
  try {
    const scope = await requireRequestScope();
    const ownedSessionIds = await listOwnedSessionIds(scope);
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    const body = taskHistoryPageSchema.parse(
      await listLocalTaskHistory({ cursor, ownedSessionIds, limit: pageSize })
    );

    return Response.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return unauthorizedResponse();
    if (error instanceof InvalidTaskHistoryCursorError) {
      return Response.json(
        { error: "Invalid task history cursor." },
        { status: 400 }
      );
    }
    console.error("Unable to read task history", error);
    return Response.json(
      { error: "Unable to read the durable task history." },
      { status: 500 }
    );
  }
}

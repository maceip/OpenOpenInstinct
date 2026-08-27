import { listChats, saveChat } from "@/db/services/chats";
import { chatListSchema, saveChatSchema } from "@/lib/chat";
import {
  requireRequestScope,
  UnauthenticatedError,
  unauthorizedResponse,
} from "@/lib/server/request-scope";
import { isAllowedMutationOrigin } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const scope = await requireRequestScope();
    return Response.json(chatListSchema.parse(await listChats(scope)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return unauthorizedResponse();
    return chatError(
      error instanceof Error ? error.message : "Unable to load chats."
    );
  }
}

export async function POST(request: Request) {
  try {
    const scope = await requireRequestScope();
    const denied = denyCrossOriginMutation(request);
    if (denied) return denied;
    const chat = saveChatSchema.parse(await request.json());
    await saveChat(scope, chat);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return unauthorizedResponse();
    return chatError(
      error instanceof Error ? error.message : "Unable to save chat."
    );
  }
}

function denyCrossOriginMutation(request: Request) {
  if (!isAllowedMutationOrigin(request.headers)) {
    return Response.json(
      { error: "Cross-origin chat writes are blocked." },
      { status: 403 }
    );
  }
}

function chatError(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

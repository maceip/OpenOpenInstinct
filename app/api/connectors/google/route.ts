import { z } from "zod";
import { env } from "@/lib/env";
import { googleWorkspaceActionSchema } from "@/lib/google-workspace/config";
import {
  abandonGoogleWorkspaceAuthorization,
  completeGoogleWorkspaceAuthorization,
  disconnectGoogleWorkspace,
  startGoogleWorkspaceAuthorization,
} from "@/lib/server/google-workspace";
import {
  requireRequestScope,
  UnauthenticatedError,
  unauthorizedResponse,
} from "@/lib/server/request-scope";
import {
  isAllowedMutationOrigin,
  isAllowedRequestHost,
} from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    if (!isAllowedRequestHost(request.headers)) return invalidHost();
    const scope = await requireRequestScope();
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    if (url.searchParams.has("error")) {
      if (state) await abandonGoogleWorkspaceAuthorization(scope, state);
      return redirectHome("disconnected");
    }
    const callback = callbackSchema.parse({
      code: url.searchParams.get("code"),
      state,
    });
    await completeGoogleWorkspaceAuthorization(scope, callback);
    return redirectHome("connected");
  } catch (error) {
    if (error instanceof UnauthenticatedError) return unauthorizedResponse();
    console.error("Google Workspace authorization failed", error);
    return redirectHome("unavailable");
  }
}

export async function POST(request: Request) {
  try {
    if (!isAllowedRequestHost(request.headers)) return invalidHost();
    if (!isAllowedMutationOrigin(request.headers)) {
      return Response.json(
        { error: "Cross-origin connection writes are blocked." },
        { status: 403 }
      );
    }
    const scope = await requireRequestScope();
    const form = await request.formData();
    const action = googleWorkspaceActionSchema.parse(form.get("action"));
    if (action === "connect") {
      return sensitiveRedirect(await startGoogleWorkspaceAuthorization(scope));
    }
    await disconnectGoogleWorkspace(scope);
    return redirectHome("disconnected");
  } catch (error) {
    if (error instanceof UnauthenticatedError) return unauthorizedResponse();
    console.error("Google Workspace connection update failed", error);
    return redirectHome("unavailable");
  }
}

function redirectHome(status: "connected" | "disconnected" | "unavailable") {
  const url = new URL("/", env.PUBLIC_URL);
  url.searchParams.set("google", status);
  return sensitiveRedirect(url);
}

function invalidHost() {
  return Response.json({ error: "Invalid request host." }, { status: 421 });
}

function sensitiveRedirect(url: string | URL) {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Expires: "0",
      Location: url.toString(),
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
    },
    status: 303,
  });
}

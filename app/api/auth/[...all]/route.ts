import {
  AuthError,
  createDeviceChallenge,
  getAuthSession,
  pairDevice,
  redeemDevice,
  signOut,
} from "@/auth";
import {
  isAllowedMutationOrigin,
  isAllowedRequestHost,
} from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly all: readonly string[] }> }
) {
  const denied = denyRequest(request, false);
  if (denied) return denied;
  const action = (await context.params).all.join("/");
  if (action !== "session") return notFound();
  const session = await getAuthSession(request.headers);
  return Response.json(session, {
    headers: { "Cache-Control": "no-store" },
    status: session ? 200 : 401,
  });
}

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly all: readonly string[] }> }
) {
  const denied = denyRequest(request, true);
  if (denied) return denied;
  try {
    const action = (await context.params).all.join("/");
    switch (action) {
      case "challenge":
        return Response.json(createDeviceChallenge(await readJson(request)), {
          headers: { "Cache-Control": "no-store" },
          status: 201,
        });
      case "pair": {
        const result = pairDevice(await readJson(request));
        return sessionResponse(
          { continueUrl: result.continueUrl, ...result.session },
          result.cookie
        );
      }
      case "redeem": {
        const result = redeemDevice(await readJson(request));
        return sessionResponse(result.session, result.cookie);
      }
      case "sign-out":
        return sessionResponse({ ok: true }, signOut(request.headers));
      default:
        return notFound();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json(
        { error: error.message },
        { headers: { "Cache-Control": "no-store" }, status: error.status }
      );
    }
    console.error("Device authentication request failed", error);
    return Response.json(
      { error: "The authentication request could not be completed." },
      { headers: { "Cache-Control": "no-store" }, status: 400 }
    );
  }
}

async function readJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    throw new AuthError("Authentication requests must use JSON.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 32_768) {
    throw new AuthError("The authentication request is too large.", 413);
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) {
    throw new AuthError("The authentication request is too large.", 413);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AuthError("The authentication request is not valid JSON.", 400);
  }
}

function denyRequest(request: Request, mutation: boolean) {
  if (!isAllowedRequestHost(request.headers)) {
    return Response.json({ error: "Invalid request host." }, { status: 421 });
  }
  if (mutation && !isAllowedMutationOrigin(request.headers)) {
    return Response.json(
      { error: "Cross-origin authentication requests are blocked." },
      { status: 403 }
    );
  }
}

function sessionResponse(body: unknown, cookie: string) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": cookie,
    },
    status: 201,
  });
}

function notFound() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

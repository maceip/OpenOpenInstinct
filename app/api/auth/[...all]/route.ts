import {
  AuthError,
  createDeviceChallenge,
  getAuthSession,
  pairDevice,
  redeemDevice,
  signOut,
} from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly all: readonly string[] }> }
) {
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
  try {
    const action = (await context.params).all.join("/");
    switch (action) {
      case "challenge":
        return Response.json(createDeviceChallenge(await request.json()), {
          headers: { "Cache-Control": "no-store" },
          status: 201,
        });
      case "pair": {
        const result = pairDevice(await request.json());
        return sessionResponse(
          { continueUrl: result.continueUrl, ...result.session },
          result.cookie
        );
      }
      case "redeem": {
        const result = redeemDevice(await request.json());
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

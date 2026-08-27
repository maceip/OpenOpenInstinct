import { NextResponse, type NextRequest } from "next/server";
import { isAllowedMutationOrigin } from "@/lib/manager";
import { getAuthSession } from "@/lib/server/auth-session";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isUnsafeMethod(request.method) && !isAllowedMutationOrigin(originInput(request))) {
    return Response.json(
      { error: "Cross-origin requests are blocked." },
      { status: 403 }
    );
  }
  if (
    pathname === "/sign-in" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/eve/v1/health"
  ) {
    return NextResponse.next();
  }

  if (await getAuthSession(request.headers)) return NextResponse.next();

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(signInUrl);
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function originInput(request: NextRequest) {
  return {
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    requestUrl: request.url,
  };
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

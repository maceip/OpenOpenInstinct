import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getAuthSession } from "@/lib/server/auth-session";
import {
  isAllowedMutationOrigin,
  isAllowedRequestHost,
} from "@/lib/server/request-security";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isAllowedRequestHost(request.headers)) {
    return Response.json(
      {
        error:
          "The request host does not match this OpenOpenInstinct instance.",
      },
      { status: 421 }
    );
  }
  if (
    isUnsafeMethod(request.method) &&
    !isAllowedMutationOrigin(request.headers)
  ) {
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

  const signInUrl = new URL("/sign-in", env.PUBLIC_URL);
  signInUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(signInUrl);
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

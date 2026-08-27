import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { accessScopeForUser } from "@/lib/access-scope";
import { env } from "@/lib/env";
import { getAuthSession } from "@/lib/server/auth-session";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.PUBLIC_URL),
  title: "OpenOpenInstinct",
  description:
    "A self-hosted personal agent with private credentials and Kernel-powered browser execution.",
};

export default async function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = await getAuthSession(await headers());
  const workspaceId = session?.user?.id
    ? accessScopeForUser(`device-auth:${session.user.id}`).workspaceId
    : undefined;

  return (
    <html lang="en">
      <body data-workspace-id={workspaceId}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}

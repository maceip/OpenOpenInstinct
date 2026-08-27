"use client";

import {
  BotIcon,
  CloudIcon,
  KeyRoundIcon,
  MailIcon,
  MessageSquareIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ManagerSnapshot } from "@/lib/manager";
import { useManager } from "./use-manager";

export function WorkspaceManager({
  googleNotice,
}: {
  readonly googleNotice?: "unavailable";
}) {
  const { error, snapshot } = useManager();
  const browserReady = snapshot?.browser.available === true;

  return (
    <main className="flex min-w-0 flex-col gap-8">
      <h1 className="sr-only">Workspace</h1>

      {error ? (
        <Alert variant="destructive">
          <KeyRoundIcon />
          <AlertTitle>Workspace unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {googleNotice === "unavailable" ? (
        <Alert>
          <MailIcon />
          <AlertTitle>Google Workspace connection failed</AlertTitle>
          <AlertDescription>
            Check the local OAuth credentials and registered callback URL, then
            try connecting again.
          </AlertDescription>
        </Alert>
      ) : null}

      <ChannelsSection
        browserReady={browserReady}
        linqPhoneNumber={snapshot?.channels.linqPhoneNumber}
      />

      <GoogleWorkspaceSection connection={snapshot?.googleWorkspace} />

      <section aria-labelledby="connectors-heading" className="space-y-3">
        <h2 className="type-section-title" id="connectors-heading">
          Infrastructure
        </h2>
        <div className="divide-y divide-border/50 border-y border-border/50">
          <ConnectorRow
            action={
              <span className="type-caption text-muted-foreground">
                {browserReady ? "Connected" : "Unavailable"}
              </span>
            }
            description="Run isolated browsers in your Kernel account."
            icon={<CloudIcon />}
            label="Kernel browser"
          />
          <ConnectorRow
            action={
              <span className="type-caption text-muted-foreground">
                Configured
              </span>
            }
            description={
              snapshot
                ? `${snapshot.runtime.provider}: ${snapshot.runtime.inference}`
                : "Loading the configured model…"
            }
            icon={<BotIcon />}
            label="AI model"
          />
        </div>
      </section>
    </main>
  );
}

function GoogleWorkspaceSection({
  connection,
}: {
  readonly connection?: ManagerSnapshot["googleWorkspace"];
}) {
  const state = connection?.state;
  const description =
    state === "connected"
      ? (connection?.accountLabel ??
        "Gmail, Calendar, and Contacts are connected.")
      : state === "unavailable"
        ? "Add local Google OAuth credentials to enable this connection."
        : "Gmail, Calendar, and read-only Contacts through your Google account.";

  return (
    <section aria-labelledby="connections-heading" className="space-y-3">
      <h2 className="type-section-title" id="connections-heading">
        Connections
      </h2>
      <div className="divide-y divide-border/50 border-y border-border/50">
        <ConnectorRow
          action={<GoogleWorkspaceAction state={state} />}
          description={description}
          icon={<MailIcon />}
          label="Google Workspace"
        />
      </div>
    </section>
  );
}

function GoogleWorkspaceAction({
  state,
}: {
  readonly state?: ManagerSnapshot["googleWorkspace"]["state"];
}) {
  if (!state) {
    return <span className="type-caption text-muted-foreground">Loading…</span>;
  }
  if (state === "unavailable") {
    return (
      <span className="type-caption text-muted-foreground">Setup required</span>
    );
  }

  const action = state === "connected" ? "disconnect" : "connect";
  return (
    <form action="/api/connectors/google" method="post">
      <input name="action" type="hidden" value={action} />
      <Button size="sm" type="submit" variant="outline">
        {state === "connected" ? "Disconnect" : "Connect"}
      </Button>
    </form>
  );
}

function ChannelsSection({
  browserReady,
  linqPhoneNumber,
}: {
  readonly browserReady: boolean;
  readonly linqPhoneNumber?: string;
}) {
  return (
    <section aria-labelledby="channels-heading" className="space-y-3">
      <h2 className="type-section-title" id="channels-heading">
        Channels
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {browserReady ? (
          <Button
            className="h-11 justify-start"
            nativeButton={false}
            render={<Link href="/chat" />}
            variant="outline"
          >
            <MessageSquareIcon />
            WebChat
          </Button>
        ) : (
          <Button className="h-11 justify-start" disabled variant="outline">
            <MessageSquareIcon />
            WebChat
          </Button>
        )}
        {linqPhoneNumber ? (
          <Button
            className="h-11 justify-start"
            nativeButton={false}
            render={<a href={`sms:${linqPhoneNumber}`} />}
            variant="outline"
          >
            <MailIcon />
            iMessage
          </Button>
        ) : (
          <Button className="h-11 justify-start" disabled variant="outline">
            <MailIcon />
            iMessage
          </Button>
        )}
      </div>
      <p className="type-caption text-muted-foreground">
        {browserReady
          ? "WebChat is ready. iMessage opens your configured Linq conversation."
          : "KERNEL_API_KEY is required to enable WebChat."}
      </p>
    </section>
  );
}

function ConnectorRow({
  action,
  description,
  icon,
  label,
}: {
  readonly action: ReactNode;
  readonly description: string;
  readonly icon: ReactNode;
  readonly label: string;
}) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="type-label">{label}</p>
        <p className="truncate type-caption text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

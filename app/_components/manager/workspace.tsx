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
import { useManager } from "./use-manager";

export function WorkspaceManager() {
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

      <ChannelsSection
        browserReady={browserReady}
        linqPhoneNumber={snapshot?.channels.linqPhoneNumber}
      />

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

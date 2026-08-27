"use client";

import { CheckCircle2Icon, KeyRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  hasEnrolledDevice,
  pairFromFragment,
  recoverEnrolledDevice,
} from "@/lib/device-auth-client";

type State = "connected" | "connecting" | "ready" | "recovering";

export function DeviceAuthForm({ callbackUrl }: { readonly callbackUrl: string }) {
  const [error, setError] = useState<string>();
  const [handoffUrl, setHandoffUrl] = useState<string>();
  const [pairedDevice, setPairedDevice] = useState(false);
  const [state, setState] = useState<State>("recovering");

  useEffect(() => {
    let active = true;

    async function connect() {
      try {
        if (window.location.hash.startsWith("#v1.")) {
          const fragment = window.location.hash;
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`
          );
          setState("connecting");
          const session = await pairFromFragment(fragment);
          if (!active) return;
          continueAfterConnection(session.continueUrl ?? callbackUrl);
          return;
        }

        const session = await recoverEnrolledDevice();
        if (!active) return;
        if (session) {
          window.location.replace(callbackUrl);
          return;
        }
        setPairedDevice(await hasEnrolledDevice());
        setState("ready");
      } catch (connectError) {
        if (!active) return;
        setError(
          connectError instanceof Error
            ? connectError.message
            : "This device could not be connected."
        );
        setPairedDevice(await hasEnrolledDevice());
        setState("ready");
      }
    }

    function continueAfterConnection(destination: string) {
      if (destination.startsWith("sms:")) {
        setHandoffUrl(destination);
        setState("connected");
        window.setTimeout(() => window.location.assign(destination), 250);
        return;
      }
      window.location.replace(destination);
    }

    void connect();
    return () => {
      active = false;
    };
  }, [callbackUrl]);

  async function reconnect() {
    setError(undefined);
    setState("recovering");
    const session = await recoverEnrolledDevice({ force: true });
    if (session) {
      window.location.replace(callbackUrl);
      return;
    }
    setError("This device is no longer enrolled. Request a new pairing link.");
    setState("ready");
  }

  if (state === "connecting" || state === "recovering") {
    return (
      <div className="mt-6 space-y-3" role="status">
        <p className="type-body">
          {state === "connecting"
            ? "Connecting this device…"
            : "Checking this device…"}
        </p>
        <p className="type-supporting-body text-muted-foreground">
          OpenOpenInstinct is creating a private device key and secure session.
        </p>
      </div>
    );
  }

  if (state === "connected") {
    return (
      <div className="mt-6 space-y-4" role="status">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2Icon className="size-5" />
          <p className="type-label">Device connected</p>
        </div>
        <p className="type-supporting-body text-muted-foreground">
          Returning you to Messages…
        </p>
        {handoffUrl ? (
          <Button
            className="w-full"
            nativeButton={false}
            render={<a href={handoffUrl} />}
          >
            Open Messages
          </Button>
        ) : null}
        <Button
          className="w-full"
          onClick={() => window.location.replace(callbackUrl)}
          type="button"
          variant="outline"
        >
          Continue to OpenOpenInstinct
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="type-label">
            {pairedDevice ? "Paired device signed out" : "Pairing link required"}
          </p>
          <p className="type-supporting-body text-muted-foreground">
            {pairedDevice
              ? "Reconnect with the private key already stored on this device."
              : "Open the one-use link sent by your OpenOpenInstinct server. No code or password is required."}
          </p>
        </div>
      </div>
      {error ? (
        <p className="type-supporting-body text-destructive">{error}</p>
      ) : null}
      {pairedDevice ? (
        <Button className="w-full" onClick={() => void reconnect()} type="button">
          Reconnect this device
        </Button>
      ) : null}
    </div>
  );
}

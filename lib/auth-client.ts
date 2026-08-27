"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { markSignedOut } from "./device-auth-client";

const authSessionSchema = z.object({
  device: z.object({ id: z.string(), name: z.string() }),
  session: z.object({ expiresAt: z.string(), id: z.string() }),
  user: z.object({ id: z.string() }),
});

export type ClientAuthSession = z.infer<typeof authSessionSchema>;

export function useAuthSession() {
  const [data, setData] = useState<ClientAuthSession>();

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return undefined;
        const session = authSessionSchema.parse(await response.json());
        if (active) setData(session);
        return session;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return data;
}

export async function signOut() {
  markSignedOut();
  await fetch("/api/auth/sign-out", {
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });
}

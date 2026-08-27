import { z } from "zod";
import { env } from "@/lib/env";

export const GOOGLE_WORKSPACE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/contacts.readonly",
] as const;

export const googleWorkspaceActionSchema = z.enum(["connect", "disconnect"]);

export function googleWorkspaceConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleWorkspaceRedirectUri() {
  return new URL("/api/connectors/google", env.PUBLIC_URL).toString();
}

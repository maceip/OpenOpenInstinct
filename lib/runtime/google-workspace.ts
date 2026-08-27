import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ensureScope } from "@/db/services/scope";
import type { AccessScope } from "@/lib/access-scope";
import { env } from "@/lib/env";
import {
  GOOGLE_WORKSPACE_SCOPES,
  googleWorkspaceConfigured,
  googleWorkspaceRedirectUri,
} from "@/lib/google-workspace/config";
import {
  deleteSecret,
  readSecret,
  writeSecret,
} from "@/lib/server/secret-store";

const oauthNamespace = "google-oauth" as const;
const connectionId = "connection";
const authorizationStateId = "authorization-state";
const authorizationTtlMs = 10 * 60_000;
const refreshSkewMs = 60_000;

const storedTokenSchema = z.object({
  accessToken: z.string().min(1),
  email: z.email().nullable(),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(1),
  scopes: z.array(z.string()),
});

const authorizationStateSchema = z.object({
  expiresAt: z.number().int().positive(),
  state: z.string().min(1),
  userId: z.string().min(1),
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const userInfoSchema = z.object({ email: z.email() });

type Fetcher = typeof fetch;
type StoredToken = z.infer<typeof storedTokenSchema>;

export async function getGoogleWorkspaceConnection(scope: AccessScope) {
  if (!googleWorkspaceConfigured()) {
    return { accountLabel: null, state: "unavailable" as const };
  }
  try {
    const token = await readStoredToken(scope);
    return token
      ? { accountLabel: token.email, state: "connected" as const }
      : { accountLabel: null, state: "disconnected" as const };
  } catch {
    return { accountLabel: null, state: "unavailable" as const };
  }
}

export async function startGoogleWorkspaceAuthorization(scope: AccessScope) {
  const { clientId } = requiredGoogleConfig();
  await ensureScope(scope);
  const state = randomBytes(32).toString("base64url");
  await writeSecret({
    id: authorizationStateId,
    namespace: oauthNamespace,
    scope,
    value: JSON.stringify({
      expiresAt: Date.now() + authorizationTtlMs,
      state,
      userId: scope.userId,
    }),
  });

  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: googleWorkspaceRedirectUri(),
    response_type: "code",
    scope: GOOGLE_WORKSPACE_SCOPES.join(" "),
    state,
  }).toString();
  return authorization.toString();
}

export async function completeGoogleWorkspaceAuthorization(
  scope: AccessScope,
  input: { readonly code: string; readonly state: string },
  fetcher: Fetcher = fetch
) {
  await consumeAuthorizationState(scope, input.state);
  const { clientId, clientSecret } = requiredGoogleConfig();
  const response = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: googleWorkspaceRedirectUri(),
    }),
    fetcher
  );
  if (!response.refresh_token) {
    throw new Error(
      "Google did not issue a refresh token. Revoke the old grant and connect again."
    );
  }
  const scopes = response.scope?.split(" ").filter(Boolean) ?? [];
  requireGoogleScopes(scopes);
  const email = await readGoogleEmail(response.access_token, fetcher);
  await writeStoredToken(scope, {
    accessToken: response.access_token,
    email,
    expiresAt: Date.now() + response.expires_in * 1_000,
    refreshToken: response.refresh_token,
    scopes,
  });
}

export async function abandonGoogleWorkspaceAuthorization(
  scope: AccessScope,
  state: string
) {
  await consumeAuthorizationState(scope, state);
}

export async function getGoogleWorkspaceAccessToken(
  scope: AccessScope,
  options: { readonly fetcher?: Fetcher; readonly forceRefresh?: boolean } = {}
) {
  requiredGoogleConfig();
  const stored = await readStoredToken(scope);
  if (!stored) throw googleReconnectError();
  if (!options.forceRefresh && stored.expiresAt > Date.now() + refreshSkewMs) {
    return stored.accessToken;
  }

  const { clientId, clientSecret } = requiredGoogleConfig();
  let response: z.infer<typeof tokenResponseSchema>;
  try {
    response = await requestToken(
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      }),
      options.fetcher ?? fetch
    );
  } catch {
    throw googleReconnectError();
  }

  const scopes = response.scope?.split(" ").filter(Boolean) ?? stored.scopes;
  requireGoogleScopes(scopes);
  await writeStoredToken(scope, {
    ...stored,
    accessToken: response.access_token,
    expiresAt: Date.now() + response.expires_in * 1_000,
    refreshToken: response.refresh_token ?? stored.refreshToken,
    scopes,
  });
  return response.access_token;
}

export async function disconnectGoogleWorkspace(
  scope: AccessScope,
  fetcher: Fetcher = fetch
) {
  const stored = await readStoredToken(scope).catch(() => undefined);
  try {
    if (stored) {
      await fetcher("https://oauth2.googleapis.com/revoke", {
        body: new URLSearchParams({ token: stored.refreshToken }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      });
    }
  } finally {
    await deleteSecret({
      id: connectionId,
      namespace: oauthNamespace,
      scope,
    });
  }
}

async function consumeAuthorizationState(scope: AccessScope, state: string) {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(state)) throw googleStateError();
  const encoded = await readSecret({
    id: authorizationStateId,
    namespace: oauthNamespace,
    scope,
  });
  if (!encoded) throw googleStateError();
  const stored = authorizationStateSchema.parse(JSON.parse(encoded));
  if (
    stored.expiresAt <= Date.now() ||
    stored.userId !== scope.userId ||
    !safeEqual(stored.state, state)
  ) {
    throw googleStateError();
  }
  await deleteSecret({
    id: authorizationStateId,
    namespace: oauthNamespace,
    scope,
  });
}

async function requestToken(params: URLSearchParams, fetcher: Fetcher) {
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Google OAuth returned HTTP ${String(response.status)}.`);
  }
  return tokenResponseSchema.parse(await response.json());
}

async function readGoogleEmail(accessToken: string, fetcher: Fetcher) {
  const response = await fetcher(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error("Google did not return the connected account identity.");
  }
  return userInfoSchema.parse(await response.json()).email;
}

async function readStoredToken(scope: AccessScope) {
  const encoded = await readSecret({
    id: connectionId,
    namespace: oauthNamespace,
    scope,
  });
  return encoded ? storedTokenSchema.parse(JSON.parse(encoded)) : undefined;
}

async function writeStoredToken(scope: AccessScope, token: StoredToken) {
  await ensureScope(scope);
  await writeSecret({
    id: connectionId,
    namespace: oauthNamespace,
    scope,
    value: JSON.stringify(storedTokenSchema.parse(token)),
  });
}

function requiredGoogleConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Workspace OAuth is not configured.");
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

function requireGoogleScopes(scopes: readonly string[]) {
  const granted = new Set(scopes);
  const missing = GOOGLE_WORKSPACE_SCOPES.filter(
    (scope) => !granted.has(scope)
  );
  if (missing.length > 0) {
    throw new Error("Google did not grant every required Workspace scope.");
  }
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function googleStateError() {
  return new Error("The Google authorization request is invalid or expired.");
}

function googleReconnectError() {
  return new Error(
    `Google Workspace must be reconnected at ${new URL("/", env.PUBLIC_URL).toString()}.`
  );
}

import {
  createHash,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify,
} from "node:crypto";
import { z } from "zod";
import { getDatabase, withTransaction, type Database } from "@/db";
import {
  decodeBase64Url,
  deviceChallengeRequestSchema,
  encodeDeviceSessionProof,
  pairDeviceRequestSchema,
  publicKeyJwkSchema,
  redeemDeviceRequestSchema,
} from "@/lib/device-auth-protocol";
import { env } from "@/lib/env";
import { principalIdForInstance } from "@/lib/server/auth-identity";

const SESSION_SECRET_DOMAIN = "openopeninstinct-session-secret-v1\0";
const PAIRING_SECRET_DOMAIN = "openopeninstinct-pairing-secret-v1\0";
const CHALLENGE_SECRET_DOMAIN = "openopeninstinct-challenge-v1\0";
const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

const sessionRowSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string(),
  expiresAt: z.string(),
  lastSeenAt: z.string(),
  principalId: z.string(),
  secretHash: z.string(),
  sessionId: z.string(),
});

const pairingRowSchema = z.object({
  audience: z.string(),
  continueKind: z.enum(["messages", "web"]),
  continuePath: z.string(),
  expiresAt: z.string(),
  principalId: z.string(),
  secretHash: z.string(),
});

const challengeRowSchema = z.object({
  audience: z.string(),
  challengeHash: z.string(),
  challengeId: z.string(),
  deviceId: z.string(),
  expiresAt: z.string(),
  keyEpoch: z.number().int().positive(),
  principalId: z.string(),
  publicKeyJwk: z.string(),
});

export interface AuthSession {
  readonly device: { readonly id: string; readonly name: string };
  readonly session: { readonly expiresAt: string; readonly id: string };
  readonly user: { readonly id: string };
}

export interface SessionResult {
  readonly cookie: string;
  readonly session: AuthSession;
}

export interface PairResult extends SessionResult {
  readonly continueUrl: string;
}

interface MintedSession {
  readonly expiresAt: string;
  readonly id: string;
  readonly secret: string;
}

const rateBuckets = new Map<string, number[]>();

export async function getAuthSession(headers: Headers) {
  const credentials = readSessionCookie(headers);
  if (!credentials) return null;

  const row = sessionRowSchema.optional().parse(
    getDatabase()
      .prepare(
        `SELECT
           s.id AS sessionId,
           s.principal_id AS principalId,
           s.device_id AS deviceId,
           s.secret_hash AS secretHash,
           s.expires_at AS expiresAt,
           s.last_seen_at AS lastSeenAt,
           d.name AS deviceName
         FROM auth_sessions s
         JOIN auth_devices d ON d.id = s.device_id
         WHERE s.id = ?
           AND s.revoked_at IS NULL
           AND d.revoked_at IS NULL`
      )
      .get(credentials.id)
  );
  if (!row || Date.parse(row.expiresAt) <= Date.now()) return null;
  if (!hashesMatch(row.secretHash, hashSecret(SESSION_SECRET_DOMAIN, credentials.secret))) {
    return null;
  }

  if (Date.now() - Date.parse(row.lastSeenAt) > LAST_SEEN_WRITE_INTERVAL_MS) {
    const now = new Date().toISOString();
    getDatabase()
      .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?")
      .run(now, row.sessionId);
    getDatabase()
      .prepare("UPDATE auth_devices SET last_seen_at = ? WHERE id = ?")
      .run(now, row.deviceId);
  }

  return publicSession(row);
}

export function pairDevice(input: unknown): PairResult {
  enforceRateLimit("pair:global", 40, 60_000);
  const request = pairDeviceRequestSchema.parse(input);
  if (request.instanceId !== env.AUTH_INSTANCE_ID) {
    throw new AuthError("This pairing link belongs to another instance.", 400);
  }

  validatePublicKey(request.publicKey);
  const now = new Date();
  return withTransaction((database) => {
    const pairing = pairingRowSchema.optional().parse(
      database
        .prepare(
          `SELECT
             principal_id AS principalId,
             secret_hash AS secretHash,
             audience,
             continue_kind AS continueKind,
             continue_path AS continuePath,
             expires_at AS expiresAt
           FROM auth_pairings
           WHERE id = ? AND consumed_at IS NULL`
        )
        .get(request.pairingId)
    );
    if (
      !pairing ||
      pairing.audience !== env.PUBLIC_URL ||
      Date.parse(pairing.expiresAt) <= now.getTime() ||
      pairing.principalId !== principalIdForInstance() ||
      !hashesMatch(
        pairing.secretHash,
        hashSecret(PAIRING_SECRET_DOMAIN, request.secret)
      )
    ) {
      throw new AuthError("This pairing link is invalid or expired.", 401);
    }

    database
      .prepare(
        `INSERT INTO auth_devices
           (id, principal_id, public_key_jwk, key_epoch, name, created_at, last_seen_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)`
      )
      .run(
        request.deviceId,
        pairing.principalId,
        JSON.stringify(request.publicKey),
        request.deviceName,
        now.toISOString(),
        now.toISOString()
      );
    const consumed = database
      .prepare(
        `UPDATE auth_pairings
         SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL`
      )
      .run(now.toISOString(), request.pairingId);
    if (consumed.changes !== 1) {
      throw new AuthError("This pairing link was already used.", 409);
    }

    const minted = mintSession(
      database,
      pairing.principalId,
      request.deviceId,
      now
    );
    return {
      continueUrl: pairingContinueUrl(pairing),
      cookie: sessionCookie(minted),
      session: {
        device: { id: request.deviceId, name: request.deviceName },
        session: { expiresAt: minted.expiresAt, id: minted.id },
        user: { id: pairing.principalId },
      },
    };
  });
}

export function createDeviceChallenge(input: unknown) {
  const request = deviceChallengeRequestSchema.parse(input);
  enforceRateLimit(`challenge:${request.deviceId}`, 12, 60_000);
  enforceRateLimit("challenge:global", 120, 60_000);

  const device = z
    .object({ keyEpoch: z.number().int().positive() })
    .optional()
    .parse(
      getDatabase()
        .prepare(
          `SELECT key_epoch AS keyEpoch
           FROM auth_devices
           WHERE id = ? AND revoked_at IS NULL`
        )
        .get(request.deviceId)
    );
  if (!device) throw new AuthError("This device is not enrolled.", 404);

  const now = Date.now();
  const challenge = randomBytes(32).toString("base64url");
  const challengeId = randomId();
  const expiresAtMs = now + CHALLENGE_TTL_MS;
  getDatabase()
    .prepare(
      `INSERT INTO auth_challenges
         (id, device_id, key_epoch, challenge_hash, audience, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      challengeId,
      request.deviceId,
      device.keyEpoch,
      hashSecret(CHALLENGE_SECRET_DOMAIN, challenge),
      env.PUBLIC_URL,
      new Date(now).toISOString(),
      new Date(expiresAtMs).toISOString()
    );

  cleanupExpiredAuthRows();
  return {
    audience: env.PUBLIC_URL,
    challenge,
    challengeId,
    expiresAtMs,
    instanceId: env.AUTH_INSTANCE_ID,
    keyEpoch: device.keyEpoch,
  };
}

export function redeemDevice(input: unknown): SessionResult {
  const request = redeemDeviceRequestSchema.parse(input);
  const { proof } = request;
  enforceRateLimit(`redeem:${proof.deviceId}`, 12, 60_000);
  const signature = decodeBase64Url(request.signature);
  if (signature.byteLength !== 64) {
    throw new AuthError("The device proof is invalid.", 401);
  }

  const now = Date.now();
  if (
    proof.instanceId !== env.AUTH_INSTANCE_ID ||
    proof.audience !== env.PUBLIC_URL ||
    proof.issuedAtMs > now + MAX_CLOCK_SKEW_MS ||
    proof.expiresAtMs <= now ||
    proof.expiresAtMs - proof.issuedAtMs > CHALLENGE_TTL_MS
  ) {
    throw new AuthError("The device proof is invalid or expired.", 401);
  }

  return withTransaction((database) => {
    const challenge = challengeRowSchema.optional().parse(
      database
        .prepare(
          `SELECT
             c.id AS challengeId,
             c.device_id AS deviceId,
             c.key_epoch AS keyEpoch,
             c.challenge_hash AS challengeHash,
             c.audience,
             c.expires_at AS expiresAt,
             d.principal_id AS principalId,
             d.public_key_jwk AS publicKeyJwk
           FROM auth_challenges c
           JOIN auth_devices d ON d.id = c.device_id
           WHERE c.id = ?
             AND c.consumed_at IS NULL
             AND d.revoked_at IS NULL`
        )
        .get(proof.challengeId)
    );
    if (
      !challenge ||
      challenge.deviceId !== proof.deviceId ||
      challenge.keyEpoch !== proof.keyEpoch ||
      challenge.audience !== proof.audience ||
      Date.parse(challenge.expiresAt) <= now ||
      proof.expiresAtMs > Date.parse(challenge.expiresAt) ||
      !hashesMatch(
        challenge.challengeHash,
        hashSecret(CHALLENGE_SECRET_DOMAIN, proof.challenge)
      )
    ) {
      throw new AuthError("The device challenge is invalid or expired.", 401);
    }

    const publicKey = publicKeyJwkSchema.parse(
      JSON.parse(challenge.publicKeyJwk)
    );
    const verified = verify(
      "sha256",
      encodeDeviceSessionProof(proof),
      {
        dsaEncoding: "ieee-p1363",
        key: createPublicKey({ format: "jwk", key: publicKey }),
      },
      signature
    );
    if (!verified) throw new AuthError("The device signature is invalid.", 401);

    const consumed = database
      .prepare(
        `UPDATE auth_challenges
         SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL`
      )
      .run(new Date(now).toISOString(), challenge.challengeId);
    if (consumed.changes !== 1) {
      throw new AuthError("The device challenge was already used.", 409);
    }

    database
      .prepare("UPDATE auth_devices SET last_seen_at = ? WHERE id = ?")
      .run(new Date(now).toISOString(), challenge.deviceId);
    const minted = mintSession(
      database,
      challenge.principalId,
      challenge.deviceId,
      new Date(now)
    );
    const name = z
      .object({ name: z.string() })
      .parse(
        database
          .prepare("SELECT name FROM auth_devices WHERE id = ?")
          .get(challenge.deviceId)
      ).name;
    return {
      cookie: sessionCookie(minted),
      session: {
        device: { id: challenge.deviceId, name },
        session: { expiresAt: minted.expiresAt, id: minted.id },
        user: { id: challenge.principalId },
      },
    };
  });
}

export function signOut(headers: Headers) {
  const credentials = readSessionCookie(headers);
  if (credentials) {
    getDatabase()
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?")
      .run(new Date().toISOString(), credentials.id);
  }
  return clearedSessionCookie();
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function sessionCookieName() {
  return new URL(env.PUBLIC_URL).protocol === "https:"
    ? "__Host-ooi_session"
    : "ooi_session";
}

function mintSession(
  database: Database,
  principalId: string,
  deviceId: string,
  now: Date
): MintedSession {
  const id = randomId();
  const secret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    now.getTime() + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  database
    .prepare(
      `INSERT INTO auth_sessions
         (id, principal_id, device_id, secret_hash, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      principalId,
      deviceId,
      hashSecret(SESSION_SECRET_DOMAIN, secret),
      now.toISOString(),
      now.toISOString(),
      expiresAt
    );
  return { expiresAt, id, secret };
}

function publicSession(row: z.infer<typeof sessionRowSchema>): AuthSession {
  return {
    device: { id: row.deviceId, name: row.deviceName },
    session: { expiresAt: row.expiresAt, id: row.sessionId },
    user: { id: row.principalId },
  };
}

function sessionCookie(session: MintedSession) {
  const secure = new URL(env.PUBLIC_URL).protocol === "https:";
  const maxAge = Math.max(
    0,
    Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000)
  );
  return `${sessionCookieName()}=${session.id}.${session.secret}; Path=/; ${
    secure ? "Secure; " : ""
  }HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearedSessionCookie() {
  const secure = new URL(env.PUBLIC_URL).protocol === "https:";
  return `${sessionCookieName()}=; Path=/; ${
    secure ? "Secure; " : ""
  }HttpOnly; SameSite=Strict; Max-Age=0`;
}

function readSessionCookie(headers: Headers) {
  const cookie = headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${sessionCookieName()}=`));
  const value = cookie?.slice(sessionCookieName().length + 1);
  const match =
    /^([A-Za-z0-9_-]{16,128})\.([A-Za-z0-9_-]{43})$/u.exec(value ?? "");
  return match?.[1] && match[2]
    ? { id: match[1], secret: match[2] }
    : undefined;
}

function validatePublicKey(input: z.infer<typeof publicKeyJwkSchema>) {
  try {
    createPublicKey({ format: "jwk", key: input });
  } catch {
    throw new AuthError("The device public key is invalid.", 400);
  }
}

function pairingContinueUrl(pairing: z.infer<typeof pairingRowSchema>) {
  if (pairing.continueKind === "messages" && env.LINQ_PHONE_NUMBER) {
    return `sms:${env.LINQ_PHONE_NUMBER}`;
  }
  if (
    !pairing.continuePath.startsWith("/") ||
    pairing.continuePath.startsWith("//")
  ) {
    return "/";
  }
  return pairing.continuePath;
}

function hashSecret(domain: string, encodedSecret: string) {
  let secret: Uint8Array;
  try {
    secret = decodeBase64Url(encodedSecret);
  } catch {
    return "";
  }
  if (secret.byteLength !== 32) return "";
  return createHash("sha256")
    .update(domain)
    .update(secret)
    .digest("base64url");
}

function hashesMatch(expected: string, actual: string) {
  const left = Buffer.from(expected, "base64url");
  const right = Buffer.from(actual, "base64url");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

function randomId() {
  return randomBytes(18).toString("base64url");
}

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (rateBuckets.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff
  );
  if (recent.length >= limit) {
    throw new AuthError("Too many authentication attempts. Try again later.", 429);
  }
  recent.push(now);
  rateBuckets.set(key, recent);
}

function cleanupExpiredAuthRows() {
  if (Math.random() >= 0.05) return;
  const now = new Date().toISOString();
  const database = getDatabase();
  database
    .prepare("DELETE FROM auth_challenges WHERE expires_at < ?")
    .run(now);
  database
    .prepare("DELETE FROM auth_pairings WHERE expires_at < ?")
    .run(now);
  database
    .prepare("DELETE FROM auth_sessions WHERE expires_at < ?")
    .run(now);
}

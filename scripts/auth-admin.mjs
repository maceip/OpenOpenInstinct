/* oxlint-disable eslint/no-restricted-properties -- Standalone admin bootstrap validates required environment values before use. */
import { createHash, randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { openDatabase } from "../db/sqlite.mjs";
import { secureEnvironmentFiles } from "./local-permissions.mjs";

const { loadEnvConfig } = nextEnv;

secureEnvironmentFiles();
loadEnvConfig(process.cwd());

const command = process.argv[2] || "pair";
const options = parseOptions(process.argv.slice(3));
const databasePath =
  process.env.DATABASE_PATH || ".data/openopeninstinct.sqlite";
const database = openDatabase(databasePath);

try {
  switch (command) {
    case "devices":
      listDevices();
      break;
    case "pair":
      await createPairing();
      break;
    case "revoke":
      revokeDevice(options.id || process.argv[3]);
      break;
    case "sync-origin":
      await syncPublicOrigin();
      break;
    default:
      throw new Error(
        "Usage: auth-admin.mjs pair|devices|revoke|sync-origin [options]"
      );
  }
} finally {
  database.close();
}

async function createPairing({
  continueKind = options.continue || "web",
  continuePath = options.path || "/chat",
  printLink = true,
  send = options.send,
  ttlMinutes = Number(options["ttl-minutes"] || 10),
} = {}) {
  const publicUrl = configuredPublicUrl();
  const instanceId = requiredEnv("AUTH_INSTANCE_ID");
  if (!new Set(["messages", "web"]).has(continueKind)) {
    throw new Error("--continue must be messages or web.");
  }
  if (!continuePath.startsWith("/") || continuePath.startsWith("//")) {
    throw new Error("--path must be a same-origin absolute path.");
  }
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 30) {
    throw new Error("--ttl-minutes must be an integer from 1 through 30.");
  }
  if (send !== undefined && send !== "linq") {
    throw new Error("--send must be linq when provided.");
  }

  const principalId = principalIdForInstance(instanceId);
  const pairingId = randomId();
  const secret = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `INSERT INTO auth_principals (id, created_at)
         VALUES (?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(principalId, now.toISOString());
    database
      .prepare(
        `INSERT INTO auth_pairings
           (id, principal_id, secret_hash, audience, continue_kind,
            continue_path, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        pairingId,
        principalId,
        hashSecret("openopeninstinct-pairing-secret-v1\0", secret),
        publicUrl,
        continueKind,
        continuePath,
        now.toISOString(),
        expiresAt.toISOString()
      );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const link = `${publicUrl}/sign-in#v1.${instanceId}.${pairingId}.${secret}`;
  if (send === "linq") await sendPairingThroughLinq(link, ttlMinutes);

  if (printLink) {
    console.log(`Pairing link (expires ${expiresAt.toISOString()}):`);
    console.log(link);
  }
  if (send === "linq") {
    console.log(`Sent to ${requiredEnv("OWNER_PHONE_NUMBER")} through Linq.`);
  }
  return { expiresAt, link };
}

async function syncPublicOrigin() {
  const publicUrl = configuredPublicUrl();
  const previous = database
    .prepare("SELECT value FROM instance_state WHERE key = 'public_url'")
    .get()?.value;
  if (previous === publicUrl) {
    console.log(`Public origin is unchanged (${publicUrl}).`);
    return;
  }

  await createPairing({
    continueKind: "messages",
    continuePath: "/chat",
    printLink: false,
    send: "linq",
    ttlMinutes: 10,
  });

  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `UPDATE auth_pairings
         SET consumed_at = ?
         WHERE audience <> ? AND consumed_at IS NULL`
      )
      .run(now, publicUrl);
    database
      .prepare(
        `INSERT INTO instance_state (key, value, updated_at)
         VALUES ('public_url', ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run(publicUrl, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  console.log(
    previous
      ? `Public origin changed from ${previous} to ${publicUrl}; a one-use recovery link was sent automatically.`
      : `Public origin initialized at ${publicUrl}; a one-use connection link was sent automatically.`
  );
}

function listDevices() {
  const rows = database
    .prepare(
      `SELECT id, name, created_at AS createdAt, last_seen_at AS lastSeenAt,
              revoked_at AS revokedAt
       FROM auth_devices
       ORDER BY created_at DESC`
    )
    .all();
  console.table(rows);
}

function revokeDevice(deviceId) {
  if (!deviceId || !/^[A-Za-z0-9_-]{16,128}$/u.test(deviceId)) {
    throw new Error("Provide a valid device id with --id=<id>.");
  }
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = database
      .prepare(
        `UPDATE auth_devices SET revoked_at = ?
         WHERE id = ? AND revoked_at IS NULL`
      )
      .run(now, deviceId);
    if (result.changes !== 1) throw new Error("Active device not found.");
    database
      .prepare(
        `UPDATE auth_sessions SET revoked_at = ?
         WHERE device_id = ? AND revoked_at IS NULL`
      )
      .run(now, deviceId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  console.log(`Revoked device ${deviceId}.`);
}

async function sendPairingThroughLinq(link, ttlMinutes) {
  const apiKey = requiredEnv("LINQ_API_KEY");
  const ownerPhoneNumber = requiredEnv("OWNER_PHONE_NUMBER");
  const response = await fetch(
    "https://api.linqapp.com/api/partner/v3/messages",
    {
      body: JSON.stringify({
        message: {
          parts: [
            {
              type: "text",
              value:
                `OpenOpenInstinct is ready. Tap once to connect this device; ` +
                `the link expires in ${ttlMinutes} minutes.\n${link}`,
            },
          ],
        },
        to: [ownerPhoneNumber],
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `auth-pair-${createHash("sha256")
          .update(link)
          .digest("hex")}`,
      },
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error(`Linq returned HTTP ${response.status}.`);
  }
}

function principalIdForInstance(instanceId) {
  return createHash("sha256")
    .update("openopeninstinct-principal-v1\0")
    .update(instanceId)
    .digest("base64url");
}

function hashSecret(domain, encodedSecret) {
  return createHash("sha256")
    .update(domain)
    .update(Buffer.from(encodedSecret, "base64url"))
    .digest("base64url");
}

function randomId() {
  return randomBytes(18).toString("base64url");
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function configuredPublicUrl() {
  const configured = requiredEnv("PUBLIC_URL");
  const parsed = new URL(configured);
  if (parsed.origin !== configured.replace(/\/$/u, "")) {
    throw new Error("PUBLIC_URL must contain only the public origin.");
  }
  return parsed.origin;
}

function parseOptions(values) {
  return Object.fromEntries(
    values.flatMap((value) => {
      const match = /^--([^=]+)=(.*)$/u.exec(value);
      return match?.[1] ? [[match[1], match[2] || ""]] : [];
    })
  );
}

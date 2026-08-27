import { createHash, randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { openDatabase } from "../db/sqlite.mjs";

const { loadEnvConfig } = nextEnv;

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
    default:
      throw new Error("Usage: auth-admin.mjs pair|devices|revoke [options]");
  }
} finally {
  database.close();
}

async function createPairing() {
  const publicUrl = requiredEnv("PUBLIC_URL").replace(/\/$/u, "");
  const instanceId = requiredEnv("AUTH_INSTANCE_ID");
  const continueKind = options.continue || "web";
  if (!new Set(["messages", "web"]).has(continueKind)) {
    throw new Error("--continue must be messages or web.");
  }
  const continuePath = options.path || "/chat";
  if (!continuePath.startsWith("/") || continuePath.startsWith("//")) {
    throw new Error("--path must be a same-origin absolute path.");
  }
  const ttlMinutes = Number(options["ttl-minutes"] || 10);
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 30) {
    throw new Error("--ttl-minutes must be an integer from 1 through 30.");
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
  if (options.send === "linq") await sendPairingThroughLinq(link, ttlMinutes);

  console.log(`Pairing link (expires ${expiresAt.toISOString()}):`);
  console.log(link);
  if (options.send === "linq") {
    console.log(`Sent to ${requiredEnv("OWNER_PHONE_NUMBER")} through Linq.`);
  }
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
    database
      .prepare(
        `UPDATE auth_sessions SET revoked_at = ?
         WHERE device_id = ? AND revoked_at IS NULL`
      )
      .run(now, deviceId);
    database.exec("COMMIT");
    if (result.changes !== 1) throw new Error("Active device not found.");
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

function parseOptions(values) {
  return Object.fromEntries(
    values.flatMap((value) => {
      const match = /^--([^=]+)=(.*)$/u.exec(value);
      return match?.[1] ? [[match[1], match[2] || ""]] : [];
    })
  );
}

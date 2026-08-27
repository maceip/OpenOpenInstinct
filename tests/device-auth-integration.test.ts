import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AuthError,
  createDeviceChallenge,
  getAuthSession,
  pairDevice,
  redeemDevice,
} from "../auth";
import { getDatabase } from "../db";
import {
  encodeBase64Url,
  encodeDeviceSessionProof,
  type DeviceSessionProof,
  type PublicKeyJwk,
} from "../lib/device-auth-protocol";
import { env } from "../lib/env";
import { principalIdForInstance } from "../lib/server/auth-identity";

const pairingDomain = "openopeninstinct-pairing-secret-v1\0";

beforeEach(() => {
  const database = getDatabase();
  for (const table of [
    "auth_challenges",
    "auth_sessions",
    "auth_pairings",
    "auth_devices",
    "auth_principals",
  ]) {
    database.exec(`DELETE FROM ${table}`);
  }
});

describe("device-auth session exchange", () => {
  it("binds pairing and session redemption to the enrolled P-256 key", async () => {
    const enrolled = await createDeviceKey();
    const attacker = await createDeviceKey();
    const deviceId = "device-00000000000000";
    const pairingId = "pairing-000000000000";
    const pairingSecret = encodeBase64Url(new Uint8Array(32).fill(7));
    seedPairing(pairingId, pairingSecret);

    const paired = pairDevice({
      deviceId,
      deviceName: "Test phone",
      instanceId: env.AUTH_INSTANCE_ID,
      pairingId,
      publicKey: enrolled.publicKey,
      secret: pairingSecret,
    });
    expect(paired.continueUrl).toBe("/chat");
    expect(await getAuthSession(cookieHeaders(paired.cookie))).toMatchObject({
      device: { id: deviceId, name: "Test phone" },
    });

    const challenge = createDeviceChallenge({ deviceId });
    const proof: DeviceSessionProof = {
      ...challenge,
      deviceId,
      issuedAtMs: Date.now(),
      version: 1,
    };
    const attackerSignature = await signProof(attacker.privateKey, proof);
    expect(() => redeemDevice({ proof, signature: attackerSignature })).toThrow(
      "The device signature is invalid"
    );

    const signature = await signProof(enrolled.privateKey, proof);
    const redeemed = redeemDevice({ proof, signature });
    expect(await getAuthSession(cookieHeaders(redeemed.cookie))).toMatchObject({
      device: { id: deviceId },
      user: { id: principalIdForInstance() },
    });
    expect(() => redeemDevice({ proof, signature })).toThrow(AuthError);
  });

  it("rejects a pairing secret that was not delivered out of band", async () => {
    const enrolled = await createDeviceKey();
    const pairingSecret = encodeBase64Url(new Uint8Array(32).fill(7));
    seedPairing("pairing-000000000000", pairingSecret);

    expect(() =>
      pairDevice({
        deviceId: "device-00000000000000",
        deviceName: "Test phone",
        instanceId: env.AUTH_INSTANCE_ID,
        pairingId: "pairing-000000000000",
        publicKey: enrolled.publicKey,
        secret: encodeBase64Url(new Uint8Array(32).fill(8)),
      })
    ).toThrow("This pairing link is invalid or expired");
  });
});

async function createDeviceKey() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const publicKey: PublicKeyJwk = {
    crv: "P-256",
    kty: "EC",
    x: requireCoordinate(exported.x),
    y: requireCoordinate(exported.y),
  };
  return { privateKey: keyPair.privateKey, publicKey };
}

async function signProof(privateKey: CryptoKey, proof: DeviceSessionProof) {
  const signature = await crypto.subtle.sign(
    { hash: "SHA-256", name: "ECDSA" },
    privateKey,
    encodeDeviceSessionProof(proof)
  );
  return encodeBase64Url(new Uint8Array(signature));
}

function seedPairing(pairingId: string, secret: string) {
  const now = new Date();
  const principalId = principalIdForInstance();
  const database = getDatabase();
  database
    .prepare("INSERT INTO auth_principals (id, created_at) VALUES (?, ?)")
    .run(principalId, now.toISOString());
  database
    .prepare(
      `INSERT INTO auth_pairings
         (id, principal_id, secret_hash, audience, continue_kind,
          continue_path, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'web', '/chat', ?, ?)`
    )
    .run(
      pairingId,
      principalId,
      createHash("sha256")
        .update(pairingDomain)
        .update(Buffer.from(secret, "base64url"))
        .digest("base64url"),
      env.PUBLIC_URL,
      now.toISOString(),
      new Date(now.getTime() + 10 * 60_000).toISOString()
    );
}

function cookieHeaders(setCookie: string) {
  const cookie = setCookie.split(";", 1)[0];
  if (!cookie) throw new Error("Session cookie is missing.");
  return new Headers({ cookie });
}

function requireCoordinate(value: string | undefined) {
  if (!value) throw new Error("P-256 public key coordinate is missing.");
  return value;
}

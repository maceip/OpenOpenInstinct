import { z } from "zod";
import {
  decodeBase64Url,
  encodeBase64Url,
  encodeDeviceSessionProof,
  parsePairingFragment,
  publicKeyJwkSchema,
  type DeviceSessionProof,
  type PublicKeyJwk,
} from "./device-auth-protocol";

const DATABASE_NAME = "openopeninstinct-auth-v1";
const STORE_NAME = "device-keys";
const ACTIVE_KEY = "active";
const PENDING_KEY = "pending";
const SIGNED_OUT_KEY = "openopeninstinct.auth.signed-out.v1";

interface StoredDeviceKey {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly enrolled: boolean;
  readonly privateKey: CryptoKey;
  readonly publicKey: PublicKeyJwk;
  readonly version: 1;
}

const challengeResponseSchema = z.object({
  audience: z.string(),
  challenge: z.string(),
  challengeId: z.string(),
  expiresAtMs: z.number(),
  instanceId: z.string(),
  keyEpoch: z.number().int().positive(),
});

const sessionResponseSchema = z.object({
  continueUrl: z.string().optional(),
  device: z.object({ id: z.string(), name: z.string() }),
  session: z.object({ expiresAt: z.string(), id: z.string() }),
  user: z.object({ id: z.string() }),
});

export async function pairFromFragment(fragment: string) {
  const pairing = parsePairingFragment(fragment);
  const device = await generateDeviceKey();
  await savePendingDeviceKey(device);

  const response = await fetch("/api/auth/pair", {
    body: JSON.stringify({
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      instanceId: pairing.instanceId,
      pairingId: pairing.pairingId,
      publicKey: device.publicKey,
      secret: pairing.secret,
    }),
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(readApiError(body));

  const session = sessionResponseSchema.parse(body);
  await activateDeviceKey({ ...device, enrolled: true });
  clearSignedOutMarker();
  return session;
}

export async function recoverEnrolledDevice({ force = false } = {}) {
  if (!force && isSignedOut()) return null;
  const stored = await loadRecoverableDeviceKey();
  if (!stored) return null;
  const { device } = stored;

  const challengeResponse = await fetch("/api/auth/challenge", {
    body: JSON.stringify({ deviceId: device.deviceId }),
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });
  if (!challengeResponse.ok) return null;
  const challenge = challengeResponseSchema.parse(
    await challengeResponse.json()
  );
  if (decodeBase64Url(challenge.challenge).byteLength !== 32) return null;

  const now = Date.now();
  const proof: DeviceSessionProof = {
    audience: challenge.audience,
    challenge: challenge.challenge,
    challengeId: challenge.challengeId,
    deviceId: device.deviceId,
    expiresAtMs: Math.max(now + 1_000, challenge.expiresAtMs - 1_000),
    instanceId: challenge.instanceId,
    issuedAtMs: now,
    keyEpoch: challenge.keyEpoch,
    version: 1,
  };
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { hash: "SHA-256", name: "ECDSA" },
      device.privateKey,
      Uint8Array.from(encodeDeviceSessionProof(proof)).buffer
    )
  );
  if (signature.byteLength !== 64) return null;

  const redeemResponse = await fetch("/api/auth/redeem", {
    body: JSON.stringify({
      proof,
      signature: encodeBase64Url(signature),
    }),
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });
  if (!redeemResponse.ok) return null;
  const session = sessionResponseSchema.parse(await redeemResponse.json());
  if (stored.pending) {
    await activateDeviceKey({ ...device, enrolled: true });
  }
  clearSignedOutMarker();
  return session;
}

export async function hasEnrolledDevice() {
  return (await loadDeviceKey())?.enrolled === true;
}

export function markSignedOut() {
  window.localStorage.setItem(SIGNED_OUT_KEY, "1");
}

function isSignedOut() {
  try {
    return window.localStorage.getItem(SIGNED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function clearSignedOutMarker() {
  try {
    window.localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    // Storage may be disabled; the server session remains authoritative.
  }
}

async function generateDeviceKey(): Promise<StoredDeviceKey> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const publicKey = publicKeyJwkSchema.parse({
    crv: exported.crv,
    kty: exported.kty,
    x: exported.x,
    y: exported.y,
  });
  return {
    deviceId: randomId(),
    deviceName: browserDeviceName(),
    enrolled: false,
    privateKey: keyPair.privateKey,
    publicKey,
    version: 1,
  };
}

function browserDeviceName() {
  const platform = navigator.platform.trim();
  return platform ? `${platform} browser` : "Browser device";
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return encodeBase64Url(bytes);
}

async function loadDeviceKey() {
  return withStore<StoredDeviceKey | undefined>("readonly", (store) =>
    requestResult(store.get(ACTIVE_KEY))
  );
}

async function loadRecoverableDeviceKey() {
  const active = await loadDeviceKey();
  if (active?.enrolled) return { device: active, pending: false };
  const pending = await withStore<StoredDeviceKey | undefined>(
    "readonly",
    (store) => requestResult(store.get(PENDING_KEY))
  );
  return pending ? { device: pending, pending: true } : undefined;
}

async function savePendingDeviceKey(record: StoredDeviceKey) {
  await withStore("readwrite", (store) =>
    requestResult(store.put(record, PENDING_KEY))
  );
}

async function activateDeviceKey(record: StoredDeviceKey) {
  await withStore("readwrite", async (store) => {
    await requestResult(store.put(record, ACTIVE_KEY));
    await requestResult(store.delete(PENDING_KEY));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>
) {
  const database = await openAuthDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const result = await operation(transaction.objectStore(STORE_NAME));
    await transactionDone(transaction);
    return result;
  } finally {
    database.close();
  }
}

function openAuthDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB failed."));
    });
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB failed."));
    });
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(transaction.error ?? new Error("IndexedDB aborted."));
    });
    transaction.addEventListener("error", () => {
      reject(transaction.error ?? new Error("IndexedDB failed."));
    });
  });
}

function readApiError(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return "This device could not be paired.";
}

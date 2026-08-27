import { z } from "zod";

const textEncoder = new TextEncoder();
const DEVICE_SESSION_DOMAIN = textEncoder.encode(
  "openopeninstinct-device-session-v1\0"
);

export const opaqueIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/u);
export const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/u);
export const publicKeyJwkSchema = z
  .object({
    crv: z.literal("P-256"),
    kty: z.literal("EC"),
    x: base64UrlSchema,
    y: base64UrlSchema,
  })
  .strict();

export const pairDeviceRequestSchema = z
  .object({
    deviceId: opaqueIdSchema,
    deviceName: z.string().trim().min(1).max(80),
    instanceId: opaqueIdSchema,
    pairingId: opaqueIdSchema,
    publicKey: publicKeyJwkSchema,
    secret: base64UrlSchema,
  })
  .strict();

export const deviceChallengeRequestSchema = z
  .object({ deviceId: opaqueIdSchema })
  .strict();

export const deviceSessionProofSchema = z
  .object({
    audience: z.string().url(),
    challenge: base64UrlSchema,
    challengeId: opaqueIdSchema,
    deviceId: opaqueIdSchema,
    expiresAtMs: z.number().int().positive(),
    instanceId: opaqueIdSchema,
    issuedAtMs: z.number().int().positive(),
    keyEpoch: z.number().int().positive(),
    version: z.literal(1),
  })
  .strict();

export const redeemDeviceRequestSchema = z
  .object({
    proof: deviceSessionProofSchema,
    signature: base64UrlSchema,
  })
  .strict();

export type DeviceSessionProof = z.infer<typeof deviceSessionProofSchema>;
export type PublicKeyJwk = z.infer<typeof publicKeyJwkSchema>;

export interface PairingFragment {
  readonly instanceId: string;
  readonly pairingId: string;
  readonly secret: string;
}

export function parsePairingFragment(fragment: string): PairingFragment {
  const match =
    /^#v1\.([A-Za-z0-9_-]{16,128})\.([A-Za-z0-9_-]{16,128})\.([A-Za-z0-9_-]+)$/u.exec(
      fragment
    );
  if (!match) throw new TypeError("Invalid OpenOpenInstinct pairing link.");
  const [, instanceId, pairingId, secret] = match;
  if (!instanceId || !pairingId || !secret) {
    throw new TypeError("Invalid OpenOpenInstinct pairing link.");
  }
  if (decodeBase64Url(secret).byteLength !== 32) {
    throw new TypeError("Invalid OpenOpenInstinct pairing secret.");
  }
  return { instanceId, pairingId, secret };
}

export function encodeDeviceSessionProof(proof: DeviceSessionProof) {
  const parsed = deviceSessionProofSchema.parse(proof);
  const writer = new CanonicalWriter();
  writer.bytesWithoutLength(DEVICE_SESSION_DOMAIN);
  writer.u8(parsed.version);
  writer.text(parsed.instanceId);
  writer.text(parsed.challengeId);
  writer.text(parsed.deviceId);
  writer.u64(BigInt(parsed.keyEpoch));
  writer.text(parsed.audience);
  writer.bytes(decodeFixedBase64Url(parsed.challenge, 32, "challenge"));
  writer.u64(BigInt(parsed.issuedAtMs));
  writer.u64(BigInt(parsed.expiresAtMs));
  return writer.finish();
}

export function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) {
    throw new TypeError("Invalid base64url value.");
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeFixedBase64Url(value: string, length: number, name: string) {
  const decoded = decodeBase64Url(value);
  if (decoded.byteLength !== length) {
    throw new TypeError(`${name} must contain exactly ${length} bytes.`);
  }
  return decoded;
}

class CanonicalWriter {
  readonly #parts: Uint8Array[] = [];

  bytesWithoutLength(value: Uint8Array) {
    this.#parts.push(value);
  }

  u8(value: number) {
    this.#parts.push(Uint8Array.of(value));
  }

  u32(value: number) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, false);
    this.#parts.push(bytes);
  }

  u64(value: bigint) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, value, false);
    this.#parts.push(bytes);
  }

  bytes(value: Uint8Array) {
    this.u32(value.byteLength);
    this.#parts.push(value);
  }

  text(value: string) {
    this.bytes(textEncoder.encode(value));
  }

  finish() {
    const length = this.#parts.reduce(
      (total, part) => total + part.byteLength,
      0
    );
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of this.#parts) {
      output.set(part, offset);
      offset += part.byteLength;
    }
    return output;
  }
}

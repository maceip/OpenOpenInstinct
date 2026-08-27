import { describe, expect, it } from "vitest";
import { accessScopeForUser } from "../lib/access-scope";
import {
  deviceSessionProofSchema,
  encodeBase64Url,
  encodeDeviceSessionProof,
  parsePairingFragment,
} from "../lib/device-auth-protocol";
import { sessionIdFromPath } from "../lib/eve-session-path";
import { normalizeAuthPhoneNumber } from "../lib/phone-number";

describe("device authentication", () => {
  it("derives stable personal workspaces without exposing principal ids", () => {
    const first = accessScopeForUser("device-auth:principal-one");
    const second = accessScopeForUser("device-auth:principal-two");

    expect(first).toEqual(accessScopeForUser("device-auth:principal-one"));
    expect(first.workspaceId).not.toBe(second.workspaceId);
    expect(first.workspaceId).not.toContain("principal-one");
  });

  it("parses a one-use pairing fragment without putting secrets in a query", () => {
    const secret = encodeBase64Url(new Uint8Array(32).fill(7));
    const fragment = `#v1.test-instance-000000000000.pairing-000000000000.${secret}`;

    expect(parsePairingFragment(fragment)).toEqual({
      instanceId: "test-instance-000000000000",
      pairingId: "pairing-000000000000",
      secret,
    });
    expect(() =>
      parsePairingFragment(
        `#v1.test-instance-000000000000.pairing-000000000000.${encodeBase64Url(new Uint8Array(31))}`
      )
    ).toThrow("Invalid OpenOpenInstinct pairing secret");
  });

  it("canonically binds signed proofs to device, instance, and origin", async () => {
    const proof = deviceSessionProofSchema.parse({
      audience: "https://assistant.example.com",
      challenge: encodeBase64Url(new Uint8Array(32).fill(3)),
      challengeId: "challenge-0000000000",
      deviceId: "device-00000000000000",
      expiresAtMs: 1_800_000_000_000,
      instanceId: "test-instance-000000000000",
      issuedAtMs: 1_799_999_940_000,
      keyEpoch: 1,
      version: 1,
    });
    const encoded = encodeDeviceSessionProof(proof);
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );
    const signature = await crypto.subtle.sign(
      { hash: "SHA-256", name: "ECDSA" },
      keyPair.privateKey,
      encoded
    );

    expect(
      await crypto.subtle.verify(
        { hash: "SHA-256", name: "ECDSA" },
        keyPair.publicKey,
        signature,
        encoded
      )
    ).toBe(true);
    expect(
      await crypto.subtle.verify(
        { hash: "SHA-256", name: "ECDSA" },
        keyPair.publicKey,
        signature,
        encodeDeviceSessionProof({
          ...proof,
          audience: "https://attacker.example.com",
        })
      )
    ).toBe(false);
  });

  it("extracts ownership ids from every Eve session route", () => {
    expect(sessionIdFromPath("/eve/v1/session/session%2Fone/stream")).toBe(
      "session/one"
    );
    expect(sessionIdFromPath("/eve/v1/session/session-two/cancel")).toBe(
      "session-two"
    );
    expect(sessionIdFromPath("/eve/v1/session")).toBeUndefined();
  });

  it("normalizes owner-channel phone numbers", () => {
    expect(normalizeAuthPhoneNumber("(202) 555-0123")).toBe("+12025550123");
    expect(normalizeAuthPhoneNumber("+44 7911 123456")).toBe("+447911123456");
    expect(normalizeAuthPhoneNumber("not-a-number")).toBeUndefined();
  });
});

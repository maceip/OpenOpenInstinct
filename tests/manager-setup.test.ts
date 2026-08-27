import { describe, expect, it } from "vitest";
import {
  createManagerSetupUrl,
  managerMutationSchema,
  managerSetupRequestSchema,
  parseManagerSetupSearchParams,
} from "../lib/manager";
import { serializePaymentCard } from "../lib/payment-card";
import {
  isAllowedMutationOrigin,
  isAllowedRequestHost,
} from "../lib/server/request-security";
import {
  serializeContactVaultPayload,
  serializeLoginVaultPayload,
} from "../lib/vault-payload";

describe("self-hosted manager", () => {
  it("builds a vault form URL without accepting a secret", () => {
    expect(
      managerSetupRequestSchema.safeParse({
        kind: "login",
        secret: "must-not-enter-a-url",
        target: "vault",
      }).success
    ).toBe(false);
    expect(
      managerSetupRequestSchema.safeParse({
        kind: "identity",
        target: "vault",
      }).success
    ).toBe(false);
    expect(
      managerSetupRequestSchema.safeParse({
        account: "person@example.com",
        identifierType: "email",
        kind: "login",
        label: "Personal login",
        origin: "https://auth.uber.com",
        target: "vault",
      }).success
    ).toBe(false);
    expect(
      managerSetupRequestSchema.safeParse({
        kind: "login",
        label: "Personal login",
        origin: "https://auth.uber.com",
        target: "vault",
      }).success
    ).toBe(false);

    const url = new URL(
      createManagerSetupUrl("https://assistant.example.com", {
        identifierType: "email",
        kind: "login",
        label: "Personal login",
        origin: "https://auth.uber.com",
        target: "vault",
      })
    );

    expect(url.pathname).toBe("/vault");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      identifier_type: "email",
      kind: "login",
      label: "Personal login",
      origin: "https://auth.uber.com",
      setup: "vault",
    });

    const addressUrl = new URL(
      createManagerSetupUrl("https://assistant.example.com", {
        kind: "address",
        label: "Home address",
        target: "vault",
      })
    );

    expect(addressUrl.pathname).toBe("/vault");
    expect(Object.fromEntries(addressUrl.searchParams)).toEqual({
      kind: "address",
      label: "Home address",
      setup: "vault",
    });
    expect(
      parseManagerSetupSearchParams(Object.fromEntries(addressUrl.searchParams))
    ).toEqual({
      data: {
        kind: "address",
        label: "Home address",
        target: "vault",
      },
      success: true,
    });
    expect(
      parseManagerSetupSearchParams({
        ...Object.fromEntries(addressUrl.searchParams),
        identifier_type: "email",
      }).success
    ).toBe(false);
  });

  it("does not expose removed runtime mutations", () => {
    expect(
      managerMutationSchema.safeParse({
        action: "model.select",
        modelId: "anthropic/claude-sonnet-4.5",
      }).success
    ).toBe(false);
    expect(
      managerMutationSchema.safeParse({
        action: "connection.create",
        input: {
          endpoint: "http://127.0.0.1:11434/v1",
          provider: "local-model",
        },
      }).success
    ).toBe(false);
  });

  it("requires complete structured payment-card details", () => {
    const mutation = {
      action: "vault.create",
      input: {
        account: "Visa · •••• 4242",
        kind: "payment",
        label: "Personal",
        secret: "4242 4242 4242 4242",
      },
    };

    expect(managerMutationSchema.safeParse(mutation).success).toBe(false);
    expect(
      managerMutationSchema.safeParse({
        ...mutation,
        input: {
          ...mutation.input,
          secret: serializePaymentCard({
            billingPostalCode: "11217",
            cardholderName: "Ada Lovelace",
            expirationMonth: 12,
            expirationYear: 2030,
            kind: "payment-card",
            number: "4242424242424242",
            securityCode: "123",
            version: 1,
          }),
        },
      }).success
    ).toBe(true);
  });

  it("requires versioned login and contact payloads", () => {
    expect(
      managerMutationSchema.safeParse({
        action: "vault.create",
        input: {
          account: "ada@example.com",
          kind: "login",
          label: "GitHub",
          secret: "plain password",
        },
      }).success
    ).toBe(false);
    expect(
      managerMutationSchema.safeParse({
        action: "vault.create",
        input: {
          account: "",
          kind: "login",
          label: "GitHub",
          secret: serializeLoginVaultPayload({
            authentication: { password: "secret", type: "password" },
            identifier: { type: "email", value: "ada@example.com" },
            kind: "login",
            origin: "https://github.com",
            version: 2,
          }),
        },
      }).success
    ).toBe(true);
    expect(
      managerMutationSchema.safeParse({
        action: "vault.create",
        input: {
          account: "",
          kind: "contact",
          label: "Checkout",
          secret: serializeContactVaultPayload({
            email: "ada@example.com",
            kind: "contact",
            phone: "+15555550100",
            version: 1,
          }),
        },
      }).success
    ).toBe(true);
  });

  it("allows writes only from the configured public origin", () => {
    const headers = new Headers({
      host: "assistant.example.com",
      origin: "https://assistant.example.com",
      "x-forwarded-host": "attacker-controlled.example",
    });

    expect(isAllowedRequestHost(headers)).toBe(true);
    expect(isAllowedMutationOrigin(headers)).toBe(true);
    expect(
      isAllowedMutationOrigin(
        new Headers({
          host: "assistant.example.com",
          origin: "https://attacker.example.com",
        })
      )
    ).toBe(false);
    expect(
      isAllowedRequestHost(
        new Headers({
          host: "127.0.0.1:3000",
          origin: "https://assistant.example.com",
        })
      )
    ).toBe(false);
    expect(
      isAllowedMutationOrigin(new Headers({ host: "assistant.example.com" }))
    ).toBe(false);
  });
});

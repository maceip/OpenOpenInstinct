/* oxlint-disable typescript/no-unsafe-type-assertion -- Mocking tool execution context in unit test */
import type { ToolContext } from "eve/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fillFromVault, {
  createVaultAutofillCode,
} from "../agent/tools/fill_from_vault";
import type { VaultItemKind } from "../lib/manager";
import { serializePaymentCard } from "../lib/payment-card";
import {
  resolveVaultAutofillValues,
  VaultAutofillFieldError,
} from "../lib/vault-autofill";
import {
  serializeAddressVaultPayload,
  serializeContactVaultPayload,
  serializeLoginVaultPayload,
} from "../lib/vault-payload";

const VAULT_ITEM_ID = "00000000-0000-4000-8000-000000000001";

const mocks = vi.hoisted(() => ({
  executePlaywright:
    vi.fn<
      (
        _sessionId: string,
        _input: { code: string; timeout_sec: number },
        _options: { signal?: AbortSignal }
      ) => Promise<{ success: boolean }>
    >(),
  readVaultItem: vi.fn<
    () => Promise<
      | {
          account: string;
          createdAt: string;
          id: string;
          kind: VaultItemKind;
          label: string;
          updatedAt: string;
        }
      | undefined
    >
  >(),
  readSecret: vi.fn<() => Promise<string | undefined>>(),
  requireOwnedBrowserSession: vi.fn<() => Promise<void>>(),
}));

vi.mock("@onkernel/sdk", () => ({
  default: class {
    readonly browsers = {
      playwright: { execute: mocks.executePlaywright },
    };
  },
}));

vi.mock("@/lib/server/secret-store", () => ({
  readSecret: mocks.readSecret,
}));

vi.mock("@/db/services/vault", () => ({
  readVaultItem: mocks.readVaultItem,
}));

vi.mock("@/lib/server/kernel-browser", () => ({
  requireOwnedBrowserSession: mocks.requireOwnedBrowserSession,
}));

const toolContext = {
  abortSignal: new AbortController().signal,
  session: {
    auth: {
      current: {
        attributes: { workspaceId: "personal:test-workspace" },
        id: "user-1",
      },
      initiator: {
        attributes: { workspaceId: "personal:test-workspace" },
        id: "user-1",
      },
    },
    getSandbox: vi.fn<() => void>(),
    getSkill: vi.fn<() => void>(),
    id: "session-1",
    turn: {
      id: "turn-1",
    },
  },
} as unknown as ToolContext;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executePlaywright.mockResolvedValue({ success: true });
  mocks.readVaultItem.mockResolvedValue({
    account: "ada@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    id: VAULT_ITEM_ID,
    kind: "login",
    label: "Primary login",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mocks.readSecret.mockResolvedValue(
    serializeLoginVaultPayload({
      authentication: {
        password: "correct horse battery staple",
        type: "password",
      },
      identifier: { type: "email", value: "ada@example.com" },
      kind: "login",
      origin: "https://checkout.example",
      version: 2,
    })
  );
  mocks.requireOwnedBrowserSession.mockResolvedValue(undefined);
});

describe("vault browser autofill", () => {
  it("resolves a login without returning unrequested values", () => {
    expect(
      resolveVaultAutofillValues(
        { account: "ada@example.com", kind: "login" },
        serializeLoginVaultPayload({
          authentication: {
            password: "correct horse battery staple",
            type: "password",
          },
          identifier: { type: "email", value: "ada@example.com" },
          kind: "login",
          origin: "https://checkout.example",
          version: 2,
        }),
        ["username"],
        "https://checkout.example"
      )
    ).toEqual([{ field: "username", value: "ada@example.com" }]);
  });

  it("rejects a login outside its saved origin before calling Kernel", async () => {
    await expect(
      fillFromVault.execute(
        {
          browserSessionId: "browser-1",
          expectedOrigin: "https://attacker.example",
          fields: [{ field: "username", selector: "#username" }],
          vaultItemId: VAULT_ITEM_ID,
        },
        toolContext
      )
    ).rejects.toThrow("restricted to https://checkout.example");

    expect(mocks.executePlaywright).not.toHaveBeenCalled();
  });

  it("refuses legacy logins that have no saved origin", async () => {
    mocks.readSecret.mockResolvedValue(
      JSON.stringify({
        authentication: { password: "correct horse", type: "password" },
        identifier: { type: "email", value: "ada@example.com" },
        kind: "login",
        version: 1,
      })
    );

    await expect(
      fillFromVault.execute(
        {
          browserSessionId: "browser-1",
          expectedOrigin: "https://checkout.example",
          fields: [{ field: "username", selector: "#username" }],
          vaultItemId: VAULT_ITEM_ID,
        },
        toolContext
      )
    ).rejects.toThrow("not assigned to a website");

    expect(mocks.executePlaywright).not.toHaveBeenCalled();
  });

  it("resolves structured password and passwordless logins", async () => {
    mocks.readVaultItem.mockResolvedValue({
      account: "Phone · •••• 0100",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: VAULT_ITEM_ID,
      kind: "login",
      label: "Primary login",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.readSecret.mockResolvedValue(
      serializeLoginVaultPayload({
        authentication: { password: "correct horse", type: "password" },
        identifier: { type: "phone", value: "+15555550100" },
        kind: "login",
        origin: "https://checkout.example",
        version: 2,
      })
    );

    await expect(
      fillFromVault.execute(
        {
          browserSessionId: "browser-1",
          expectedOrigin: "https://checkout.example",
          fields: [
            { field: "username", selector: "#username" },
            { field: "phone", selector: "#phone" },
            { field: "password", selector: "#password" },
          ],
          vaultItemId: VAULT_ITEM_ID,
        },
        toolContext
      )
    ).resolves.toMatchObject({
      filledFields: ["username", "phone", "password"],
      origin: "https://checkout.example",
      success: true,
    });

    mocks.readSecret.mockResolvedValue(
      serializeLoginVaultPayload({
        authentication: { type: "email_otp" },
        identifier: { type: "email", value: "ada@example.com" },
        kind: "login",
        origin: "https://checkout.example",
        version: 2,
      })
    );
    await expect(
      fillFromVault.execute(
        {
          browserSessionId: "browser-1",
          expectedOrigin: "https://checkout.example",
          fields: [{ field: "password", selector: "#password" }],
          vaultItemId: VAULT_ITEM_ID,
        },
        toolContext
      )
    ).resolves.toMatchObject({
      error: {
        code: "vault_fields_missing",
        missingFields: ["password"],
      },
      success: false,
    });
  });

  it("resolves structured checkout profiles field by field", async () => {
    mocks.readVaultItem.mockResolvedValue({
      account: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: VAULT_ITEM_ID,
      kind: "address",
      label: "Home",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.readSecret.mockResolvedValue(
      serializeAddressVaultPayload({
        city: "London",
        countryCode: "GB",
        kind: "address",
        line1: "12 St James's Square",
        postalCode: "SW1Y 4LB",
        recipientName: "Ada Lovelace",
        region: "London",
        version: 1,
      })
    );

    await expect(
      fillFromVault.execute(
        {
          browserSessionId: "browser-1",
          expectedOrigin: "https://checkout.example",
          fields: [
            { field: "full_name", selector: "#name" },
            { field: "address_line1", selector: "#address" },
            { field: "address_city", selector: "#city" },
            { field: "address_postal_code", selector: "#postal-code" },
          ],
          vaultItemId: VAULT_ITEM_ID,
        },
        toolContext
      )
    ).resolves.toMatchObject({
      filledFields: [
        "full_name",
        "address_line1",
        "address_city",
        "address_postal_code",
      ],
      origin: "https://checkout.example",
      success: true,
    });

    mocks.readVaultItem.mockResolvedValue({
      account: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: VAULT_ITEM_ID,
      kind: "contact",
      label: "Checkout",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.readSecret.mockResolvedValue(
      serializeContactVaultPayload({
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        kind: "contact",
        phone: "+442079460000",
        version: 1,
      })
    );

    await expect(
      fillFromVault.execute(
        {
          browserSessionId: "browser-1",
          expectedOrigin: "https://checkout.example",
          fields: [
            { field: "full_name", selector: "#name" },
            { field: "email", selector: "#email" },
            { field: "phone", selector: "#phone" },
          ],
          vaultItemId: VAULT_ITEM_ID,
        },
        toolContext
      )
    ).resolves.toMatchObject({
      filledFields: ["full_name", "email", "phone"],
      origin: "https://checkout.example",
      success: true,
    });
  });

  it("formats payment fields and uses native card autofill with a keyboard fallback", async () => {
    const secret = serializePaymentCard({
      billingPostalCode: "11217",
      cardholderName: "Ada Lovelace",
      expirationMonth: 3,
      expirationYear: 2031,
      kind: "payment-card",
      number: "4242424242424242",
      securityCode: "123",
      version: 1,
    });

    expect(
      resolveVaultAutofillValues(
        { account: "Visa 4242", kind: "payment" },
        secret,
        ["expiration", "cvc", "billing_postal_code"]
      )
    ).toEqual([
      { field: "expiration", value: "03/31" },
      { field: "cvc", value: "123" },
      { field: "billing_postal_code", value: "11217" },
    ]);
  });

  it("rejects fields that do not belong to the selected vault item", () => {
    let caught: unknown;
    try {
      resolveVaultAutofillValues(
        { account: "ada@example.com", kind: "login" },
        serializeLoginVaultPayload({
          authentication: {
            password: "correct horse battery staple",
            type: "password",
          },
          identifier: { type: "email", value: "ada@example.com" },
          kind: "login",
          origin: "https://checkout.example",
          version: 2,
        }),
        ["card_number", "cvc"],
        "https://checkout.example"
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VaultAutofillFieldError);
    expect(caught).toMatchObject({
      code: "vault_fields_missing",
      missingFields: ["card_number", "cvc"],
    });
  });

  it("uses Chrome-native card autofill with a verified keyboard fallback", () => {
    const code = createVaultAutofillCode({
      expectedOrigin: "https://checkout.example",
      fields: [
        {
          field: "cardholder_name",
          selector: "#cardholder-name",
          value: "Ada Lovelace",
        },
        {
          field: "card_number",
          selector: "#card-number",
          value: "4242424242424242",
        },
        {
          field: "expiration",
          selector: "#expiration",
          value: "03/31",
        },
        {
          field: "cvc",
          selector: "#cvc",
          value: "123",
        },
      ],
    });

    expect(code).toContain('"card_number"');
    expect(code).toContain("context.newCDPSession(page)");
    expect(code).toContain('cdp.send("Autofill.trigger"');
    expect(code).toContain("fieldId: node.backendNodeId");
    expect(code).toContain("card: nativeCard");
    expect(code).toContain("if (cdp) await cdp.detach()");
    expect(code).toContain("node instanceof HTMLSelectElement");
    expect(code).toContain("await element.selectOption(optionValue)");
    expect(code).toContain("await element.fill(field.value)");
    expect(code).toContain("pressSequentially(field.value");
    expect(code).toContain('dispatchEvent("change")');
    expect(code).toContain("const readValue = () =>");
    expect(code).toContain('replaceAll(/\\D/gu, "")');
    expect(code).toContain("await element.blur()");
  });
});

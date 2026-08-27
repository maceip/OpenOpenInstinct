import { afterEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();

afterEach(() => {
  values.clear();
  vi.doUnmock("@/db/services/secrets");
  vi.resetModules();
});

describe("vault encryption", () => {
  it("stores only authenticated ciphertext and binds it to the workspace", async () => {
    vi.doMock("@/db/services/secrets", () => ({
      deleteEncryptedSecret: (scope: Scope, id: string) => {
        values.delete(storageKey(scope, id));
      },
      readEncryptedSecret: (scope: Scope, id: string) =>
        values.get(storageKey(scope, id)),
      writeEncryptedSecret: (
        scope: Scope,
        id: string,
        encryptedValue: string
      ) => {
        values.set(storageKey(scope, id), encryptedValue);
      },
    }));
    const { readSecret, writeSecret } =
      await import("../lib/server/secret-store");
    const alice = { userId: "alice", workspaceId: "workspace:alice" };
    const bob = { userId: "bob", workspaceId: "workspace:bob" };

    await writeSecret({
      id: "vault-item",
      namespace: "vault",
      scope: alice,
      value: "correct horse battery staple",
    });

    const ciphertext = values.get(storageKey(alice, "vault-item"));
    expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./u);
    expect(ciphertext).not.toContain("correct horse battery staple");
    expect(
      await readSecret({
        id: "vault-item",
        namespace: "vault",
        scope: alice,
      })
    ).toBe("correct horse battery staple");

    if (!ciphertext) throw new Error("Expected encrypted test data.");
    values.set(storageKey(bob, "vault-item"), ciphertext);
    await expect(
      readSecret({ id: "vault-item", namespace: "vault", scope: bob })
    ).rejects.toThrow(/authenticate|authentication/iu);
  });
});

interface Scope {
  readonly userId: string;
  readonly workspaceId: string;
}

function storageKey(scope: Scope, id: string) {
  return `${scope.workspaceId}:${id}`;
}

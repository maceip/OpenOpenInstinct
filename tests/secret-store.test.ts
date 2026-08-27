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
      deleteEncryptedSecret: (
        scope: Scope,
        namespace: Namespace,
        id: string
      ) => {
        values.delete(storageKey(scope, namespace, id));
      },
      readEncryptedSecret: (scope: Scope, namespace: Namespace, id: string) =>
        values.get(storageKey(scope, namespace, id)),
      writeEncryptedSecret: (
        scope: Scope,
        namespace: Namespace,
        id: string,
        encryptedValue: string
      ) => {
        values.set(storageKey(scope, namespace, id), encryptedValue);
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

    const ciphertext = values.get(storageKey(alice, "vault", "vault-item"));
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
    values.set(storageKey(bob, "vault", "vault-item"), ciphertext);
    await expect(
      readSecret({ id: "vault-item", namespace: "vault", scope: bob })
    ).rejects.toThrow(/authenticate|authentication/iu);

    values.set(storageKey(alice, "google-oauth", "vault-item"), ciphertext);
    await expect(
      readSecret({
        id: "vault-item",
        namespace: "google-oauth",
        scope: alice,
      })
    ).rejects.toThrow(/authenticate|authentication/iu);
  });
});

interface Scope {
  readonly userId: string;
  readonly workspaceId: string;
}

type Namespace = "google-oauth" | "vault";

function storageKey(scope: Scope, namespace: Namespace, id: string) {
  return `${scope.workspaceId}:${namespace}:${id}`;
}

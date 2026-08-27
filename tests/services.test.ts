import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "../db/sqlite.mjs";

let database: DatabaseSync | undefined;

afterEach(() => {
  vi.doUnmock("@/db");
  vi.resetModules();
  database?.close();
  database = undefined;
});

describe("database services", () => {
  it("preserves workspace ownership across application domains", async () => {
    database = openDatabase(":memory:");
    vi.doMock("@/db", () => ({
      getDatabase: () => database,
      withTransaction: (operation: (value: DatabaseSync) => unknown) => {
        if (!database) throw new Error("Test database is unavailable.");
        database.exec("BEGIN IMMEDIATE");
        try {
          const result = operation(database);
          database.exec("COMMIT");
          return result;
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
      },
    }));

    const [browsers, chats, secrets, sessions, scope, vault] =
      await Promise.all([
        import("@/db/services/browsers"),
        import("@/db/services/chats"),
        import("@/db/services/secrets"),
        import("@/db/services/sessions"),
        import("@/db/services/scope"),
        import("@/db/services/vault"),
      ]);
    const alice = { userId: "alice", workspaceId: "workspace:alice" };
    const bob = { userId: "bob", workspaceId: "workspace:bob" };

    await scope.ensureScope(alice);
    await scope.ensureScope(bob);
    await sessions.claimSession(alice, "session-alice");

    expect(await sessions.isSessionOwned(alice, "session-alice")).toBe(true);
    expect(await sessions.isSessionOwned(bob, "session-alice")).toBe(false);
    expect(await sessions.listOwnedSessionIds(alice)).toEqual(
      new Set(["session-alice"])
    );
    expect(await sessions.listOwnedSessionIds(bob)).toEqual(new Set());

    await sessions.claimSession(bob, "session-alice");
    expect(await sessions.isSessionOwned(alice, "session-alice")).toBe(true);
    expect(await sessions.isSessionOwned(bob, "session-alice")).toBe(false);

    await chats.saveChat(alice, {
      sessionId: "session-alice",
      title: "Initial title",
      usage: { costUsd: 0.25, inputTokens: 10, outputTokens: 4 },
    });
    await chats.saveChat(alice, {
      sessionId: "session-alice",
      title: "Updated title",
    });

    const aliceChat = await chats.readChat(alice, "session-alice");
    expect(aliceChat?.title).toBe("Updated title");
    expect(aliceChat?.usage).toEqual({
      costUsd: 0.25,
      inputTokens: 10,
      outputTokens: 4,
    });
    expect(await chats.readChat(bob, "session-alice")).toBeUndefined();
    expect(await chats.listChats(alice)).toEqual([aliceChat]);
    expect(await chats.listChats(bob)).toEqual([]);

    await expect(
      chats.saveChat(bob, {
        sessionId: "session-alice",
        title: "Bob's title",
      })
    ).rejects.toThrow(/UNIQUE constraint failed/u);

    await browsers.createBrowserSession(alice, {
      createdAt: new Date().toISOString(),
      sessionId: "browser-alice",
    });
    expect(
      await browsers.readBrowserSession(alice, "browser-alice")
    ).toBeDefined();
    expect(
      await browsers.readBrowserSession(bob, "browser-alice")
    ).toBeUndefined();
    expect(await browsers.deleteBrowserSession(bob, "browser-alice")).toBe(
      false
    );

    const now = new Date().toISOString();
    await vault.createVaultItem(alice, {
      account: "alice@example.com",
      createdAt: now,
      id: "vault-alice",
      kind: "login",
      label: "Alice",
      updatedAt: now,
    });
    expect(await vault.readVaultItem(alice, "vault-alice")).toMatchObject({
      id: "vault-alice",
    });
    expect(await vault.readVaultItem(bob, "vault-alice")).toBeUndefined();
    expect(await vault.deleteVaultItem(bob, "vault-alice")).toBe(false);

    await secrets.writeEncryptedSecret(alice, "shared-id", "ciphertext-alice");
    await secrets.writeEncryptedSecret(bob, "shared-id", "ciphertext-bob");
    expect(await secrets.readEncryptedSecret(alice, "shared-id")).toBe(
      "ciphertext-alice"
    );
    expect(await secrets.readEncryptedSecret(bob, "shared-id")).toBe(
      "ciphertext-bob"
    );
    await secrets.deleteEncryptedSecret(alice, "shared-id");
    expect(
      await secrets.readEncryptedSecret(alice, "shared-id")
    ).toBeUndefined();
    expect(await secrets.readEncryptedSecret(bob, "shared-id")).toBe(
      "ciphertext-bob"
    );
  });
});

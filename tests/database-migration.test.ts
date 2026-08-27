import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../db/sqlite.mjs";

const databases: DatabaseSync[] = [];
const directories: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("SQLite migrations", () => {
  it("enables WAL durability and applies every migration idempotently", () => {
    const path = createDatabasePath();
    const database = track(openDatabase(path));

    expect(database.prepare("PRAGMA journal_mode").get()?.journal_mode).toBe(
      "wal"
    );
    expect(database.prepare("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
    expect(database.prepare("PRAGMA busy_timeout").get()?.timeout).toBe(5000);
    expect(database.prepare("PRAGMA synchronous").get()?.synchronous).toBe(2);
    expect(database.prepare("PRAGMA user_version").get()?.user_version).toBe(2);

    const expectedTables = [
      "agent_sessions",
      "auth_challenges",
      "auth_devices",
      "auth_pairings",
      "auth_principals",
      "auth_sessions",
      "browser_sessions",
      "chats",
      "encrypted_secrets",
      "vault_items",
      "workspace_memberships",
      "workspaces",
    ];
    const tables = database
      .prepare(
        `SELECT name, strict
         FROM pragma_table_list
         WHERE schema = 'main' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all();
    expect(tables.map((row) => row.name)).toEqual(expectedTables);
    expect(tables.every((row) => row.strict === 1)).toBe(true);

    database.close();
    databases.splice(databases.indexOf(database), 1);
    const reopened = track(openDatabase(path));
    expect(reopened.prepare("PRAGMA user_version").get()?.user_version).toBe(2);

    const securePermissions =
      process.platform === "win32" || (statSync(path).mode & 0o777) === 0o600;
    expect(securePermissions).toBe(true);
  });

  it("enforces foreign keys and strict application constraints", () => {
    const database = track(openDatabase(createDatabasePath()));

    expect(() =>
      database
        .prepare(
          `INSERT INTO workspace_memberships
             (workspace_id, user_id, role, created_at)
           VALUES ('missing', 'owner', 'owner', '2026-01-01')`
        )
        .run()
    ).toThrow(/FOREIGN KEY constraint failed/u);

    database
      .prepare("INSERT INTO workspaces (id, created_at) VALUES (?, ?)")
      .run("workspace", "2026-01-01");
    expect(() =>
      database
        .prepare(
          `INSERT INTO vault_items
             (id, workspace_id, kind, label, account, created_at, updated_at)
           VALUES ('item', 'workspace', 'unknown', 'Item', '', '2026-01-01', '2026-01-01')`
        )
        .run()
    ).toThrow(/CHECK constraint failed/u);
  });
});

function createDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "openopeninstinct-test-"));
  directories.push(directory);
  return join(directory, "openopeninstinct.sqlite");
}

function track(database: DatabaseSync) {
  databases.push(database);
  return database;
}

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATION_PATTERN = /^(\d{4})_.+\.sqlite\.sql$/u;

/**
 * Open an OpenOpenInstinct SQLite database with the durability and isolation
 * settings expected by the application, then apply pending migrations.
 *
 * @param {string} configuredPath
 * @returns {DatabaseSync}
 */
export function openDatabase(configuredPath) {
  if (process.platform !== "win32") process.umask(0o077);
  const databasePath = resolveDatabasePath(configuredPath);
  if (databasePath !== ":memory:")
    mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath, {
    enableForeignKeyConstraints: true,
  });
  try {
    configureDatabase(database, databasePath);
    applyMigrations(database);
    if (databasePath !== ":memory:") secureDatabaseFiles(databasePath);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

function secureDatabaseFiles(databasePath) {
  if (process.platform === "win32") return;
  for (const path of [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ]) {
    if (existsSync(path)) chmodSync(path, 0o600);
  }
}

function resolveDatabasePath(configuredPath) {
  if (configuredPath === ":memory:") return configuredPath;
  return isAbsolute(configuredPath) ? configuredPath : resolve(configuredPath);
}

/** @param {DatabaseSync} database @param {string} databasePath */
function configureDatabase(database, databasePath) {
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA synchronous = FULL");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec("PRAGMA secure_delete = ON");

  if (databasePath !== ":memory:") {
    const result = database.prepare("PRAGMA journal_mode = WAL").get();
    if (result?.journal_mode !== "wal") {
      throw new Error("SQLite refused to enable WAL mode.");
    }
  }
}

/** @param {DatabaseSync} database */
function applyMigrations(database) {
  const current = Number(
    database.prepare("PRAGMA user_version").get()?.user_version ?? 0
  );
  const directory = new URL("./migrations/", import.meta.url);
  const migrations = readdirSync(directory)
    .map((name) => ({ match: MIGRATION_PATTERN.exec(name), name }))
    .filter((entry) => entry.match)
    .map((entry) => ({ name: entry.name, version: Number(entry.match[1]) }))
    .sort((left, right) => left.version - right.version);

  let expected = current + 1;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    if (migration.version !== expected) {
      throw new Error(
        `Missing SQLite migration ${String(expected).padStart(4, "0")}.`
      );
    }

    database.exec("BEGIN EXCLUSIVE");
    try {
      database.exec(readFileSync(new URL(migration.name, directory), "utf8"));
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    expected += 1;
  }
}

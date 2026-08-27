import type { DatabaseSync } from "node:sqlite";
import { env } from "@/lib/env";
import { openDatabase } from "./sqlite.mjs";

const globalDatabase = globalThis as typeof globalThis & {
  openOpenInstinctDatabase?: DatabaseSync;
};

export type Database = DatabaseSync;

export function getDatabase() {
  return (globalDatabase.openOpenInstinctDatabase ??= openDatabase(
    env.DATABASE_PATH
  ));
}

export function withTransaction<T>(operation: (database: Database) => T): T {
  const database = getDatabase();
  if (database.isTransaction) return operation(database);

  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation(database);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

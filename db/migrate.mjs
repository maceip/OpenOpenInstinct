import nextEnv from "@next/env";
import { openDatabase } from "./sqlite.mjs";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const databasePath =
  process.env.DATABASE_PATH || ".data/openopeninstinct.sqlite";
const database = openDatabase(databasePath);
const version = database.prepare("PRAGMA user_version").get()?.user_version;
database.close();

console.log(
  `SQLite database is ready at ${databasePath} (schema v${version}).`
);

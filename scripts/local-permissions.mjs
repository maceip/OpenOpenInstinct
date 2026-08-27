import { chmodSync, lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function secureEnvironmentFiles(root = process.cwd()) {
  if (process.platform === "win32") return;

  for (const name of readdirSync(root)) {
    if (!isEnvironmentFile(name)) continue;
    const path = resolve(root, name);
    const entry = lstatSync(path);
    if (entry.isFile() && !entry.isSymbolicLink()) chmodSync(path, 0o600);
  }
}

function isEnvironmentFile(name) {
  return (
    name === ".env" || (name.startsWith(".env.") && name !== ".env.example")
  );
}

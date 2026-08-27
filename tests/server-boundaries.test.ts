import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

describe("server module boundaries", () => {
  it("keeps server modules out of every client component graph", async () => {
    const files = await sourceFiles(rootPath);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (!/^\s*["']use client["'];/u.test(source)) continue;
      if (/from\s+["'][^"']*lib\/server(?:\/|["'])/u.test(source)) {
        offenders.push(relative(rootPath, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("uses Next's server-only sentinel on Next-exclusive modules", async () => {
    const protectedModules = [
      "auth.ts",
      "lib/server/auth-session.ts",
      "lib/server/manager-store.ts",
      "lib/server/request-scope.ts",
      "lib/server/request-security.ts",
    ];
    const unprotected = (
      await Promise.all(
        protectedModules.map(async (path) => ({
          path,
          source: await readFile(new URL(path, root), "utf8"),
        }))
      )
    )
      .filter(({ source }) => !source.includes('import "server-only";'))
      .map(({ path }) => path);

    expect(unprotected).toEqual([]);
  });
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries
      .filter(
        (entry) => ![".git", ".next", "node_modules"].includes(entry.name)
      )
      .map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return [path];
      })
  );
  return paths.flat().filter((path) => [".ts", ".tsx"].includes(extname(path)));
}

import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const root = new URL("../", import.meta.url);

describe("SQLite schema policy", () => {
  it("uses strict SQLite migrations with explicit ownership constraints", async () => {
    const application = await read("db/migrations/0001_application.sqlite.sql");
    const authentication = await read(
      "db/migrations/0002_device_auth.sqlite.sql"
    );

    expect(application.match(/\) STRICT;/gu)).toHaveLength(7);
    expect(authentication.match(/\) STRICT;/gu)).toHaveLength(5);
    expect(application).toContain(
      "REFERENCES workspace_memberships(workspace_id, user_id) ON DELETE CASCADE"
    );
    expect(authentication).toContain(
      "REFERENCES auth_devices(id) ON DELETE CASCADE"
    );
    expect(authentication).toContain(
      "CREATE UNIQUE INDEX auth_sessions_secret_hash_idx"
    );
  });

  it("runs native migrations and a three-OS CI matrix", async () => {
    const packageManifest = z
      .object({
        dependencies: z.record(z.string(), z.string()),
        devDependencies: z.record(z.string(), z.string()),
        scripts: z.record(z.string(), z.string()),
      })
      .parse(JSON.parse(await read("package.json")));
    const workflow = await read(".github/workflows/checks.yml");
    const turbo = await read("turbo.json");

    expect(packageManifest.scripts["db:migrate"]).toBe("node db/migrate.mjs");
    expect(packageManifest.scripts.build).toContain("pnpm build:eve");
    expect(packageManifest.scripts["self-host:check"]).toBe(
      "node scripts/self-host.mjs --check"
    );
    for (const dependency of [
      "@electric-sql/pglite",
      "@neondatabase/serverless",
      "@vercel/connect",
      "@vercel/queue",
      "@workflow/world-local",
      "@workflow/world-vercel",
      "better-auth",
      "drizzle-kit",
      "drizzle-orm",
      "pg",
      "vercel",
    ]) {
      expect(packageManifest.dependencies).not.toHaveProperty(dependency);
      expect(packageManifest.devDependencies).not.toHaveProperty(dependency);
    }
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("pnpm db:migrate");
    expect(workflow).toContain("pnpm build");
    expect(turbo.toLowerCase()).not.toContain("vercel");
    expect(turbo).not.toContain("DATABASE_URL");
  });

  it("keeps runtime services free of request-time DDL and removed adapters", async () => {
    const serviceSources = await Promise.all(
      ["browsers", "chats", "scope", "secrets", "sessions", "vault"].map(
        (name) => read(`db/services/${name}.ts`)
      )
    );
    const runtimeSources = await Promise.all([
      read("app/api/tasks/route.ts"),
      read("lib/model-config.ts"),
      read("agent/channels/linq.ts"),
    ]);
    const joined = [...serviceSources, ...runtimeSources].join("\n");

    expect(joined).not.toMatch(/CREATE TABLE|ALTER TABLE/iu);
    expect(joined).not.toMatch(/postgres|neon|world-vercel|AI Gateway/iu);
    expect(runtimeSources[0]).toContain("listLocalTaskHistory");
    expect(runtimeSources[1]).toContain("@ai-sdk/openai");

    await expect(access(new URL("vercel.json", root))).rejects.toThrow(
      "ENOENT"
    );
    await expect(access(new URL("db/drizzle.config.ts", root))).rejects.toThrow(
      "ENOENT"
    );
  });
});

async function read(path: string) {
  return await readFile(new URL(path, root), "utf8");
}

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildPages } from "../scripts/build-pages.mjs";

const testOutputDir = join(process.cwd(), ".data", "test_out_pages");

describe("GitHub Pages generator", () => {
  afterAll(() => {
    rmSync(testOutputDir, { force: true, recursive: true });
  });

  it("builds the static showcase site with OpenOpenInstinct branding and tabs", () => {
    buildPages(testOutputDir);

    expect(existsSync(join(testOutputDir, "index.html"))).toBe(true);
    expect(existsSync(join(testOutputDir, ".nojekyll"))).toBe(true);

    const html = readFileSync(join(testOutputDir, "index.html"), "utf8");

    // Branding & Identity
    expect(html).toContain("OpenOpenInstinct");
    expect(html).toContain("Self-Hosted Personal Agent");

    // Local-first & Auth features
    expect(html).toContain("SQLite");
    expect(html).toContain("WebCrypto");
    expect(html).toContain("AES-256-GCM");
    expect(html).toContain("Kernel");
    expect(html).toContain("Linq");

    // Structural views
    expect(html).toContain("tab-workspace");
    expect(html).toContain("tab-vault");
    expect(html).toContain("tab-tasks");
    expect(html).toContain("tab-chat");
    expect(html).toContain("tab-device-auth");
    expect(html).toContain("tab-deploy");
  });
});

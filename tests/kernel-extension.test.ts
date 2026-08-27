import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("Kernel browser integration", () => {
  it("uses the locally scoped tools without the Vercel extension adapter", () => {
    const manifest = z
      .object({ dependencies: z.record(z.string(), z.string()) })
      .parse(JSON.parse(readFileSync("package.json", "utf8")));
    expect(manifest.dependencies).not.toHaveProperty("@onkernel/eve-extension");
    expect(readFileSync("lib/server/kernel-browser.ts", "utf8")).toContain(
      "requireOwnedBrowserSession"
    );
  });

  it("keeps executor selection out of model instructions", () => {
    const instructions = [
      readFileSync("agent/instructions.md", "utf8"),
      readFileSync("agent/skills/browser-execution/SKILL.md", "utf8"),
    ].join("\n");
    expect(instructions).not.toMatch(
      /cloud browser|local browser|browser mode|browser executor|kernel__browser/i
    );
  });
});

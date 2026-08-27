import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("chat navigation continuity", () => {
  it("uses /chat canonically while redirecting legacy /s links", async () => {
    const [legacyIndex, legacySession, sourceFiles] = await Promise.all([
      read("app/s/page.tsx"),
      read("app/s/[sessionId]/page.tsx"),
      Promise.all(
        [
          "app/_components/agent-chat.tsx",
          "app/_components/browser-run-table.tsx",
          "app/_components/global-task-history.tsx",
          "app/_components/manager-shell.tsx",
          "app/chats/page.tsx",
        ].map(read)
      ),
    ]);

    expect(legacyIndex).toContain('redirect("/chat")');
    expect(legacySession).toContain(
      "redirect(`/chat/${encodeURIComponent(sessionId)}`)"
    );
    expect(sourceFiles.join("\n")).not.toMatch(/["'`]\/s(?:\/|["'`])/u);
  });
});

async function read(path: string) {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

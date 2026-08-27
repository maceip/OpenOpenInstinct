import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("stream continuity", () => {
  it("pipes the Eve stream without proxy buffering", async () => {
    const payload = new TextEncoder().encode('{"type":"session.waiting"}\n');
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(payload);
                controller.close();
              },
            }),
            {
              headers: {
                "Content-Length": String(payload.byteLength),
                "Content-Type": "application/x-ndjson",
              },
            }
          )
        )
      )
    );
    const { GET } = await import("../app/eve/v1/[...path]/route");
    const response = await GET(
      new Request("https://assistant.example.com/eve/v1/session/test/stream"),
      { params: Promise.resolve({ path: ["session", "test", "stream"] }) }
    );

    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("cache-control")).toBe(
      "no-cache, no-store, no-transform"
    );
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(payload);
  });

  it("resumes durable chat sessions after network and wake events", async () => {
    const source = await readFile(
      new URL("../app/_components/agent-chat.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('window.addEventListener("online"');
    expect(source).toContain('document.addEventListener("visibilitychange"');
    expect(source).toContain("agentRef.current.resume()");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requiredEnvironment = {
  AI_MODEL: "gpt-5-mini",
  AUTH_INSTANCE_ID: "test-instance-000000000000",
  DATABASE_PATH: ":memory:",
  KERNEL_API_KEY: "test-kernel-key",
  LINQ_API_KEY: "test-linq-key",
  LINQ_WEBHOOK_SECRET: "test-linq-webhook-secret",
  PUBLIC_URL: "https://assistant.example.com",
  VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

describe("environment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const [name, value] of Object.entries(requiredEnvironment)) {
      vi.stubEnv(name, value);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("exports the validated self-host environment", async () => {
    const { env } = await import("../lib/env");

    expect(env).toMatchObject(requiredEnvironment);
    expect(env.AI_PROVIDER).toBe("openai");
    expect(env.AUTH_SESSION_TTL_DAYS).toBe(30);
    expect(env.DATABASE_PATH).toBe(":memory:");
  });

  it.each([
    requiredEnvironment.VAULT_ENCRYPTION_KEY.slice(0, -1),
    Buffer.alloc(32, 255).toString("base64url"),
  ])("accepts a Node-compatible 32-byte encryption key", async (key) => {
    vi.stubEnv("VAULT_ENCRYPTION_KEY", key);

    const { env } = await import("../lib/env");
    expect(env.VAULT_ENCRYPTION_KEY).toBe(key);
  });

  it.each([
    "AI_MODEL",
    "AUTH_INSTANCE_ID",
    "KERNEL_API_KEY",
    "LINQ_API_KEY",
    "LINQ_WEBHOOK_SECRET",
    "PUBLIC_URL",
  ])("rejects a missing required %s value", async (name) => {
    vi.stubEnv(name, "");

    await expect(import("../lib/env")).rejects.toThrow(
      "Invalid environment variables"
    );
  });

  it("requires a persistent vault encryption key", async () => {
    vi.stubEnv("VAULT_ENCRYPTION_KEY", "");
    vi.stubEnv("SECRET_ENCRYPTION_KEY", "");

    await expect(import("../lib/env")).rejects.toThrow(
      "VAULT_ENCRYPTION_KEY is required"
    );
  });

  it("accepts the legacy encryption-key name without rotating vault data", async () => {
    const key = Buffer.alloc(32, 9).toString("base64");
    vi.stubEnv("VAULT_ENCRYPTION_KEY", "");
    vi.stubEnv("SECRET_ENCRYPTION_KEY", key);

    const { env } = await import("../lib/env");
    expect(env.VAULT_ENCRYPTION_KEY).toBe(key);
  });

  it("requires a stable HTTPS origin outside loopback", async () => {
    vi.stubEnv("PUBLIC_URL", "http://assistant.example.com");
    await expect(import("../lib/env")).rejects.toThrow(
      "Invalid environment variables"
    );

    vi.resetModules();
    vi.stubEnv("PUBLIC_URL", "http://127.0.0.1:3000");
    const { env, isLoopbackPublicUrl } = await import("../lib/env");
    expect(env.PUBLIC_URL).toBe("http://127.0.0.1:3000");
    expect(isLoopbackPublicUrl()).toBe(true);
  });

  it("rejects paths, queries, and fragments in PUBLIC_URL", async () => {
    for (const value of [
      "https://assistant.example.com/path",
      "https://assistant.example.com?query=1",
      "https://assistant.example.com#fragment",
    ]) {
      vi.resetModules();
      vi.stubEnv("PUBLIC_URL", value);
      await expect(import("../lib/env")).rejects.toThrow(
        "Invalid environment variables"
      );
    }
  });
});

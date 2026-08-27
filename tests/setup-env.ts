import { vi } from "vitest";

const testEnvironment = {
  AI_MODEL: "gpt-5-mini",
  AI_PROVIDER: "openai",
  AUTH_INSTANCE_ID: "test-instance-000000000000",
  DATABASE_PATH: ":memory:",
  KERNEL_API_KEY: "test-kernel-key",
  LINQ_API_KEY: "test-linq-key",
  LINQ_WEBHOOK_SECRET: "test-linq-webhook-secret",
  OPENAI_API_KEY: "test-openai-key",
  PUBLIC_URL: "https://assistant.example.com",
  VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

for (const [name, value] of Object.entries(testEnvironment)) {
  vi.stubEnv(name, value);
}

vi.mock("server-only", () => ({}));

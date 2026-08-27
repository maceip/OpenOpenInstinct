import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { isE164PhoneNumber } from "./phone-number";

const optionalValue = z
  .string()
  .transform((value) => (value.trim().length === 0 ? undefined : value))
  .optional();

const requiredValue = z
  .string()
  .refine((value) => value.trim().length > 0, "Required");

const publicUrlSchema = requiredValue.superRefine((value, context) => {
  if (!URL.canParse(value)) {
    context.addIssue({ code: "custom", message: "Must be an absolute URL" });
    return;
  }

  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    url.hostname
  );
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    context.addIssue({
      code: "custom",
      message: "Must use HTTPS (HTTP is allowed only on loopback)",
    });
  }
  if (url.origin !== value.replace(/\/$/u, "")) {
    context.addIssue({
      code: "custom",
      message: "Must contain only an origin, without a path, query, or fragment",
    });
  }
});

const optionalUrl = optionalValue.refine(
  (value) => value === undefined || URL.canParse(value),
  "Must be an absolute URL"
);

const optionalPhoneNumber = optionalValue.refine(
  (value) => value === undefined || isE164PhoneNumber(value),
  "Must be an E.164 phone number"
);

const runtimeEnv = createEnv({
  server: {
    AI_API_KEY: optionalValue,
    AI_BASE_URL: optionalUrl,
    AI_MODEL: requiredValue,
    AI_MODEL_CONTEXT_WINDOW: z.coerce.number().int().positive().optional(),
    AI_PROVIDER: z
      .enum(["anthropic", "google", "openai", "openai-compatible"])
      .default("openai"),
    AI_PROVIDER_NAME: optionalValue,
    ANTHROPIC_API_KEY: optionalValue,
    AUTH_INSTANCE_ID: requiredValue.refine(
      (value) => /^[A-Za-z0-9_-]{16,128}$/u.test(value),
      "AUTH_INSTANCE_ID must be a 16-128 character base64url identifier"
    ),
    AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    BROWSER_BENCH_LABEL: z.string().min(1).optional(),
    BROWSER_BENCH_REPETITIONS: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(1),
    DATABASE_PATH: z.string().min(1).default(".data/openopeninstinct.sqlite"),
    EVE_NEXT_PRODUCTION_ORIGIN: optionalValue.refine(
      (value) => value === undefined || URL.canParse(value),
      "EVE_NEXT_PRODUCTION_ORIGIN must be an absolute URL"
    ),
    GOOGLE_GENERATIVE_AI_API_KEY: optionalValue,
    KERNEL_API_KEY: requiredValue,
    LINQ_API_KEY: requiredValue,
    LINQ_PHONE_NUMBER: optionalPhoneNumber,
    LINQ_WEBHOOK_SECRET: requiredValue,
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("production"),
    OPENAI_API_KEY: optionalValue,
    OWNER_PHONE_NUMBER: optionalPhoneNumber,
    PUBLIC_URL: publicUrlSchema,
    SECRET_ENCRYPTION_KEY: requiredValue,
  },
  experimental__runtimeEnv: {},
});

if (Buffer.from(runtimeEnv.SECRET_ENCRYPTION_KEY, "base64").length !== 32) {
  throw new Error(
    "SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key."
  );
}

export const env = runtimeEnv;

export function isLoopbackPublicUrl(value = env.PUBLIC_URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(value).hostname
  );
}

import { env } from "@/lib/env";

const LINQ_MESSAGES_URL = "https://api.linqapp.com/api/partner/v3/messages";

export async function sendLinqText({
  idempotencyKey,
  message,
  to,
}: {
  readonly idempotencyKey: string;
  readonly message: string;
  readonly to: string;
}) {
  const response = await fetch(LINQ_MESSAGES_URL, {
    body: JSON.stringify({
      message: { parts: [{ type: "text", value: message }] },
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${env.LINQ_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Linq message delivery failed with HTTP ${String(response.status)}.`
    );
  }
}

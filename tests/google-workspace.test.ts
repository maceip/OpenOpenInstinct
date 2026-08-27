import { beforeEach, describe, expect, it } from "vitest";
import { parseCalendarAvailability } from "@/agent/lib/google-workspace/calendar";
import { gmailUpdateLabels } from "@/agent/lib/google-workspace/gmail";
import { googleWorkspaceWriteApproval } from "@/agent/tools/google_workspace_write";
import { getDatabase } from "@/db";
import {
  GOOGLE_WORKSPACE_SCOPES,
  googleWorkspaceRedirectUri,
} from "@/lib/google-workspace/config";
import {
  completeGoogleWorkspaceAuthorization,
  getGoogleWorkspaceAccessToken,
  getGoogleWorkspaceConnection,
  startGoogleWorkspaceAuthorization,
} from "@/lib/runtime/google-workspace";

const scope = {
  userId: "device-auth:test-google-user",
  workspaceId: "personal:test-google-workspace",
};

beforeEach(() => {
  getDatabase()
    .prepare("DELETE FROM workspaces WHERE id = ?")
    .run(scope.workspaceId);
});

describe("self-hosted Google Workspace connection", () => {
  it("uses a least-privilege scope set and the stable public callback", () => {
    expect(GOOGLE_WORKSPACE_SCOPES).not.toContain("*");
    expect(GOOGLE_WORKSPACE_SCOPES).not.toContain("https://mail.google.com/");
    expect(googleWorkspaceRedirectUri()).toBe(
      "https://assistant.example.com/api/connectors/google"
    );
  });

  it("binds a one-use OAuth state to the workspace and encrypts tokens", async () => {
    const authorization = new URL(
      await startGoogleWorkspaceAuthorization(scope)
    );
    const state = authorization.searchParams.get("state");
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([
      ...GOOGLE_WORKSPACE_SCOPES,
    ]);
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      googleWorkspaceRedirectUri()
    );

    const requests: {
      authorization: string | null;
      body?: string;
      url: string;
    }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      requests.push({
        authorization: new Headers(init?.headers).get("authorization"),
        body:
          init?.body instanceof URLSearchParams
            ? init.body.toString()
            : typeof init?.body === "string"
              ? init.body
              : undefined,
        url,
      });
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({
          access_token: "google-access-token",
          expires_in: 3_600,
          refresh_token: "google-refresh-token",
          scope: GOOGLE_WORKSPACE_SCOPES.join(" "),
          token_type: "Bearer",
        });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        return Response.json({ email: "person@example.com" });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    await completeGoogleWorkspaceAuthorization(
      scope,
      { code: "one-use-code", state: state ?? "" },
      fetcher
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]?.body).toContain("client_secret=");
    expect(requests[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(requests[1]?.authorization).toBe("Bearer google-access-token");
    expect(requests[1]?.url).toBe(
      "https://openidconnect.googleapis.com/v1/userinfo"
    );
    await expect(getGoogleWorkspaceConnection(scope)).resolves.toEqual({
      accountLabel: "person@example.com",
      state: "connected",
    });
    await expect(getGoogleWorkspaceAccessToken(scope)).resolves.toBe(
      "google-access-token"
    );

    const row = getDatabase()
      .prepare(
        `SELECT encrypted_value AS encryptedValue
         FROM encrypted_secrets
         WHERE workspace_id = ? AND namespace = 'google-oauth' AND id = 'connection'`
      )
      .get(scope.workspaceId);
    expect(row?.encryptedValue).not.toContain("google-access-token");
    expect(row?.encryptedValue).not.toContain("google-refresh-token");

    await expect(
      completeGoogleWorkspaceAuthorization(
        scope,
        { code: "replayed-code", state: state ?? "" },
        fetcher
      )
    ).rejects.toThrow(/invalid or expired/u);
  });

  it("maps safe Gmail changes and requires approval for consequential writes", () => {
    expect(gmailUpdateLabels("archive")).toEqual({
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    });
    expect(gmailUpdateLabels("mark_unread")).toEqual({
      addLabelIds: ["UNREAD"],
      removeLabelIds: [],
    });
    expect(googleWorkspaceWriteApproval("update_email")).toBe("not-applicable");
    expect(googleWorkspaceWriteApproval("send_email")).toBe("user-approval");
    expect(googleWorkspaceWriteApproval("create_calendar_event")).toBe(
      "user-approval"
    );
  });

  it("does not interpret Google FreeBusy errors as availability", () => {
    expect(() =>
      parseCalendarAvailability({
        calendars: {
          "missing@example.com": {
            errors: [{ domain: "global", reason: "notFound" }],
          },
        },
      })
    ).toThrow(/missing@example\.com: notFound/u);
  });
});

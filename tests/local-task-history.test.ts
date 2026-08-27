import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidTaskHistoryCursorError,
  listLocalTaskHistory,
} from "../lib/server/local-task-history";

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), "openopeninstinct-history-"));
  await mkdir(join(dataDirectory, "runs"));
});

afterEach(async () => {
  await rm(dataDirectory, { force: true, recursive: true });
  vi.restoreAllMocks();
});

describe("local task history", () => {
  it("paginates only owned Eve sessions with a stable cursor", async () => {
    await Promise.all([
      writeRun("wrun_owned_new", "2026-08-25T20:00:03.000Z"),
      writeRun("wrun_foreign", "2026-08-25T20:00:02.000Z"),
      writeRun("wrun_owned_old", "2026-08-25T20:00:01.000Z"),
    ]);

    const first = await listLocalTaskHistory({
      dataDirectory,
      limit: 1,
      ownedSessionIds: new Set(["wrun_owned_new", "wrun_owned_old"]),
    });
    expect(first.runs.map((run) => run.sessionId)).toEqual(["wrun_owned_new"]);
    expect(first).toMatchObject({ hasMore: true });

    const second = await listLocalTaskHistory({
      cursor: first.cursor ?? undefined,
      dataDirectory,
      limit: 1,
      ownedSessionIds: new Set(["wrun_owned_new", "wrun_owned_old"]),
    });
    expect(second.runs.map((run) => run.sessionId)).toEqual(["wrun_owned_old"]);
    expect(second.hasMore).toBe(false);
  });

  it("skips malformed, tagged, and mismatched run files", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await Promise.all([
      writeRun("wrun_valid", "2026-08-25T20:00:03.000Z"),
      writeRun("wrun_tagged", "2026-08-25T20:00:02.000Z", {
        fileName: "wrun_tagged.vitest-0.json",
      }),
      writeRun("wrun_other", "2026-08-25T20:00:01.000Z", {
        fileName: "wrun_mismatch.json",
      }),
      writeFile(join(dataDirectory, "runs", "wrun_broken.json"), "{"),
    ]);

    const page = await listLocalTaskHistory({
      dataDirectory,
      ownedSessionIds: new Set(["wrun_valid", "wrun_tagged", "wrun_other"]),
    });
    expect(page.runs.map((run) => run.sessionId)).toEqual(["wrun_valid"]);
  });

  it("rejects an untrusted cursor instead of using it as a path", async () => {
    await expect(
      listLocalTaskHistory({
        cursor: "../../secrets",
        dataDirectory,
        ownedSessionIds: new Set(),
      })
    ).rejects.toBeInstanceOf(InvalidTaskHistoryCursorError);
  });
});

async function writeRun(
  runId: string,
  createdAt: string,
  options: { readonly fileName?: string } = {}
) {
  await writeFile(
    join(dataDirectory, "runs", options.fileName ?? `${runId}.json`),
    JSON.stringify({
      attributes: {
        "$eve.title": `Task ${runId}`,
        "$eve.type": "session",
      },
      createdAt,
      runId,
      status: "completed",
      updatedAt: createdAt,
      workflowName: "workflow//eve//workflowEntry",
    })
  );
}

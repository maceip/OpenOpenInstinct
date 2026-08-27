import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";

const workflowName = "workflow//eve//workflowEntry";
const runFileName = /^(wrun_[A-Za-z0-9_-]+)\.json$/u;
const runStatusSchema = z.enum([
  "cancelled",
  "completed",
  "failed",
  "pending",
  "running",
]);
const localRunSchema = z.object({
  attributes: z.record(z.string(), z.string()),
  createdAt: z.coerce.date(),
  runId: z.string().regex(/^wrun_[A-Za-z0-9_-]+$/u),
  status: runStatusSchema,
  updatedAt: z.coerce.date(),
  workflowName: z.string(),
});

type LocalRun = z.infer<typeof localRunSchema>;

export class InvalidTaskHistoryCursorError extends Error {}

export interface LocalTaskHistoryPage {
  readonly cursor: string | null;
  readonly hasMore: boolean;
  readonly runs: readonly {
    readonly createdAt: string;
    readonly prompt: string;
    readonly sessionId: string;
    readonly status: z.infer<typeof runStatusSchema>;
    readonly updatedAt: string;
  }[];
}

export async function listLocalTaskHistory({
  cursor,
  dataDirectory = resolve(process.cwd(), ".eve", ".workflow-data"),
  limit = 25,
  maxScan = 250,
  ownedSessionIds,
}: {
  readonly cursor?: string;
  readonly dataDirectory?: string;
  readonly limit?: number;
  readonly maxScan?: number;
  readonly ownedSessionIds: ReadonlySet<string>;
}): Promise<LocalTaskHistoryPage> {
  const parsedCursor = parseCursor(cursor);
  const runs = (await readRuns(resolve(dataDirectory, "runs")))
    .filter(
      (run) =>
        run.workflowName === workflowName &&
        run.attributes["$eve.type"] === "session" &&
        isAfterCursor(run, parsedCursor)
    )
    .toSorted(compareRunsDescending);

  const selected: LocalRun[] = [];
  let scanned = 0;
  for (const run of runs) {
    scanned += 1;
    if (ownedSessionIds.has(run.runId)) selected.push(run);
    if (selected.length === limit || scanned === maxScan) break;
  }

  const lastScanned = scanned > 0 ? runs[scanned - 1] : undefined;
  return {
    cursor: lastScanned ? createCursor(lastScanned) : null,
    hasMore: scanned < runs.length,
    runs: selected.map((run) => ({
      createdAt: run.createdAt.toISOString(),
      prompt: run.attributes["$eve.title"] ?? "Untitled task",
      sessionId: run.runId,
      status: run.status,
      updatedAt: run.updatedAt.toISOString(),
    })),
  };
}

async function readRuns(directory: string): Promise<LocalRun[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }

  const runs = await Promise.all(
    entries.map(async (entry): Promise<LocalRun | undefined> => {
      const match = entry.isFile() ? runFileName.exec(entry.name) : null;
      if (!match) return undefined;
      try {
        const parsed = localRunSchema.safeParse(
          JSON.parse(await readFile(join(directory, entry.name), "utf8"))
        );
        if (!parsed.success || parsed.data.runId !== match[1]) {
          console.warn(`Skipping malformed workflow run file: ${entry.name}`);
          return undefined;
        }
        return parsed.data;
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.warn(`Skipping malformed workflow run file: ${entry.name}`);
          return undefined;
        }
        if (isNodeError(error) && error.code === "ENOENT") return undefined;
        throw error;
      }
    })
  );
  return runs.filter((run): run is LocalRun => run !== undefined);
}

function compareRunsDescending(left: LocalRun, right: LocalRun) {
  const time = right.createdAt.getTime() - left.createdAt.getTime();
  return time === 0 ? right.runId.localeCompare(left.runId) : time;
}

function createCursor(run: LocalRun) {
  return `${run.createdAt.toISOString()}|${run.runId}`;
}

function parseCursor(cursor: string | undefined) {
  if (cursor === undefined) return undefined;
  if (cursor.length > 160) throw new InvalidTaskHistoryCursorError();
  const separator = cursor.indexOf("|");
  if (separator < 1 || separator !== cursor.lastIndexOf("|")) {
    throw new InvalidTaskHistoryCursorError();
  }
  const timestamp = new Date(cursor.slice(0, separator));
  const runId = cursor.slice(separator + 1);
  if (
    !Number.isFinite(timestamp.getTime()) ||
    !/^wrun_[A-Za-z0-9_-]+$/u.test(runId)
  ) {
    throw new InvalidTaskHistoryCursorError();
  }
  return { runId, timestamp };
}

function isAfterCursor(run: LocalRun, cursor: ReturnType<typeof parseCursor>) {
  if (!cursor) return true;
  const time = run.createdAt.getTime();
  const cursorTime = cursor.timestamp.getTime();
  return time < cursorTime || (time === cursorTime && run.runId < cursor.runId);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

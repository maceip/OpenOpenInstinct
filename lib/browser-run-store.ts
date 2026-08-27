import { z } from "zod";

const browserRunTaskSchema = z.object({
  completedAt: z.number().nonnegative().optional(),
  costComplete: z.boolean(),
  costUsd: z.number().nonnegative().nullable(),
  durationMs: z.number().nonnegative(),
  id: z.string(),
  prompt: z.string().min(1),
  sessionId: z.string().optional(),
  startedAt: z.number().nonnegative().optional(),
  status: z.enum(["queued", "running", "success", "failure", "interrupted"]),
  terminalMessage: z.string().optional(),
});

const browserRunGroupSchema = z.object({
  concurrency: z.number().int().min(1).max(8),
  createdAt: z.string(),
  id: z.string(),
  name: z.string().min(1),
  tasks: z.array(browserRunTaskSchema),
  updatedAt: z.string(),
});

const browserRunStoreSchema = z.object({
  groups: z.array(browserRunGroupSchema),
  version: z.literal(1),
});

const workspaceDocumentSchema = z.object({
  body: z.object({
    dataset: z.object({ workspaceId: z.string().optional() }),
  }),
});

export type BrowserRunGroup = z.infer<typeof browserRunGroupSchema>;
export type BrowserRunTask = z.infer<typeof browserRunTaskSchema>;
export type BrowserRunTaskUpdate = Partial<
  Omit<BrowserRunTask, "id" | "prompt">
>;

export const browserRunStoreEvent = "eve-browser-runs-changed";
const browserRunStaleAfterMs = 20 * 60_000;

export function readBrowserRunGroups() {
  const serialized = window.localStorage.getItem(workspaceBrowserRunStoreKey());
  if (!serialized) return [];

  try {
    const parsed = browserRunStoreSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success) return [];
    const recovered = recoverInterruptedBrowserRuns(parsed.data.groups);
    if (recovered !== parsed.data.groups) writeBrowserRunGroups(recovered);
    return recovered;
  } catch {
    return [];
  }
}

export function recoverInterruptedBrowserRuns(
  groups: readonly BrowserRunGroup[],
  now = Date.now()
) {
  const recovered = groups.map((group) => {
    const tasks = group.tasks.map((task) => {
      if (
        task.status !== "running" ||
        task.startedAt === undefined ||
        now - task.startedAt < browserRunStaleAfterMs
      ) {
        return task;
      }
      return {
        ...task,
        completedAt: now,
        durationMs: Math.max(task.durationMs, now - task.startedAt),
        status: "interrupted" as const,
        terminalMessage:
          "The connection was interrupted before completion. Open the session to inspect or continue it.",
      };
    });
    const groupChanged = tasks.some(
      (task, index) => task !== group.tasks[index]
    );
    return groupChanged
      ? { ...group, tasks, updatedAt: new Date(now).toISOString() }
      : group;
  });
  const changed = recovered.some((group, index) => group !== groups[index]);
  return changed ? recovered : groups;
}

export function createBrowserRunGroup({
  concurrency,
  name,
  prompts,
}: {
  readonly concurrency: number;
  readonly name: string;
  readonly prompts: readonly string[];
}): BrowserRunGroup {
  const now = new Date().toISOString();

  return {
    concurrency,
    createdAt: now,
    id: crypto.randomUUID(),
    name: name.trim(),
    tasks: prompts.map((prompt) => ({
      costComplete: false,
      costUsd: null,
      durationMs: 0,
      id: crypto.randomUUID(),
      prompt,
      status: "queued",
    })),
    updatedAt: now,
  };
}

export function saveBrowserRunGroup(group: BrowserRunGroup) {
  const groups = readBrowserRunGroups();
  const existingIndex = groups.findIndex(
    (candidate) => candidate.id === group.id
  );
  const nextGroups = [...groups];

  if (existingIndex === -1) {
    nextGroups.unshift(group);
  } else {
    nextGroups[existingIndex] = group;
  }

  writeBrowserRunGroups(nextGroups);
}

export function updateBrowserRunTask(
  groupId: string,
  taskId: string,
  update: BrowserRunTaskUpdate
) {
  const groups = readBrowserRunGroups();
  const groupIndex = groups.findIndex((group) => group.id === groupId);
  if (groupIndex === -1) return;

  const group = groups[groupIndex];
  if (!group) return;
  const taskIndex = group.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) return;
  const task = group.tasks[taskIndex];
  if (!task) return;

  const updatedAt = new Date().toISOString();
  const tasks = [...group.tasks];
  tasks[taskIndex] = { ...task, ...update };
  const nextGroups = [...groups];
  nextGroups[groupIndex] = { ...group, tasks, updatedAt };
  writeBrowserRunGroups(nextGroups);
}

function writeBrowserRunGroups(groups: readonly BrowserRunGroup[]) {
  window.localStorage.setItem(
    workspaceBrowserRunStoreKey(),
    JSON.stringify({ groups, version: 1 })
  );
  window.dispatchEvent(new Event(browserRunStoreEvent));
}

export function browserRunStoreKeyForWorkspace(workspaceId: string) {
  return `local-vault-assistant:browser-runs:v2:${workspaceId}`;
}

function workspaceBrowserRunStoreKey() {
  return browserRunStoreKeyForWorkspace(currentWorkspaceId());
}

function currentWorkspaceId() {
  const parsed = workspaceDocumentSchema.safeParse(window.document);
  return parsed.success
    ? (parsed.data.body.dataset.workspaceId ?? "anonymous")
    : "anonymous";
}

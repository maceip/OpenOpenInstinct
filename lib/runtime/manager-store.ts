import { randomUUID } from "node:crypto";
import { ensureScope } from "@/db/services/scope";
import {
  createVaultItem as insertVaultItem,
  deleteVaultItem,
} from "@/db/services/vault";
import type { AccessScope } from "../access-scope";
import { env } from "../env";
import type { ManagerMutation } from "../manager";
import { getModelSettings } from "../model-config";
import { getGoogleWorkspaceConnection } from "./google-workspace";
import { readManagerVaultItems } from "./manager-vault";
import {
  deleteSecret,
  secretStoreStatus,
  writeSecret,
} from "../server/secret-store";

export async function readManagerSnapshot(scope: AccessScope) {
  const [googleWorkspace, vaultItems, modelSettings] = await Promise.all([
    getGoogleWorkspaceConnection(scope),
    readManagerVaultItems(scope),
    Promise.resolve(getModelSettings()),
  ]);

  return {
    browser: { available: true },
    channels: { linqPhoneNumber: env.LINQ_PHONE_NUMBER },
    googleWorkspace,
    runtime: {
      inference: modelSettings.modelId,
      provider: modelSettings.provider,
    },
    secretStore: secretStoreStatus(),
    vaultItems,
  };
}

export async function applyManagerMutation(
  scope: AccessScope,
  mutation: ManagerMutation
) {
  await ensureScope(scope);

  switch (mutation.action) {
    case "vault.create":
      await createVaultItem(scope, mutation.input);
      break;
    case "vault.delete":
      await removeVaultItem(scope, mutation.id);
      break;
  }

  return readManagerSnapshot(scope);
}

async function createVaultItem(
  scope: AccessScope,
  input: Extract<ManagerMutation, { action: "vault.create" }>["input"]
) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await writeSecret({ id, namespace: "vault", scope, value: input.secret });

  try {
    await insertVaultItem(scope, {
      account: input.account,
      createdAt: now,
      id,
      kind: input.kind,
      label: input.label,
      updatedAt: now,
    });
  } catch (error) {
    await deleteSecret({ id, namespace: "vault", scope });
    throw error;
  }
}

async function removeVaultItem(scope: AccessScope, id: string) {
  const deleted = await deleteVaultItem(scope, id);
  if (!deleted) return;
  await deleteSecret({ id, namespace: "vault", scope });
}

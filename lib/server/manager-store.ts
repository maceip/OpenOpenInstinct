import { randomUUID } from "node:crypto";
import { ensureScope } from "@/db/services/scope";
import {
  createVaultItem as insertVaultItem,
  deleteVaultItem,
  listVaultItems,
} from "@/db/services/vault";
import type { AccessScope } from "../access-scope";
import { env } from "../env";
import type { ManagerMutation } from "../manager";
import { getModelSettings } from "../model-config";
import {
  deleteSecret,
  hasSecret,
  secretStoreStatus,
  writeSecret,
} from "./secret-store";

export async function readManagerSnapshot(scope: AccessScope) {
  await ensureScope(scope);
  const [vaultRows, modelSettings] = await Promise.all([
    listVaultItems(scope),
    Promise.resolve(getModelSettings()),
  ]);
  const vaultItems = await Promise.all(
    vaultRows.map(async (row) => ({
      ...row,
      hasSecret: await hasSecret({
        id: row.id,
        namespace: "vault",
        scope,
      }),
    }))
  );

  return {
    browser: { available: true },
    channels: { linqPhoneNumber: env.LINQ_PHONE_NUMBER },
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

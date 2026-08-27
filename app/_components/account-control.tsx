"use client";

import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useAuthSession } from "@/lib/auth-client";
import { browserRunStoreKeyForWorkspace } from "@/lib/browser-run-store";

export function AccountControl() {
  const session = useAuthSession();
  if (!session) return null;

  return (
    <div className="flex items-center gap-2 border-t border-sidebar-border px-3 py-3">
      <span className="min-w-0 flex-1 truncate type-label text-muted-foreground">
        {session.device.name}
      </span>
      <Button
        aria-label="Sign out"
        onClick={() => {
          clearWorkspaceBrowserData();
          void signOut().finally(() => {
            window.location.assign("/sign-in");
          });
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <LogOutIcon />
      </Button>
    </div>
  );
}

function clearWorkspaceBrowserData() {
  const workspaceId = document.body.dataset.workspaceId;
  if (!workspaceId) return;
  window.localStorage.removeItem(browserRunStoreKeyForWorkspace(workspaceId));
}

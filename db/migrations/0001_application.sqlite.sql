CREATE TABLE workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE workspace_memberships (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'owner'),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE vault_items (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('login', 'payment', 'address', 'phone', 'identity', 'token')),
  label TEXT NOT NULL,
  account TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE agent_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_memberships(workspace_id, user_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE browser_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_memberships(workspace_id, user_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE chats (
  session_id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_usd REAL CHECK (cost_usd IS NULL OR cost_usd >= 0),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE encrypted_secrets (
  workspace_id TEXT NOT NULL,
  namespace TEXT NOT NULL CHECK (namespace = 'vault'),
  id TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, namespace, id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX agent_sessions_workspace_idx
  ON agent_sessions(workspace_id, created_at DESC);
CREATE INDEX browser_sessions_workspace_idx
  ON browser_sessions(workspace_id, created_at DESC);
CREATE INDEX chats_workspace_updated_idx
  ON chats(workspace_id, updated_at DESC);
CREATE INDEX vault_items_workspace_updated_idx
  ON vault_items(workspace_id, updated_at DESC);

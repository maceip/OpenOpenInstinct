CREATE TABLE encrypted_secrets_next (
  workspace_id TEXT NOT NULL,
  namespace TEXT NOT NULL CHECK (namespace IN ('vault', 'google-oauth')),
  id TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, namespace, id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) STRICT;

INSERT INTO encrypted_secrets_next
  (workspace_id, namespace, id, encrypted_value, updated_at)
SELECT workspace_id, namespace, id, encrypted_value, updated_at
FROM encrypted_secrets;

DROP TABLE encrypted_secrets;
ALTER TABLE encrypted_secrets_next RENAME TO encrypted_secrets;

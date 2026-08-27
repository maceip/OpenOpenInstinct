CREATE TABLE instance_state (
  key TEXT PRIMARY KEY NOT NULL CHECK (key IN ('public_url')),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

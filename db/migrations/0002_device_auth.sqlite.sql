CREATE TABLE auth_principals (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE auth_devices (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  public_key_jwk TEXT NOT NULL,
  key_epoch INTEGER NOT NULL DEFAULT 1 CHECK (key_epoch >= 1),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (principal_id) REFERENCES auth_principals(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (principal_id) REFERENCES auth_principals(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES auth_devices(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  key_epoch INTEGER NOT NULL CHECK (key_epoch >= 1),
  challenge_hash TEXT NOT NULL,
  audience TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (device_id) REFERENCES auth_devices(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE auth_pairings (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  audience TEXT NOT NULL,
  continue_kind TEXT NOT NULL CHECK (continue_kind IN ('messages', 'web')),
  continue_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_by_device_id TEXT,
  FOREIGN KEY (principal_id) REFERENCES auth_principals(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_device_id) REFERENCES auth_devices(id) ON DELETE SET NULL
) STRICT;

CREATE UNIQUE INDEX auth_sessions_secret_hash_idx ON auth_sessions(secret_hash);
CREATE INDEX auth_sessions_device_idx ON auth_sessions(device_id, expires_at);
CREATE INDEX auth_challenges_device_idx ON auth_challenges(device_id, expires_at);
CREATE INDEX auth_pairings_expiry_idx ON auth_pairings(expires_at);

# Local SQLite database

OpenOpenInstinct uses one native SQLite database for application state,
authentication, device enrollment, public-origin continuity, and encrypted vault
records. No external database server or ORM migration service is required.

## Runtime contract

- `sqlite.mjs` resolves `DATABASE_PATH` to an absolute path, creates its parent
  directory, applies durability/security pragmas, and runs pending migrations.
- `index.ts` owns the process-wide `node:sqlite` connection used by services.
- `services/` owns parameterized, workspace-scoped domain queries.
- `migrations/*.sqlite.sql` is the ordered schema history.
- `migrate.mjs` is the explicit operator/CI entry point used by
  `pnpm db:migrate`.

The service launcher runs migrations before it builds or starts the application.
Opening the database also checks the schema version, which keeps direct
development startup safe. A single long-lived host process is the supported
deployment model; serverless filesystems and concurrent cold-start migrations
are not.

## Migrations

Migration filenames begin with a four-digit version:

```text
0001_application.sqlite.sql
0002_device_auth.sqlite.sql
0003_instance_state.sqlite.sql
```

Versions must be contiguous. Each pending file runs inside `BEGIN EXCLUSIVE`;
`PRAGMA user_version` advances only in the same successful transaction.
Migrations must be forward-only and committed with the code that uses them.

To migrate explicitly:

```bash
pnpm db:migrate
```

Do not edit a migration after it has shipped. Add the next numbered SQLite
migration instead.

## Concurrency and durability

Each file-backed connection requires WAL and configures:

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = FULL;
PRAGMA foreign_keys = ON;
PRAGMA trusted_schema = OFF;
PRAGMA secure_delete = ON;
```

WAL permits concurrent readers while serializing the application's small number
of writes. The five-second busy timeout absorbs brief overlap between chat,
browser-session, vault, and authentication updates. `synchronous = FULL`
prioritizes local durability over the marginal write-speed benefit of
`NORMAL`.

Tables are `STRICT`, foreign keys are enabled, ownership relationships cascade
deliberately, and service queries use bound parameters. Application services
must not issue request-time DDL.

## Secrets and permissions

`encrypted_secrets.encrypted_value` contains AES-256-GCM envelopes, not raw
credentials. The authenticated data binds each ciphertext to its workspace,
namespace, and item ID. The encryption key lives in
`VAULT_ENCRYPTION_KEY`, never in SQLite.

On POSIX hosts the process uses a restrictive umask and applies mode `0600` to
the database, WAL/SHM files, and local environment files. Windows deployments
should use a dedicated user profile and private NTFS ACL. These controls do not
isolate data from another process running as the same OS user.

## Backup and restore

For a consistent simple backup:

1. Stop `pnpm self-host`.
2. Copy the configured SQLite file.
3. Copy the environment file separately.
4. Keep an independent backup of `VAULT_ENCRYPTION_KEY`.

Restore all three together before starting the service. If the encryption key is
missing or different, existing vault ciphertext is intentionally
unrecoverable.

The public origin stored in `instance_state` is continuity metadata. If
`PUBLIC_URL` differs on the next healthy startup, the launcher sends a new
one-use Linq pairing link before recording the replacement origin.

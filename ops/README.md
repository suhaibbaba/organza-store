# Operations — the data that cannot be rebuilt

Everything in this repo can be recreated from git. Two things cannot:

| What | Where it lives | Rebuildable? |
|---|---|---|
| The database — orders, products, stock, staff, the audit log | Docker volume `sandbox_db_data`, mounted at `/var/lib/postgresql/data` in the `db` container | **No.** |
| Uploaded product photographs (the WebP sizes `sharp` writes) | Docker volume `sandbox_uploads`, mounted at `/app/uploads` in the `backend` container | **No.** The originals are on somebody's phone, if anywhere. |

Both are named volumes declared at the bottom of `docker-compose.sandbox.yml`.

### There is no production stack in this repo yet

`docker-compose.sandbox.yml` is the only compose file here, and the only deploy workflow is
`deploy-sandbox.yml`. When a production one is written, it inherits all three rules or it
inherits the bug:

1. **A named volume for each of the two**, database and uploads.
2. **`UPLOAD_DIR` set in the compose file's `environment:`, absolute, equal to the mount
   target.** Not in the `.env` on the server — `environment:` overrides `env_file:`, and
   that is what keeps the two from drifting.
3. **Its own volume keys**, distinct from the sandbox's, so the two stacks can never end up
   sharing one database.

The scripts here take `COMPOSE_FILE` and `ENV_FILE`, so they work against it unchanged:

```bash
COMPOSE_FILE=docker-compose.production.yml ENV_FILE=.env.production ./ops/backup.sh
```

## What a volume does and does not protect against

| | Survives? |
|---|---|
| `docker compose up -d --build` (what the deploy runs) | ✅ |
| `docker compose restart` / a container crash | ✅ |
| `docker compose down` then `up` | ✅ |
| Rebuilding the image from scratch, changing the Dockerfile | ✅ |
| `docker image prune` / `docker builder prune` (what the deploy runs for disk space) | ✅ |
| **`docker compose down -v`** | ❌ deletes both volumes |
| **`docker volume rm`** | ❌ |
| **`docker system prune --volumes`** after a `down` | ❌ deletes any volume no container is using |
| **`npm run db:reset`** | ❌ empties the database (it asks first, twice) |
| The VPS's disk failing, or the VPS being lost | ❌ |

The first four rows are why the volumes exist. The last five are why backups exist.
A volume is not a backup: it is on the same disk, in the same machine, one command away.

## What is backed up today

**Nothing is scheduled.** This directory contains the script; running it is still a
decision somebody has to make. As of this commit there is no cron entry, no scheduled
workflow, and no copy of this data anywhere except the VPS's own disk. If that disk dies
this morning, the shop loses every order and every photograph taken since it went live.

To change that, on the VPS:

```bash
cd /opt/organza/sandbox
./ops/backup.sh                     # -> ./backups/organza-sandbox/<timestamp>/
```

and then schedule it (`crontab -e`), nightly at 02:30, keeping 30 days:

```cron
30 2 * * * cd /opt/organza/sandbox && ./ops/backup.sh >> /var/log/organza-backup.log 2>&1
40 2 * * * find /opt/organza/sandbox/backups -mindepth 2 -maxdepth 2 -type d -mtime +30 -exec rm -rf {} +
```

### Off the box

A backup that only exists on the machine it came from survives mistakes, not disks.
Copy the `backups/` directory somewhere else — another host, an external drive, a
storage box — with whatever the shop already has. `rsync` over SSH, from a machine that
pulls rather than one the VPS can push to, is the usual answer:

```bash
rsync -az --delete vps:/opt/organza/sandbox/backups/ /somewhere/else/organza-backups/
```

This is deliberately not wired up here: it needs a destination and credentials that
belong to the shop, not to this repo, and no third-party service is being added
(CLAUDE.md, "Deployment").

## Restoring

```bash
ORGANZA_RESTORE_CONFIRM=I-KNOW-THIS-OVERWRITES-THE-DATABASE \
  ./ops/restore.sh ./backups/organza-sandbox/20260808T221500Z
```

It replaces the database and puts the archived images back. It refuses without the
confirmation phrase typed out in full, for the same reason `db:reset` does.

**Rehearse it on the sandbox before you ever need it in anger.** A backup nobody has
restored is a hope. The check that matters afterwards is not "the command exited 0" —
it is opening the admin, finding a product with a photograph, and seeing the photograph.

## If images stop appearing after a deploy

In order:

1. `curl -s https://api.sandbox.organza-moda.com/health` — `uploadsWritable: false` means
   the API cannot write where it is pointed. That is this problem; carry on.
2. `docker compose -f docker-compose.sandbox.yml logs backend | grep -i uploads` — the API
   prints the absolute directory it is using on every start.
3. That path must be **exactly** the mount target in `docker-compose.sandbox.yml`
   (`/app/uploads`). If it is `/app/backend/uploads`, `UPLOAD_DIR` is being read as a
   relative path and resolved against the container's working directory — the bug this
   directory exists because of. `environment:` in the compose file is what pins it.
4. `docker compose exec backend ls -la /app/uploads` — if the files are there but the app
   cannot write, it is ownership: the container's user must own that directory. The image
   currently runs as root, so this cannot bite today; it starts biting the moment a
   `USER` line is added to `backend/Dockerfile`, and then the fix is `chown` on the mount
   (an entrypoint that does it, or `docker compose exec -u root backend chown -R node /app/uploads`).

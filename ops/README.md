# Operations — the data that cannot be rebuilt

Everything in this repo can be recreated from git. Two things cannot:

| What | Where it lives | Rebuildable? |
|---|---|---|
| The database — orders, products, stock, staff, the audit log | Docker volume `sandbox_db_data`, mounted at `/var/lib/postgresql/data` in the `db` container | **No.** |
| Uploaded product photographs (the WebP sizes `sharp` writes) | Docker volume `sandbox_uploads`, mounted at `/app/uploads` in the `backend` container | **No.** The originals are on somebody's phone, if anywhere. |

Both are named volumes declared at the bottom of `docker-compose.sandbox.yml`.

### Both stacks exist now

`docker-compose.prod.yml` is the live shop (project name `organza-prod`, volumes
`prod_db_data` and `prod_uploads`); `docker-compose.sandbox.yml` is the practice stack
(`organza-sandbox`, `sandbox_db_data`, `sandbox_uploads`). The table above names the
sandbox's volumes; production's are the same two things under the other prefix.

Four rules hold on both, and a third stack would inherit them or inherit the bug:

1. **A named volume for each of the two**, database and uploads.
2. **`UPLOAD_DIR` set in the compose file's `environment:`, absolute, equal to the mount
   target.** Not in the `.env` on the server — `environment:` overrides `env_file:`, and
   that is what keeps the two from drifting.
3. **Its own volume keys**, distinct from the other stack's, so the two can never end up
   sharing one database.
4. **`APP_ENV: production` on the backend, and `NEXT_PUBLIC_APP_ENV: production` as a build
   arg on `admin` and `pos`.** This is the only thing that tells the two stacks apart —
   `NODE_ENV` is `production` on both, which is why `db:reset` used to announce "that is the
   LIVE SHOP" while pointed at the sandbox. It decides which `public/app_icon/<env>/` folder
   the tiles, the tab icon and the launch screen come from, whether the installed app is
   called "Organza Admin" or "Organza Admin (SBX)", whether staff see a SANDBOX chip in the
   top bar, and which mark a password email carries.

   Left unset it means *production* on purpose, so a missed env file cannot label the real
   shop as practice data. `ops/restore.sh` reads it the same way round: it asks the running
   container, and a value it cannot determine counts as production, so a missing env file
   can never be the reason a guard stands down.

Both scripts here take `COMPOSE_FILE` and `ENV_FILE`, so one copy serves both stacks:

```bash
COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production ./ops/backup.sh
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

## What is backed up, and where it goes

Every night, `ops/backup.sh` copies both of those things **off this server** into a
Cloudflare R2 bucket. R2 is S3-compatible, so the script drives it with the ordinary AWS
CLI — run as a pinned container, so nothing is installed on the VPS.

```
s3://organza-production-backups/
  organza-prod/
    database/organza-prod-20260815T023000Z.dump   <- one pg_dump -Fc per night, ~30 kept
    uploads/…                                     <- a mirror of the photographs
  organza-sandbox/
    …                                             <- same shape, its own folder
```

| | How | Why that way |
|---|---|---|
| Database | `pg_dump --clean --if-exists -Fc -Z 9`, run inside the `db` container | `-Fc` is a compressed archive `pg_restore` can be selective about. Inside the container so it uses the stack's own credentials — no password on a command line, and it cannot dump the wrong database. |
| Photographs | `aws s3 sync`, reading the backend container's own `/app/uploads` mount | **Incremental.** Only files whose size or timestamp differ are sent, so the nightly cost is the day's photographs rather than the whole shop. Verified: a re-sync of 27 unchanged images transfers nothing. |

Two deliberate asymmetries:

- **The image mirror is never pruned and never uses `--delete`.** A true mirror would
  faithfully reproduce an accidental deletion, and a photo removed by a mis-tap is
  exactly what somebody comes to a backup for. It accumulates instead; a few MB a month
  is not a storage problem worth creating a data-loss problem to solve.
- **The dumps are pruned to the last 30.** They are whole copies, not deltas, so without
  pruning the bucket grows by one full database every night forever.

### What is NOT backed up

**No `.env` file, and no secret, ever goes into the bucket.** Not `.env.production`, not
`staff.json`, not `BETTER_AUTH_SECRET`, the VAPID keys, the Resend key or the R2 token
itself. An unencrypted secret sitting in object storage is a secret with a second,
unmonitored front door — and the R2 token in particular would then be backing up the
credentials needed to read the backups.

Those are kept **by hand**: in whatever password manager the shop already uses, written
down and stored somewhere physical, or both. They are short, they change rarely, and
they are the one part of a rebuild that a person can retype. Everything else in the
deployment comes back from git plus the bucket.

## Setting it up

Once, in the Cloudflare dashboard:

1. **R2 → Create bucket → `organza-production-backups`.** Keep it private. One bucket
   serves both stacks; they are separated by the folder the script derives from the
   compose project name, so a sandbox backup can never land on the shop's.
2. **R2 → Manage API tokens → Create → Object Read & Write**, scoped **to that bucket
   only**. Not an account-wide token: this key can read every order the shop has ever
   taken.

Then on the VPS, in `.env.production` (and `.env.sandbox`) — the same file the stack
already runs on, so a backup cannot read one stack's credentials while dumping another's:

```bash
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=organza-production-backups
R2_ENDPOINT=            # optional; derived from the account id when empty
```

Prove it works before trusting it:

```bash
cd /opt/organza/production
COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production ./ops/backup.sh
COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production ./ops/restore.sh --list
```

### The schedule

`crontab -e` on the VPS. 02:30 is after the shop closes and before anybody opens the
POS, so the dump is of a quiet database:

```cron
30 2 * * * cd /opt/organza/production && COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production ./ops/backup.sh >> /var/log/organza-backup.log 2>&1
```

That is the whole entry. **Retention needs no second line** — the script prunes both the
bucket (last 30 dumps) and its own local copies (last 3). The old `find … -mtime +30`
line that used to live here is gone; it only ever pruned this disk, which is the one the
backup exists to survive.

Stagger the sandbox by an hour if it is backed up too, so the two runs never compete for
the same CPU:

```cron
30 3 * * * cd /opt/organza/sandbox && ./ops/backup.sh >> /var/log/organza-backup.log 2>&1
```

## When a backup fails — and when it just stops

These are two different failures, and only the first one is loud on its own.

**A run that fails** prints a banner naming the stage that broke, exits non-zero (so cron
mails it), and is reported to Sentry through the API's own error-tracking layer — the
script never imports Sentry itself, it calls `npm run backup:record` inside the backend
container, which also writes the outcome to the `BackupRun` table.

**A schedule that stopped firing** — a cron entry lost in a server move, a host rebuilt
without it — raises nothing at all, because nothing runs to fail. That is the one that
gets discovered during an emergency, so it is watched from the other end:

| Where | What it tells you |
|---|---|
| `npm run backup:status` (backend) | The last success, the last failure, the last five runs. **Exits non-zero when the last success is over 48h old**, so a monitor can use it without parsing anything. `--json` for machines. |
| `GET /health` | `backup: { lastSuccessAt, stale }`, next to `uploadsWritable`. Two fields, no figures from the shop's books. |
| Sentry | The API re-checks the age every 6 hours and files an issue when it goes stale, at most once a day. This is what notices a backup that stopped in March. |
| `backups/last-success.txt` on the VPS | Readable with `cat` when nothing else is up. |

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T backend npm run backup:status
```

## Restoring

**Read this before you need it.** A backup that has never been restored is a hope.

### 0. What have we got?

```bash
cd /opt/organza/production
export COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production
./ops/restore.sh --list
```

Prints every dump in the bucket for this stack, oldest first. Do this first in any
incident: the question is not "restore" but "what have we got, and how old is it".

### 1. Save what is there now

Even when you are sure. **Especially** when you are sure — the most common restore
mistake is restoring the wrong night and having nothing to go back to.

```bash
./ops/backup.sh --local-only          # -> ./backups/<stack>/<timestamp>/db.dump
```

### 2. Rehearse it on the sandbox

This is the step people skip, and it is the whole point. It puts the live shop's dump on
the practice stack, where being wrong costs nothing:

```bash
cd /opt/organza/sandbox
ORGANZA_RESTORE_CONFIRM=I-KNOW-THIS-OVERWRITES-THE-DATABASE \
  COMPOSE_FILE=docker-compose.sandbox.yml ENV_FILE=.env.sandbox \
  ./ops/restore.sh --source-stack organza-prod --from-r2 latest
```

`--source-stack` is what reads another stack's backups; without it a restore reads its
own, which is what putting the shop back needs. Note what this moves: **a dump is
everything**, personal data included — customers' phone numbers, staff addresses and id
numbers, every order and the whole audit trail — onto the less protected of the two
deployments. The script says so before it starts. If what you actually want is the
catalogue and nothing about a person, that is
[`npm run import:prod`](../backend/README.md#importing-the-production-catalogue-into-the-sandbox),
not this.

### 3. Restore production

Two phrases, because it is the live shop. The first is required on every restore
anywhere; the second only when `APP_ENV` is `production` — read from the **running
container**, not from a file, because `docker-compose.prod.yml` sets it in
`environment:` where it overrides `env_file:`. Same shape as `db:reset`:

```bash
cd /opt/organza/production
ORGANZA_ALLOW_PRODUCTION=I-KNOW-THIS-IS-PRODUCTION \
ORGANZA_RESTORE_CONFIRM=I-KNOW-THIS-OVERWRITES-THE-DATABASE \
  COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production \
  ./ops/restore.sh --from-r2 latest
```

A specific night instead of the newest — the timestamp is what `--list`, the log and the
backup's own output all print:

```bash
./ops/restore.sh --from-r2 20260815T023000Z
```

What it does, in order:

1. downloads the dump from R2 (or reads a local backup directory, if you give it one);
2. **opens the dump with `pg_restore --list` before touching the live database** — a
   truncated download is a thing that happens, and finding out after `--clean` has
   dropped every table is finding out in the worst order possible;
3. restores with `-1`, one transaction, so a failure halfway leaves the database exactly
   as it was rather than half replaced;
4. syncs the photographs back into the uploads volume **over** what is there, never
   deleting — a photo uploaded after the backup was taken is somebody's work;
5. restarts the API.

### 4. Check it with your eyes

The check that matters is not that the command exited 0:

- open the admin, find a product **with a photograph, and see the photograph** — not the
  placeholder;
- open the orders list and find the last order you know was taken;
- `curl -s https://api.organza-moda.com/health` → `uploadsWritable: true`.

### If only the images are wrong

The database is fine and the photographs are missing — a lost uploads volume, a bad
mount. Put the images back without touching a single order:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps -q backend
# then, with that container id:
docker run --rm --volumes-from <id> \
  -e AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
  amazon/aws-cli:2.36.24 --endpoint-url "$R2_ENDPOINT" --region auto \
  s3 sync s3://organza-production-backups/organza-prod/uploads/ /app/uploads
```

### Rebuilding on a brand-new server

The bucket plus git is everything except the secrets you kept by hand:

1. clone the repo, write `.env.production` from `backend/.env.example` and the passwords
   you kept safe;
2. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`;
3. `npx prisma migrate deploy` (the restore brings the schema, but a new stack needs the
   migration table straight first);
4. restore, as in step 3 above;
5. check it with your eyes, as in step 4.

## Moving the catalogue from production to the sandbox

`npm run import:prod` (backend) copies the live shop's **products, categories, variants and
photographs** into the sandbox, so the practice stack can be tested against the real
catalogue. It is not a backup and not a restore: it wipes the sandbox's own catalogue first,
takes **nothing** personal (no orders, users, expenses, cash sessions, approvals or audit
history), and leaves the sandbox's staff accounts and settings alone so you can still sign in.

It goes one way only, and cannot be pointed the other way: the target has to declare itself
`sandbox` in `APP_ENV` **and** carry `sandbox` in its own database name, the run has to name
that database out loud, and production is opened on a connection that is read-only at the
server and proven so before a row is read. Full description and the `PRODUCTION_DATABASE_URL`
/ `PRODUCTION_UPLOAD_DIR` setup:
[backend/README.md](../backend/README.md#importing-the-production-catalogue-into-the-sandbox).

Both volumes are involved on the sandbox side — the database and `sandbox_uploads` — so it is
the one routine operation, besides a restore, that changes data a deploy cannot rebuild.

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
   cannot write, it is ownership: the container's user must own that directory.

   This one is live now. The API stopped running as root when the images went multi-stage:
   `backend/Dockerfile` ends with `USER node`, so the process is uid 1000. Docker seeds a
   **new** named volume from the image and carries ownership across, so a volume created
   after that change comes out owned by uid 1000 and is fine. A volume that already held
   photographs is **not** re-seeded — it keeps the root ownership it was created with, and
   the API can read those photographs but not write new ones. `uploadsWritable` goes false
   and the deploy fails on its own check rather than losing anything.

   The deploy hands the volume over once, before starting the stack (see
   `.github/workflows/deploy-sandbox.yml`), guarded on the current owner so a recursive
   chown over every photograph the shop owns does not repeat on every push. To do it by
   hand:

   ```bash
   docker run --rm --user 0:0 -v organza-sandbox_sandbox_uploads:/vol node:20-slim \
     chown -R 1000:1000 /vol
   ```

   The volume name is the compose project name plus the volume key — renaming either
   points this at a different, empty volume, so copy it exactly.

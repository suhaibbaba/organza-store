# Blocked

Items skipped because they need something outside this repo (credentials, hardware, a decision only you can make). Each says what unblocks it.

| Date | Phase | Item | What unblocks it |
| --- | --- | --- | --- |
| 2026-11-16 | 1 | **Nightly catalogue import rehearsal against a copy of production.** The importer and its rehearsal mode are built and tested against a fixture database made from the old Prisma schema; running it on real data needs a restored copy of the production database, which I may not touch. | A restored production dump on a machine you control: `SOURCE_DATABASE_URL=… pnpm --filter @organza/api import:catalogue` (rehearsal, writes nothing) and read the warnings and checks. Copy the `uploads/` folder too; photo file names are kept. |

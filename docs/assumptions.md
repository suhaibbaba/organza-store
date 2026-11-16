# Assumptions

Decisions taken without a direct answer, under the rule "take the bold recommendation or the most reasonable reading". Each entry: date, phase, the choice, and what changes if you pick differently.

| # | Date | Phase | Assumption | If you pick differently |
| --- | --- | --- | --- | --- |
| 1 | 2026-11-16 | 0 | **Location (H2).** On being asked, you answered "in this repo". The rebuild lives on an orphan branch `rebuild` of `suhaibbaba/organza-store` (no shared history with `sandbox`), checked out as a worktree at `../organza-rebuild`. The old code on `sandbox` is never touched. | Moving to a new repository later is a plain `git push` of this branch to the new remote; nothing in the code depends on the repo name. |
| 2 | 2026-11-16 | 0 | **Toolchain versions.** TypeScript 6.0 (typescript-eslint 8 does not yet support TypeScript 7), Node 24, pnpm workspaces, PostgreSQL 17 in Docker for local and test databases. | TypeScript 7 can be adopted once typescript-eslint supports it; no code change expected. |
| 3 | 2026-11-16 | 0 | **Mantine and Safari 15.4.** Current Mantine documents Safari 15.4+ for components and styles. Container queries are only used by `@mantine/schedule` and opt-in props, so that package and those props are not used. Our own CSS avoids container queries and `color-mix()`; a lint script enforces it. | If the phone turns out to be on 15.0–15.3 (H5), Mantine itself is unsupported there; the phone would have to be updated to 15.8 or replaced. |
| 4 | 2026-11-16 | 0 | **Fixed roles (H3):** Admin, Manager, Employee with capabilities declared in code; no permission editor. | An editor would add a role_capability table and a settings screen; the guard already reads capabilities by name, so only the lookup changes. |
| 5 | 2026-11-16 | 0 | **iOS 15 (H4, H5):** supported with fallbacks; phone assumed on 15.4+ and should be updated to 15.8. Push replaced by the in-app activity feed on that device. | See #3. |

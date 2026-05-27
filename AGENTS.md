# Snowy Operations App

Be concise and direct. Do not implement product features while updating repo-memory docs.

## Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build/typecheck: `npm run build`
- Unit tests: `npm test`
- Watch tests: `npm run test:watch`
- Worker dry run: `npm run worker:once`
- Worker loop: `npm run worker:loop`
- Worker setup: `npm run setup:worker`

## Repo conventions

- React + Vite + TypeScript app under `src/`.
- Feature screens live in `src/features/<area>/`; shared domain types/helpers live in `src/domain/`.
- Supabase access is wrapped by feature API files and `src/lib/supabase.ts`.
- The app has demo in-memory data paths when Supabase env vars are absent.
- Keep QueueBuster credentials, Supabase service-role keys, and browser sessions out of frontend code and Git.

## Source of truth

- `origin/dev-skand` is the canonical product branch for current app development and Vercel validation unless the user explicitly says otherwise.
- Start new feature work from a fresh worktree based on `origin/dev-skand`.
- Do not implement or deploy from a checkout that is behind `origin/dev-skand`.
- Before feature work, run `git status --short --branch` and compare `HEAD` with `origin/dev-skand`.
- If a checkout has dirty changes, preserve them on a safety branch or patch before rebasing, resetting, removing a worktree, or switching development to another checkout.
- Use `docs/product-feature-inventory.md` as the product-level feature inventory. Supporting docs may add detail, but they should not contradict it.
- Keep `docs/product-feature-inventory.md` current when adding, removing, or materially changing user-facing workflows.

## Worktree discipline

- Keep one clean primary checkout aligned to `origin/dev-skand` for day-to-day development.
- Use short-lived `codex/<feature>` worktrees for feature work.
- After merging or pushing a feature to `origin/dev-skand`, classify the worktree as merged, obsolete, dirty-local, or active.
- Remove obsolete worktrees only after confirming there are no uncommitted changes or after preserving those changes.
- Do not leave detached dirty worktrees as the only copy of feature work.

## Context discipline

At the start of any implementation, debugging, or refactor task, read `docs/CONTEXT_INDEX.md` first.

Do not scan the full repository by default. Use `docs/CONTEXT_INDEX.md` to identify the smallest relevant file set, then inspect only those files.

Use targeted search only when:
- the context index is missing or stale;
- the task spans multiple modules;
- the first relevant files do not explain the behavior.

Before non-trivial edits, state:
1. files/directories you will inspect;
2. files you expect to edit;
3. whether repo-memory docs may need updating.

After implementation, update only the affected repo-memory docs if the change affects:
- architecture;
- database schema;
- routes or API contracts;
- feature boundaries;
- core workflows;
- build/test/deploy commands.

Do not update docs for purely local bug fixes unless the existing docs become inaccurate.

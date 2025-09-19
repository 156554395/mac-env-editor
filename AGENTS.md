# Repository Guidelines

## Project Structure & Module Organization
- `src/main/` – Electron main process and `preload` bridge.
- `src/renderer/` – Vue 3 (Vite) renderer UI.
  - Entry: `src/renderer/src/main.ts`, root `App.vue`.
  - Utilities: `src/renderer/utils/` (config/env/security managers).
- `src/types/` – Shared TypeScript types.
- `dist/` – Compiled main output; `release/` – packaged builds.
- Tests live in `test/` (Vitest) and may include UI assets under `docs/`.

## Build, Test, and Development Commands
- `pnpm dev` – Run Electron main + Vite renderer in watch mode.
- `pnpm build` – Type-check, build renderer, and package app.
- `pnpm build:main` / `pnpm build:renderer` – Build each side.
- `pnpm typecheck` – Strict TS checks via `vue-tsc`.
- `pnpm lint` / `pnpm lint:check` – ESLint with/without `--fix`.
- `pnpm format` / `pnpm format:check` – Prettier write/check.
- `pnpm test` / `pnpm test:run` – Run unit tests; `:coverage` adds coverage.

## Coding Style & Naming Conventions
- TypeScript + Vue SFCs, 2-space indentation.
- Components: `PascalCase.vue`; utilities: `camelCase.ts`.
- Use path aliases where configured; prefer explicit imports.
- Tooling: ESLint (v9), Prettier (v3). Keep CI green: `pnpm typecheck && pnpm lint && pnpm test:run`.

## Testing Guidelines
- Framework: Vitest (+ jsdom where needed), coverage via V8.
- Place specs under `test/**` with `*.spec.ts` or `*.test.ts`.
- Target ≥80% lines for new/changed code; add tests for `utils/`.
- Run locally: `pnpm test:run` or interactive `pnpm test:ui`.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `style:`, `config:`), mirroring repo history.
- PRs should include:
  - Clear description and linked issue (e.g., `Closes #123`).
  - Screenshots/GIFs for UI changes.
  - Checklist: `pnpm typecheck`, `pnpm lint:check`, `pnpm test:coverage` pass.
- Keep scope focused; avoid unrelated refactors.

## Security & Configuration Tips
- Always create backups before editing shell profiles (`~/.zshrc`, `~/.bash_profile`, etc.). Use helpers in `src/renderer/utils/`.
- Avoid `sudo` in app flows; operate at user scope.
- Validate environment keys (`[A-Z_][A-Z0-9_]*`) and prefer non-destructive appends.

## Agent-Specific Instructions
- Make minimal, localized patches; respect separation between `main` and `renderer`.
- Update docs and scripts when structure or commands change.

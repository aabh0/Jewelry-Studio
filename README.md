# Jewelry Studio

Local, single-user studio app for producing jewelry campaign visuals (stills and short videos) on top of the Higgsfield Cloud API, the Higgsfield CLI, and the Anthropic Claude API. Everything (database, media, exports) lives on your disk.

`PLAN.md` is the approved build spec; `docs/progress/` records what each milestone delivered and where it deviated.

## Requirements
- Node 22.12+ (24 recommended) and pnpm 10 (`corepack enable`).
- macOS (Apple silicon) or Windows. ffmpeg/ffprobe ship with the app (`ffmpeg-static`); set `FFMPEG_PATH` to use your own.
- Keys: Higgsfield Cloud API key + secret (required for generation), Anthropic API key (director, QA, prompt assist). Optional: the Higgsfield consumer CLI (`npm i -g @higgsfield/cli@1.1.26`, then `higgsfield auth login`) unlocks extra models on your Pro credits; without it every capability still works through the Cloud API and local fallbacks.

## Setup
```bash
pnpm install
cp .env.example .env.local      # fill in keys; DATA_DIR defaults to ~/JewelryStudio
pnpm doctor                     # checks binaries, lanes and the data dir
pnpm dev                        # http://127.0.0.1:3123 (app + worker, hot reload)
```

Production-style run (faster, no hot reload):
```bash
pnpm build
pnpm start
```

Try it without spending anything: `MOCK_PROVIDERS=1 pnpm dev` swaps every provider for deterministic local fixtures.

## Commands
| command | what |
|---|---|
| `pnpm dev` | Next dev server + worker |
| `pnpm build` / `pnpm start` | standalone build and run |
| `pnpm test` | unit + integration tests (vitest) |
| `pnpm test:e2e` | Playwright resume test (starts its own servers with mock providers; run `pnpm build` first for speed) |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint |
| `pnpm doctor` | environment check (`--live` also probes the lanes) |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations (applied automatically at worker boot) |
| `pnpm backup` | snapshot the SQLite database into `DATA_DIR/backups` |

## How a campaign flows
1. **Project** — one per client: brand notes, palette, default channels.
2. **Products** — structured spec (metal, stones, setting, size) + reference photos → clean plate and product sheet. The spec becomes fidelity invariants in every prompt and QA pass.
3. **People** (optional) — an original model from a brief, expanded by the director; identity sheets, outfits, optional Soul ID.
4. **Campaign** — brief (or paste the client's), products, person, references, settings.
5. **Shots** (stills) or **Storyboard** (video) — written by the director, edited by you, approved shot by shot; the compiled prompt and the cost are visible before anything is sent.
6. **Review** — candidates with QA scores and defect flags; keyboard-driven approve/reject/flag; compare; refine, relight, inpaint, outpaint, upscale from the drawer.
7. **Assemble** (video) — timeline, transitions, overlays, music, end card; preview and final render.
8. **Exports** — per-channel crops with a focal point and safe zones.

Stop any time: everything autosaves, running jobs survive restarts, and Home resumes where you left off.

## Data layout
`DATA_DIR/` holds `studio.sqlite`, `projects/<id>/{uploads,generated,edits,plates,sheets,renders,exports,thumbs}`, `backups/`, `logs/`, `tmp/`. Paths in the database are relative, so the folder can be moved or synced.

# Jewelry Studio — Implementation Plan (v1)

Status: **APPROVED by the owner on 2026-10-14.** This document is the single source of truth for the build. A fresh Claude Code session must be able to build the whole product from this file plus the files under `docs/research/` without asking the owner anything except for the credentials listed in §0.3.

Owner decisions already made (do not re-ask):

| Decision | Answer |
|---|---|
| Form factor | Local web app (Next.js 16 App Router, TypeScript), opened in a browser on the owner's machine. No auth, no cloud hosting. Keep the desktop-wrap option open (§23). |
| Primary machine | macOS Apple Silicon. Secondary: Windows 11 x64. Both must work; Mac is tested first. |
| Generation provider | Higgsfield, **dual lane**: Lane A = Higgsfield Cloud API (key+secret, pay-as-you-go). Lane B = official Higgsfield consumer CLI `@higgsfield/cli` (OAuth login, spends the owner's Pro subscription credits). **The app must be fully usable with Lane A alone**; Lane B is an enhancement that adds models and tools when logged in. No dead buttons in API-only mode (§8.4). |
| Creative LLM | Anthropic Claude API. `claude-opus-5-5` for storyboards/shot lists/prompt writing, `claude-haiku-5-5` for vision QA. |
| Editing depth | AI edits (inpaint, outpaint, relight, upscale, background removal, reframe, extend, object swap) plus a sequence assembler on ffmpeg (trim, order, transitions, music, text overlays, export). No multi-track NLE. |
| Storage | SQLite + local filesystem under `DATA_DIR`. |
| Single user | Yes. No accounts, no roles, no multi-tenancy. |
| Save / resume / switch | Everything autosaves to SQLite + `DATA_DIR` as it happens; there is no Save button. Any project can be closed, reopened, or switched to at any point of any workflow with zero loss, including while jobs run (§27). |
| UI/UX bar | Premium, studio-grade. A documented design system (§28) with tokens, typography, motion, empty/loading/error states and a per-milestone polish checklist is part of the deliverable, not a later pass. |

---

## 0. Read this first

### 0.1 What the product is
A studio tool the owner uses to pitch and deliver visual campaigns (stills and short videos) for jewelry brands. Input: the jewelry piece (photos + structured spec incl. size and type), campaign type (image / video), references (images or text), optional people (created from scratch, with outfits), lighting intent. Output: approved, QA-checked, export-ready images and videos, organized per client project, with every generation, prompt, cost, and decision recorded.

### 0.2 Build order (milestones)
M0 Foundation → M1 Providers → M2 Products → M3 Talent → M4 Image campaigns → M5 Video campaigns → M6 Editing → M7 Library, cost, hardening. Each milestone has acceptance criteria in §22. Do not start a milestone before the previous one's criteria pass.

### 0.3 What the owner must provide (collect at M1, store in `.env.local`)
| Variable | Source | Required for |
|---|---|---|
| `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` | https://console.higgsfield.ai → API keys (older links: cloud.higgsfield.ai). Fund ≥ $20. | Lane A (everything) |
| Higgsfield CLI login | On the owner's machine: `npm i -g @higgsfield/cli@1.1.26` then `higgsfield auth login` (browser OAuth). No env var; the CLI stores its own token. | Lane B (optional) |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com | Storyboards, prompt compiler assist, QA |
| `DATA_DIR` | Owner picks a folder (default `~/JewelryStudio` on Mac, `%USERPROFILE%\JewelryStudio` on Windows) | Media + DB |

Optional later: brand font files (TTF/OTF) for overlays, music tracks (MP3/WAV).

### 0.4 Research files you must consult while building
All under `docs/research/` (vendored from the planning session, 2026-10-14):
- `higgsfield-api.md` — the Cloud API engineering reference: auth, lifecycle, upload, errors, **full JSON schemas for all 79 Cloud endpoints (Appendix A)**, consumer↔cloud id mapping (§11), unverified items (§12). Treat Appendix A as the contract; confirm with `POST /estimate/<endpoint>` on first run.
- `cloud-models-summary.md` — condensed per-endpoint tables.
- `higgsfield-cli/README.md`, `higgsfield-cli/MODELS.md` — the official consumer CLI docs (MIT) with every `job_set_type`, flag and constraint.
- `higgsfield-craft-from-mcp.md` — Higgsfield's own product-photography recipes (master prompts for hero/luxury/in-hand/start-frame/macro-glide/light-sweep), prompt section order, vocabulary, negative blocks, refinement protocol, character-sheet slot architecture.
- `jewelry-craft.md` — jewelry taxonomy with real dimensions, campaign formats and shot lists, lighting craft and vocabulary, AI failure modes and mitigations, delivery specs, video structures, casting fields.
- `tech-stack.md` — pinned versions with justification, ffmpeg recipes, Claude SDK usage, SSE, media serving, desktop notes.

Where this plan and a research file disagree, **this plan wins**; where this plan is silent, the research file is the spec.

### 0.5 Hard rules for the implementing session
1. Never submit a paid generation twice for the same logical job. Every provider submission carries an idempotency key and persists the provider request id before anything else.
2. Never spend money without a recorded estimate (Lane A `/estimate`, Lane B `higgsfield generate cost`) and a ledger row. The UI shows the estimate before "Run".
3. Download every provider output immediately and store it under `DATA_DIR`; provider URLs expire (≥7 days on Cloud, unspecified on CLI).
4. Secrets never reach the browser. No `NEXT_PUBLIC_` secrets. No API key in any media URL.
5. Every capability resolves through the capability registry (§8.4). UI never calls a lane directly.
6. Product fidelity invariants (§9.5) are injected into every prompt that renders the product, and checked by QA (§19).
7. All file paths in the DB are relative to `DATA_DIR`. Use `path.join`; never string-concatenate paths. Windows must work.
8. Keep `src/lib/**` free of `next/*` imports; the worker imports those modules too.
9. Write tests as you go (§21). A milestone is not done until its tests pass on Mac and the `pnpm build` succeeds.
10. No in-memory-only state that matters. Every edit to a brief, spec, storyboard, timeline, filter view, or review decision is persisted on change (debounced ≤ 500 ms) and survives a browser refresh, an app restart, and switching projects (§27). Every screen passes the §28 polish checklist before its milestone closes.

---

## 1. Scope

### 1.1 In scope (v1)
- Projects per client/brand with brand notes, palette, references.
- Product intake: photos, structured spec (category, subtype, metal, karat, finish, stones, setting with prong count, chain length, clasp, dimensions), auto clean-plate, product sheet (multi-angle generated references), derived fidelity invariants.
- Talent: create a person from a brief (character sheet), lock identity (reference pack; Soul ID when Lane B available), outfits (wardrobe references), casting fields.
- Image campaigns: brief → Claude shot list → user approves/edits → batch generation with N variants per shot → automatic QA scoring → review board (approve / reject / flag / compare / filter) → refinement loop → upscale → export per channel.
- Video campaigns: brief → Claude storyboard → approve, edit, reorder (drag and drop) → keyframe stills per shot → approve → clips (image-to-video with start/end frames, reference-to-video for talent/product identity) → QA → assembler (timeline, trims, transitions, music, text overlays, end card) → export per channel.
- Lighting control: structured lighting vocabulary on every shot (setup, key quality/direction, fill, negative fill, rim, sparkle, Kelvin, mood, background) compiled into prompts; relight edit pass for existing images.
- Editing: mask-brush inpaint, outpaint to aspect, relight, background removal / clean plate, upscale, reframe video, extend video, object swap in video, before/after compare, version history.
- Library: every asset tagged, filterable (project, product, talent, shot, status, score, model, cost), searchable; presets (saved lighting/scene/shot recipes).
- Cost: estimates before run, ledger per job, per-project totals, daily cap.

### 1.2 Out of scope (v1)
Multi-user/auth, cloud deploy, multi-track timeline editor, audio generation beyond importing files (TTS/music via Lane B is a stretch goal, §24), 3D, publishing to social platforms, print CMYK conversion (export RGB masters at 300 dpi size only), payment/invoicing.

---

## 2. Architecture

```
┌──────────────────────────── owner's machine ────────────────────────────┐
│  Browser  ──HTTP──▶  Next.js 16 server (127.0.0.1:PORT)                  │
│                      ├─ app/ (React 19 UI, TanStack Query, SSE client)  │
│                      ├─ app/api/** Route Handlers (jobs, assets, media) │
│                      └─ reads/writes SQLite (WAL)  ◀──┐                 │
│                                                       │ same DB file    │
│  Worker process (node)  ───────────────────────────────┘                 │
│   ├─ queue loop (claims jobs atomically, p-limit per job type)          │
│   ├─ handlers: higgsfield.cloud, higgsfield.cli, claude.*, ffmpeg.*,    │
│   │            sharp.*, qa.*, export.*                                   │
│   └─ writes job_events → UI tails via GET /api/events (SSE)             │
│                                                                           │
│  DATA_DIR/  studio.sqlite, projects/<id>/..., cache/, tmp/, logs/        │
└───────────────────────────────────────────────────────────────────────────┘
          │ HTTPS                       │ child_process                │ HTTPS
          ▼                             ▼                              ▼
  api.higgsfield.ai (Lane A)   higgsfield CLI binary (Lane B)   api.anthropic.com
```

Principles: two processes, one SQLite file, no sockets between them. The worker is restartable without losing jobs. All long work (provider calls, ffmpeg, sharp, Claude) runs in the worker. Route Handlers only validate, enqueue, read.

---

## 3. Repository layout

```
jewelry-studio/
  package.json  pnpm-lock.yaml  .npmrc  .env.example  .gitignore
  next.config.ts  tsconfig.json  drizzle.config.ts  vitest.config.ts  playwright.config.ts
  eslint.config.js  postcss.config.mjs
  PLAN.md  CLAUDE.md  README.md
  docs/research/**                      # vendored references (read-only)
  assets/fonts/Inter-Regular.ttf  assets/fonts/Inter-SemiBold.ttf   # for drawtext/overlays
  drizzle/                              # generated SQL migrations (committed)
  src/
    env.ts                              # zod-validated env (server only), shared by app + worker
    db/schema.ts  db/client.ts  db/migrate.ts
    domain/                             # pure TS, no IO
      taxonomy.ts        # enums (§9.1)
      product.ts         # ProductSpec zod schema, invariants derivation, size tables (§9)
      talent.ts          # TalentSpec, casting enums (§10)
      lighting.ts        # lighting/scene enums, presets, material rules (§11)
      delivery.ts        # channel spec constants (§18)
      storyboard.ts      # Storyboard/Shot zod schemas (§13)
      prompt/            # prompt compiler (§12): sections.ts, templates/*.ts, negatives.ts, compile.ts
    providers/
      capability.ts      # registry + resolver (§8.4)
      higgsfield/cloud/client.ts  upload.ts  endpoints.ts  types.ts   (§8.1)
      higgsfield/cli/adapter.ts   parse.ts   models.ts               (§8.2)
      claude/client.ts  prompts/*.ts  schemas.ts                     (§8.3)
      local/sharp.ts  local/ffmpeg.ts  local/ffprobe.ts              (§8.5)
    queue/  schema is in db; here: enqueue.ts, worker.ts, handlers/*.ts, events.ts, errors.ts
    lib/    files.ts (DATA_DIR paths, atomic write, hash)  ids.ts  log.ts  money.ts
    server/ services used by routes: projects.ts products.ts talent.ts campaigns.ts assets.ts review.ts export.ts
  app/
    layout.tsx  page.tsx  globals.css
    (studio)/projects/[projectId]/...   # screens (§15)
    api/**/route.ts                     # HTTP API (§16)
  worker/main.ts  worker/tsconfig.json
  tests/unit/**  tests/integration/**  tests/e2e/**  tests/fixtures/**
```

---

## 4. Tech stack (pinned, verified 2026-10-14 — see docs/research/tech-stack.md for reasons)

Runtime: Node **24.21.0** (engines `>=24 <27`), pnpm **12.11.2** (`packageManager` field, `.npmrc` `engine-strict=true`).

```json
{
  "name": "jewelry-studio", "private": true, "type": "module",
  "packageManager": "pnpm@12.11.2",
  "engines": { "node": ">=24.0.0 <27" },
  "scripts": {
    "dev": "concurrently -k -n next,worker -c blue,magenta \"next dev\" \"tsx watch worker/main.ts\"",
    "build": "next build && tsc -p worker/tsconfig.json",
    "start": "concurrently -k -n next,worker \"node .next/standalone/server.js\" \"node --env-file=.env.local dist/worker/main.js\"",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "typecheck": "tsc --noEmit && tsc -p worker/tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "doctor": "tsx scripts/doctor.ts"
  },
  "dependencies": {
    "next": "16.4.0", "react": "19.3.0", "react-dom": "19.3.0",
    "better-sqlite3": "13.0.3", "drizzle-orm": "0.45.4",
    "sharp": "0.35.5", "ffmpeg-static": "5.3.0", "@derhuerst/ffprobe-static": "5.3.0",
    "@anthropic-ai/sdk": "0.133.0", "zod": "4.6.7",
    "@t3-oss/env-core": "0.13.11", "@t3-oss/env-nextjs": "0.13.11",
    "p-limit": "7.3.3", "nanoid": "6.0.2", "pino": "10.4.0", "dotenv": "18.0.7",
    "@tanstack/react-query": "5.104.2", "react-hook-form": "7.90.0", "@hookform/resolvers": "5.9.1",
    "@dnd-kit/core": "6.3.1", "@dnd-kit/sortable": "10.0.0", "@dnd-kit/modifiers": "9.0.0", "@dnd-kit/utilities": "3.2.2",
    "react-compare-slider": "4.0.0", "react-zoom-pan-pinch": "4.2.0",
    "konva": "10.8.0", "react-konva": "19.3.0", "media-chrome": "4.19.3", "react-virtuoso": "4.18.19",
    "sonner": "2.0.8", "radix-ui": "1.8.1", "lucide-react": "1.57.0",
    "cmdk": "1.1.1", "motion": "14.2.0", "@fontsource-variable/inter": "5.3.0", "@fontsource/instrument-serif": "5.3.0",
    "class-variance-authority": "0.7.1", "clsx": "2.1.1", "tailwind-merge": "3.7.0", "tw-animate-css": "1.4.0"
  },
  "devDependencies": {
    "typescript": "^6", "@types/node": "26.6.5", "@types/react": "19.3.0", "@types/react-dom": "19.3.0",
    "@types/better-sqlite3": "9.6.0", "drizzle-kit": "0.31.11",
    "tailwindcss": "4.3.3", "@tailwindcss/postcss": "4.3.3", "shadcn": "4.21.4",
    "eslint": "10.12.0", "eslint-config-next": "16.4.0",
    "tsx": "4.23.15", "concurrently": "10.0.6", "cross-env": "10.1.0",
    "vitest": "5.0.4", "vite": "8.3.4", "@vitest/coverage-v8": "5.0.4", "@vitejs/plugin-react": "6.1.2",
    "@testing-library/react": "16.3.3", "jsdom": "30.1.2", "msw": "3.0.3", "@playwright/test": "1.64.0"
  },
  "pnpm": { "onlyBuiltDependencies": ["better-sqlite3", "sharp", "ffmpeg-static", "@derhuerst/ffprobe-static"] }
}
```

Non-negotiables from the stack research: Route Handlers (not Server Actions) for anything touching files/jobs; separate worker process; `output: "standalone"`; `serverExternalPackages: ["better-sqlite3","sharp","ffmpeg-static","@derhuerst/ffprobe-static"]`; `images.unoptimized: true`; no `fluent-ffmpeg`; no Prisma; no Redis; TypeScript 6 (not 7) for the Next app; do **not** enable `cacheComponents`.

Lane B binary: `@higgsfield/cli` **1.1.26** installed globally by the owner (not a project dependency; its postinstall downloads a Go binary). The app locates it via `HIGGSFIELD_CLI_PATH` env or `PATH` lookup (`which higgsfield` / `where higgsfield.cmd`).

---

## 5. Configuration, environment, storage

### 5.1 `.env.example` (commit) / `.env.local` (git-ignored)
```
# Lane A — Higgsfield Cloud API (required)
HIGGSFIELD_API_KEY=
HIGGSFIELD_API_SECRET=
HIGGSFIELD_BASE_URL=https://api.higgsfield.ai
# Lane B — Higgsfield consumer CLI (optional). Leave empty to auto-detect on PATH.
HIGGSFIELD_CLI_PATH=
# Anthropic (required)
ANTHROPIC_API_KEY=
CLAUDE_DIRECTOR_MODEL=claude-opus-5-5
CLAUDE_QA_MODEL=claude-haiku-5-5
# Storage
DATA_DIR=            # default: ~/JewelryStudio (mac/linux) or %USERPROFILE%\JewelryStudio (windows)
# Binaries (optional overrides)
FFMPEG_PATH=
FFPROBE_PATH=
# Worker
WORKER_CONCURRENCY_PROVIDER=4
WORKER_CONCURRENCY_FFMPEG=1
WORKER_CONCURRENCY_CLAUDE=3
DAILY_SPEND_CAP_USD=50
# Server
PORT=3123
HOST=127.0.0.1
# Testing
MOCK_PROVIDERS=0
```
`src/env.ts` validates with zod (`@t3-oss/env-core`), resolves `DATA_DIR` default per OS, and is imported by both Next and worker. `HIGGSFIELD_API_KEY` missing → app boots but every Lane A capability reports `unavailable: missing credentials` and the Settings screen shows the fix.

### 5.2 `DATA_DIR` layout
```
DATA_DIR/
  studio.sqlite (+ -wal, -shm)
  projects/<projectId>/
    refs/<assetId>.<ext>                  # uploaded images/videos/audio (originals, EXIF stripped on copy)
    products/<productId>/plates/<assetId>.png   # clean plates / cutouts / product sheet frames
    talent/<talentId>/<assetId>.png       # character sheet, reference pack, outfit refs
    shots/<shotId>/candidates/<jobId>-<n>.<ext>   # generated stills
    shots/<shotId>/clips/<jobId>.mp4
    shots/<shotId>/frames/<jobId>-first.png|-last.png
    shots/<shotId>/masks/<maskId>.png
    edits/<assetId>-<version>.<ext>       # edit outputs
    renders/<renderId>.mp4                # assembled videos
    exports/<exportId>/<channel>/<file>   # deliverables
  cache/thumbs/<assetId>-<w>.webp         # regenerable
  cache/claude/<sha>.json                 # cached vision downsizes, optional
  tmp/                                    # ffmpeg scratch, wiped on worker start
  logs/worker.log  logs/ffmpeg/<jobId>.log  logs/cli/<jobId>.log
```
Writes are atomic (`tmp → rename`). Each asset row stores `sha256, bytes, width, height, duration_ms, mime`. Thumbnails generated lazily by `GET /api/media/thumb/<assetId>?w=512`.

### 5.3 OS notes
- Mac: default install path for the CLI is `/usr/local/bin/higgsfield` (curl/brew) or pnpm/npm global bin. GUI-launched processes have an empty PATH; the worker therefore also checks `/usr/local/bin`, `/opt/homebrew/bin`, `~/.npm-global/bin`, `$(npm prefix -g)/bin`.
- Windows: CLI is `higgsfield.cmd` in `%APPDATA%\npm`. Spawn with `shell: false` and the resolved `.cmd` path via `cmd /c` wrapper or `spawn(process.env.ComSpec, ["/c", cliPath, ...args])`. ffmpeg `drawtext` fontfile path must be escaped as `C\\:/path/Inter-Regular.ttf`. Use `fs.rename` across the same volume only (keep `tmp/` inside `DATA_DIR`).
- Both: bind `HOST=127.0.0.1`; never 0.0.0.0.

---

## 6. Data model (Drizzle, SQLite)

All ids are `nanoid(16)` text. Timestamps are epoch ms integers. JSON columns are `text` validated by zod on read and write (`src/db/json.ts` helpers). `*_rel` columns are paths relative to `DATA_DIR`.

```ts
// src/db/schema.ts (abridged; every column listed is required unless marked ?)
projects        { id, name, client_name?, brand_notes?, palette_json? (string[] hex), default_channels_json (ChannelId[]), created_at, updated_at, archived: int 0/1 }
assets          { id, project_id→projects, kind: 'image'|'video'|'audio'|'mask'|'font', role: 'upload'|'plate'|'sheet'|'candidate'|'clip'|'frame'|'edit'|'render'|'export'|'thumb'|'talent_ref'|'outfit_ref'|'style_ref',
                  path_rel, mime, bytes, sha256, width?, height?, duration_ms?, fps?, has_audio?,
                  source_job_id?→jobs, parent_asset_id?→assets (version lineage), version: int default 1,
                  provider_url? (original URL, for audit only), meta_json? (seed, model, params echo), created_at }
asset_tags      { asset_id→assets, tag } PK(asset_id, tag)
products        { id, project_id, name, sku?, spec_json (ProductSpec §9), invariants_json (string[] derived + user-edited), notes?, created_at, updated_at }
product_refs    { product_id, asset_id, role: 'front'|'three_quarter'|'profile'|'back'|'macro'|'worn'|'packaging'|'other', is_primary: int, order: int } PK(product_id, asset_id)
talent          { id, project_id?, name, spec_json (TalentSpec §10), identity_mode: 'reference_pack'|'soul_id', soul_id? (Lane B uuid), soul_status?: 'training'|'ready'|'failed', locked_features_json (string[]), created_at, updated_at }
talent_refs     { talent_id, asset_id, role: 'front'|'three_quarter'|'profile'|'full_body'|'expression'|'hands'|'ears'|'neck'|'sheet', order } PK(talent_id, asset_id)
outfits         { id, talent_id→talent, name, description, palette_json?, created_at }
outfit_refs     { outfit_id, asset_id, order } PK(outfit_id, asset_id)
campaigns       { id, project_id, name, kind: 'image'|'video', brief_json (CampaignBrief §13.1), status: 'draft'|'planning'|'shots_pending_approval'|'generating'|'review'|'assembling'|'done'|'archived',
                  director_run_id?→claude_runs, storyboard_json? (Storyboard §13.3, video only), settings_json (defaults: variants per shot, aspect, models, lighting preset, budget cap), created_at, updated_at }
campaign_products { campaign_id, product_id, order } PK
campaign_talent   { campaign_id, talent_id, outfit_id? } PK(campaign_id, talent_id)
campaign_refs     { campaign_id, asset_id, role: 'style'|'mood'|'composition'|'lighting'|'competitor', note? } PK(campaign_id, asset_id)
shots           { id, campaign_id, order: int, title, spec_json (Shot §13.2), approved: int 0/1, status: 'planned'|'generating'|'review'|'approved'|'rejected'|'skipped',
                  selected_asset_id?→assets (the approved pick), keyframe_asset_id? (video: approved still), clip_asset_id? (video: approved clip), compiled_prompt_json? (last PromptBundle §12.6), created_at, updated_at }
generations     { id, shot_id?→shots, job_id→jobs, capability (§8.4 id), lane: 'cloud'|'cli'|'local', model_id, params_json, prompt_text, negative_text?, reference_asset_ids_json, seed?, provider_request_id?, estimate_usd?, actual_usd?, status: 'queued'|'running'|'succeeded'|'failed'|'nsfw'|'cancelled', error?, created_at, finished_at? }
candidates      { id, generation_id→generations, asset_id→assets, index: int, qa_json? (QAResult §19.3), qa_score?: real, review: 'unreviewed'|'approved'|'rejected'|'flagged'|'maybe', review_note?, reviewed_at? }
reviews_log     { id, candidate_id, action, note?, at }        # audit trail of approve/reject/flag
edits           { id, source_asset_id→assets, result_asset_id?→assets, op: 'inpaint'|'outpaint'|'relight'|'cutout'|'upscale'|'reframe'|'extend'|'object_swap'|'refine'|'crop'|'adjust', params_json, mask_asset_id?, job_id?, status, created_at }
timelines       { id, campaign_id, name, timeline_json (Timeline §17.1), render_asset_id?, status: 'draft'|'rendering'|'rendered'|'failed', created_at, updated_at }
exports         { id, campaign_id, channel_id (§18), source_asset_id, asset_id?, params_json, job_id?, status, created_at }
presets         { id, kind: 'lighting'|'scene'|'shot'|'storyboard_template'|'prompt_block', name, data_json, created_at }
claude_runs     { id, purpose: 'shot_list'|'storyboard'|'prompt_assist'|'qa'|'critique'|'brief_parse', model, input_json (sanitized), output_json?, usage_json (input/output/cache tokens), cost_usd, status, error?, created_at }
jobs            { id, type (§7.2), payload_json, idempotency_key UNIQUE, status: 'queued'|'running'|'succeeded'|'failed'|'cancelled', priority int, attempts int, max_attempts int, run_after, locked_by?, locked_at?, parent_id?→jobs, result_json?, error?, created_at, updated_at }
job_events      { id INTEGER PK AUTOINCREMENT, job_id, ts, kind: 'progress'|'log'|'status'|'artifact'|'cost', data_json }
ledger          { id, job_id?, lane, provider: 'higgsfield_cloud'|'higgsfield_cli'|'anthropic', model_id, estimate_usd?, actual_usd?, credits? (Lane B), currency: 'usd'|'credits', note?, project_id?, campaign_id?, at }
settings        { key PK, value_json }     # UI prefs, last-used models, daily cap overrides, CLI status cache
```
Indexes: `jobs(status, run_after, priority)`, `job_events(job_id, id)`, `assets(project_id, role)`, `candidates(generation_id)`, `generations(shot_id)`, `ledger(at)`, `ledger(project_id)`.

Migration workflow: edit schema → `pnpm db:generate` → commit `drizzle/*` → worker runs `migrate()` on boot (also `pnpm db:migrate` manually). Never `drizzle-kit push`.

---

## 7. Job system

### 7.1 Queue semantics (hand-rolled, SQLite)
- Enqueue: `enqueue(type, payload, { idempotencyKey?, priority?, parentId?, runAfter? })` → `INSERT ... ON CONFLICT(idempotency_key) DO NOTHING` then return existing/new row. Default idempotency key = `sha256(type + canonicalJSON(payload))`.
- Claim: every 500 ms or on wake: one transaction `SELECT ... WHERE status='queued' AND run_after<=now ORDER BY priority DESC, created_at LIMIT k` → `UPDATE ... SET status='running', locked_by=workerId, locked_at=now, attempts=attempts+1`.
- Concurrency: `p-limit` per lane: provider jobs (cloud+cli) `WORKER_CONCURRENCY_PROVIDER`, ffmpeg `WORKER_CONCURRENCY_FFMPEG`, claude `WORKER_CONCURRENCY_CLAUDE`, local sharp 2.
- Heartbeat: handlers call `touch()` every 10 s; startup sweep resets `running` rows with `locked_at < now-60s` to `queued` **unless** `result_json.provider_request_id` exists, in which case the job resumes by polling that id (never resubmits).
- Retry: transient errors → `run_after = now + min(2^attempts × 5 s + jitter, 5 min)`, `max_attempts` 3 (provider) / 1 (ffmpeg, claude QA) / 2 (claude director). `PermanentError` (4xx validation, nsfw, insufficient credits, missing credentials) → `failed` immediately with a user-readable `error`.
- Cancel: `POST /api/jobs/:id/cancel` sets a `cancel_requested` flag in `settings`-like table `job_cancel(job_id)`; handlers check between steps; cloud jobs call `/requests/{id}/cancel` (only works while queued) and otherwise stop polling and mark `cancelled` (money may still be spent; ledger records estimate as actual).
- Events: handlers emit `progress {pct, message}`, `log {line}`, `artifact {asset_id}`, `cost {estimate_usd|actual_usd}`, `status {status}`. UI tails `GET /api/events?since=<id>`.
- Fan-out: parent/child via `parent_id`; a parent completes when all children terminal (handler `fanout.await`).

### 7.2 Job types and handlers (`src/queue/handlers/`)
| type | payload (zod) | handler summary |
|---|---|---|
| `asset.ingest` | {project_id, tmp_path, role, filename} | sha256, sniff mime, sharp/ffprobe metadata, EXIF strip (images), move into place, insert asset, thumb |
| `product.clean_plate` | {product_id, asset_id} | capability `image.cutout` (Lane B) or `image.clean_plate` (Lane A) → plate asset |
| `product.sheet` | {product_id} | capability `image.product_sheet` → 4 angle stills on seamless white; stored as product_refs role=sheet |
| `talent.sheet` | {talent_id, outfit_id?} | capability `image.character_sheet` (§10.3) |
| `talent.soul_train` | {talent_id} | Lane B `soul-id create` + `soul-id wait`; updates talent.soul_id/soul_status |
| `director.shot_list` | {campaign_id} | Claude Opus: brief+products+talent+refs → ShotList (§13.2) → creates shots rows (approved=0) |
| `director.storyboard` | {campaign_id} | Claude Opus → Storyboard (§13.3) → shots rows |
| `prompt.compile` | {shot_id, capability, model_id} | deterministic compiler (§12), Claude assist only when `shot.spec.free_text` present |
| `gen.image` | {shot_id, capability, model_id, variants, params, reference_asset_ids} | resolve lane → estimate → ledger → submit → poll → download → candidates rows → enqueue `qa.image` per candidate (batched) |
| `gen.video` | {shot_id, capability, model_id, params, start_asset_id?, end_asset_id?, reference_asset_ids} | same; extracts first/last frames after download |
| `qa.image` | {candidate_ids[], product_id?, shot_id} | Haiku vision rubric (§19.3) + local checks (§19.2) → candidates.qa_json/score |
| `qa.video` | {candidate_id} | contact sheet (6 frames) → Haiku rubric for temporal consistency + local flicker metric |
| `edit.inpaint` / `edit.outpaint` / `edit.relight` / `edit.cutout` / `edit.upscale` / `edit.reframe` / `edit.extend` / `edit.object_swap` / `edit.refine` | {edit_id} | capability resolution (§8.4) → result asset with version lineage |
| `ffmpeg.render` | {timeline_id} | Timeline → filtergraph (§17) → render asset |
| `export.run` | {export_id} | per-channel transform (§18) |
| `fanout.await` | {child_ids[]} | completes when children terminal; used for "generate all approved shots" |
| `provider.probe` | {} | first-run live checks (§24) |

Every handler signature: `(ctx: { job, db, log, emit, touch, isCancelled, lane: Resolver }) => Promise<ResultJson>`.

---

## 8. Provider layer

### 8.1 Lane A — Higgsfield Cloud API client (`src/providers/higgsfield/cloud/`)
Facts (confirmed from official SDK source; see docs/research/higgsfield-api.md §1–§5):
- Base `https://api.higgsfield.ai`. Header `Authorization: Key ${KEY}:${SECRET}`, `Content-Type: application/json`, `User-Agent: jewelry-studio/0.1`.
- Submit: `POST /{endpoint}` with the model params as the JSON body. Optional header `Idempotency-Key` (UUID per generation row — reuse exact key+body on ambiguous network failure; never a bare retry). Response `{status:"queued", request_id, status_url, cancel_url}`.
- Poll: `GET /requests/{request_id}/status` → `{status, images?:[{url}], video?:{url}, audio?:{url}, audios?:[{url}], error?}`. Statuses `queued|in_progress|completed|failed|nsfw|canceled` (accept `cancelled` too). Backoff 2 s → ×1.5 → cap 10 s, jitter ±20%. Time-box: images 15 min, video 40 min. Retry GET on 5xx/network.
- Cancel: `POST /requests/{id}/cancel` (400 if already processing → treat as "cannot cancel").
- Upload local files: `POST /files/generate-upload-url {content_type}` → `{upload_url, public_url, upload_headers?}`; `PUT upload_url` with raw bytes, **no Authorization header**, echo `upload_headers` if present (else `Content-Type`). Use `public_url` in `image_url(s)/video_url(s)/audio_url(s)/first_frame_url/last_frame_url/end_image_url/last_image_url`. Supported: jpg/jpeg/png/webp/gif, wav, mp4. Upload URL valid 1 h; cache `{sha256 → public_url, uploaded_at}` in `settings` and re-upload if older than 50 min or if a 4xx mentions the URL.
- Estimate: `POST /estimate/{endpoint}` with the same body → `{usd:"0.231"}` or `{pricing_description}`. Free. If `pricing_description`, compute an estimate locally from the formula in Appendix A (token-metered video: `ceil(seconds × W × H × 24 / 1024)` tokens × rate) and label it "formula".
- Errors: 400 invalid/concurrency ("concurrency" in detail → retryable with 30 s delay), 401 → PermanentError credentials, 402/403 → PermanentError insufficient credits, 404 → PermanentError unknown endpoint, 422 → PermanentError validation (surface `detail[]`), 429 → retry, 5xx → retry. Body `{detail: string | [{loc,msg}]}`.
- Outputs: download every URL immediately to `tmp/` then atomic move; record `provider_url` for audit. No auth header to CDN hosts.
- No model-list endpoint; endpoint ids and schemas come from `endpoints.ts` (hand-typed from Appendix A) + a `scripts/sync-cloud-schemas.ts` that tries `https://dash.higgsfield.ai/models/<endpoint>/llms.txt` (may be unreachable; non-fatal).
- Do **not** use `@higgsfield/client` (v2 lacks status/cancel/upload and retries POSTs without idempotency). Write a ~200-line `fetch` client with zod-typed responses.

`endpoints.ts` must define, with zod input schemas copied from Appendix A: `marketing-studio/image`, `marketing-studio/image/flare`, `marketing-studio/image/sunburst`, `higgsfield-ai/soul/v2/standard`, `alibaba/qwen-image-3/edit`, `xai/grok-imagine-image-2.0`, `ideogram/v4.0`, `recraft/v4.1/pro/text-to-image`, `bytedance/seedance-2.5/{text-to-video,image-to-video,reference-to-video,video-edit,video-extend}`, `bytedance/seedance-2.0/{image-to-video,reference-to-video}`, `kling-video/v3.0/{std,pro,4k}/image-to-video`, `kling-video/v3.0-turbo/image-to-video`, `kling-video/o3/{image-reference,first-last-frame,video-edit,video-reference}`, `minimax/h3/{image-to-video,reference-to-video}`, `alibaba/wan-3.0/{image-to-video,reference-to-video}`, `higgsfield/genjutsu/object-swap/v1.0`, `higgsfield/cinema-studio/4.0`. Unknown/legacy ids (`nano-banana-pro`, `bytedance/seedream/v4/...`, `flux-pro/kontext/...`, `/v1/*`) are **not** used; a probe (§24) checks them once and records availability in `settings.cloud_probe`.

### 8.2 Lane B — Higgsfield consumer CLI adapter (`src/providers/higgsfield/cli/`)
Facts (docs/research/higgsfield-cli/README.md + MODELS.md):
- Binary `higgsfield` (alias `higgs`), v1.1.26. Commands used: `auth status|login|logout`, `account status`, `account credits` (name per `higgsfield account --help`; probe), `model list --json`, `model get <jst> --json`, `generate create <jst> [flags] --wait --json`, `generate cost <jst> [flags] --json`, `generate get <job_id> --json`, `generate wait <job_id> --json`, `generate list --json`, `upload create --image|--video|--audio <path> --json`, `soul-id create --name <n> --soul-2 --image <p>... --json`, `soul-id wait <id>`, `soul-id list --json`, `workflow get reframe --json`, `generate workflow reframe --video <p> --aspect-ratio 9:16 --resolution 1080p --wait --json`, `voices list --json`.
- Media flags accept local paths (auto-upload) or UUIDs. Reference-array models use repeated `--image-references` (alias `--image`); start/end frames `--start-image`/`--end-image`; masks for `gpt_image_2` via `--is_inpaint true --mask <path>`.
- Tokens are short-lived. `Session expired` / `Not authenticated` on stderr or non-zero exit → mark lane B `needs_login`, PermanentError on the job with message "Run `higgsfield auth login` in a terminal, then retry", and the capability registry falls back to Lane A for new jobs.
- Output parsing: with `--wait --json` the CLI prints the final job object (array). The exact field names are **unverified**; `parse.ts` must be tolerant: find the first object with `status`, collect `result_url | results[].url | outputs[].url | media[].url | url` recursively (any https URL whose path ends in a media extension), and persist the raw JSON to `logs/cli/<jobId>.json`. The first-run probe (§24) records the real shape in `docs/probes/cli-json-shapes.md` and `parse.ts` gets a strict fast-path for it.
- Cost: `generate cost <jst> <flags> --json` → credits; ledger `currency:'credits'`. Show credits with the credits→USD hint from `account status` if present, else credits only.
- Spawn with `{ env: {...process.env, NO_COLOR:'1'}, windowsHide:true }`, per-job timeout (images 15 min, video 40 min, soul 35 min), kill tree on cancel. Logs to `logs/cli/<jobId>.log`.
- Models used in v1 (job_set_type → purpose): `nano_banana_2` (Nano Banana Pro, ≤14 refs, 1k/2k/4k), `gpt_image_2_5` (≤16 refs, flare/sunburst, up to 4k), `gpt_image_2` (mask inpaint), `seedream_v4_5` (≤14 refs), `flux_kontext` (≤4 refs, edit), `text2image_soul_v2` + `--soul-id`, `soul_cinematic`, `image_background_remover`, `outpaint`, `topaz_image`, `bytedance_image_upscale`, `video_upscale`/`topaz_video`, `reframe` (workflow), `seedance_2_5`, `seedance_2_0`, `kling3_0`, `text2speech_v2`, `sonilo_music` (stretch). Their flags are in MODELS.md; for the utility types run `higgsfield model get <jst> --json` during the probe and store schemas in `settings.cli_schemas`.

### 8.3 Claude client (`src/providers/claude/`)
Per docs/research/tech-stack.md §7 (from the claude-api skill, 2026-10):
- `@anthropic-ai/sdk` 0.133.0, `new Anthropic()` reads `ANTHROPIC_API_KEY`. Structured output via `client.messages.parse({ output_config: { effort, format: zodOutputFormat(Schema) } })`; guard `stop_reason === "refusal"` and `parsed_output === null`.
- Director (`claude-opus-5-5`, `effort:"high"`, `max_tokens` 16000): system = [craft guidance block (frozen text, `cache_control: {type:"ephemeral", ttl:"1h"}`)] + task block; user = product images (downscaled to 1092 px long edge, base64), talent refs, style refs, then the brief JSON as text. Images before text.
- QA (`claude-haiku-5-5`, `effort:"low"`): reference product plate first, then up to 6 candidates per call at 1092 px (1568 px for `macro_detail` shots), rubric cached (5-min default TTL).
- Vision prep: sharp resize, JPEG q85, strip metadata, `<= 5 MB` each; never more than 20 images per request.
- Record every run in `claude_runs` with usage and cost at list price (Opus $4/$20 per MTok, cache read $0.20; Haiku $0.10/$0.50).
- Retries: SDK default 2; on 529/overloaded wait 20 s once more; otherwise fail the job with the message.

### 8.4 Capability registry (the dual-lane contract)
`src/providers/capability.ts` declares every capability with an ordered list of implementations. The resolver picks the first implementation whose `available()` is true (credentials present, CLI logged in, binary found, model enabled in Settings). The UI asks `GET /api/capabilities` and renders the active implementation name next to each action; if only a degraded implementation is available it shows a one-line note ("Using GPT Image 2.5 clean plate; log in to the Higgsfield CLI for true cutouts"). **Nothing is hidden or disabled in API-only mode; every capability has a Lane A or local implementation.**

| capability id | purpose | implementations in priority order (lane: model/endpoint) | API-only path |
|---|---|---|---|
| `image.generate.product` | product-faithful still from refs + prompt | cli: `gpt_image_2_5` (variant flare, quality high, 2k/4k, ≤16 refs) · cloud: `marketing-studio/image/flare` (same model, ≤16 refs, 1k–4k) · cli: `nano_banana_2` (≤14 refs) · cli: `seedream_v4_5` | cloud flare (identical model to cli default) |
| `image.generate.person` | editorial person/talent still | cli: `text2image_soul_v2 --soul-id` (when talent has Soul) · cli/cloud: `gpt_image_2_5` / `marketing-studio/image/flare` with reference pack · cloud: `higgsfield-ai/soul/v2/standard` (text-only, no identity) | flare with reference pack |
| `image.generate.scene` | background/location plates, no product | cloud: `marketing-studio/image` · cli: `nano_banana_2` · cloud: `higgsfield-ai/soul/v2/standard` (cheap, $0.004) | cloud |
| `image.character_sheet` | multi-view talent sheet | same as generate.person with sheet template (§10.3) | cloud flare |
| `image.product_sheet` | 4 clean angles of the product | `image.generate.product` with product-sheet template (§9.6) | cloud flare |
| `image.edit.refine` | "keep identical, only change X" | cloud: `marketing-studio/image/flare` (source as ref #1) · cli: `gpt_image_2_5` · cloud: `alibaba/qwen-image-3/edit` (≤3 refs, negative_prompt, 2k) | cloud flare |
| `image.edit.inpaint` | masked local change | cli: `gpt_image_2 --is_inpaint true --mask` · **local composite**: run `image.edit.refine` on the full image with the mask region described in words + a red-outlined copy as ref #2, then alpha-composite only the feathered mask area over the original with sharp (§14.6) | local composite over cloud flare |
| `image.edit.outpaint` | extend canvas to aspect | cli: `outpaint --aspect_ratio` · **local pad + refine**: sharp pads to target aspect with mirrored+blurred fill, then `image.edit.refine` with instruction "replace the blurred border area with a natural continuation; keep the original center pixels identical", then composite original center back | pad + cloud flare + composite |
| `image.edit.relight` | change lighting, keep product | `image.edit.refine` with lighting vocabulary block and invariants; optional mask composite to protect product | cloud flare |
| `image.cutout` | alpha cutout of product | cli: `image_background_remover` · local: `@imgly/background-removal-node` 1.4.5 **only if its LICENSE.md permits the owner's use (check at install; it is not MIT)**; else skipped | — (see next row) |
| `image.clean_plate` | product on seamless white/grey, straightened | `image.generate.product` with Higgsfield "start-frame" master prompt (docs/research/higgsfield-craft-from-mcp.md) variant for seamless white | cloud flare — this is the API-only replacement for cutout; the app uses plates, not alpha, as references |
| `image.upscale` | 2×/4× for print/4K | cli: `topaz_image` · cli: `bytedance_image_upscale` · **generative**: `marketing-studio/image/flare` resolution `4k`, source as ref, "re-render at higher resolution, identical" + QA diff gate (§19.2 SSIM ≥ 0.85 on downscale, else reject) · **local**: sharp lanczos3 2× + mild unsharp (always available, labelled "basic") | generative + local |
| `video.generate.i2v` | still → clip, optional end frame | cloud: `kling-video/v3.0/pro/image-to-video` (`image_url`,`last_image_url`, 3–15 s, elements) · cloud: `bytedance/seedance-2.0/image-to-video` (`end_image_url`, up to 4k) · cloud: `bytedance/seedance-2.5/image-to-video` (720p) · cloud: `kling-video/v3.0-turbo/image-to-video` (cheap draft) · cli: `kling3_0`, `seedance_2_5 --mode omni_reference` | cloud (primary anyway) |
| `video.generate.r2v` | identity-locked clip from refs (talent+product) | cloud: `bytedance/seedance-2.5/reference-to-video` (≤30 image refs) · cloud: `kling-video/o3/image-reference` (`image_urls`, `first_frame_url`, `last_frame_url`, mode std/pro/4k) · cloud: `bytedance/seedance-2.0/reference-to-video` (4k) · cloud: `minimax/h3/reference-to-video` | cloud |
| `video.generate.flf` | first+last frame transition | cloud: `kling-video/o3/first-last-frame` · `video.generate.i2v` with end frame | cloud |
| `video.generate.product_preset` | Higgsfield recipe (macro-glide, light-sweep, product-spin…) | start frame via `image.clean_plate` then `video.generate.i2v` on `bytedance/seedance-2.0/image-to-video` 6 s 1080p silent with the recipe's master prompt | cloud |
| `video.edit.extend` | continue a clip | cloud: `bytedance/seedance-2.5/video-extend` · local: `video.generate.i2v` from the last frame then concat (labelled "continuation by last frame") | cloud |
| `video.edit.object_swap` | swap product/person in an existing clip | cloud: `higgsfield/genjutsu/object-swap/v1.0` (video + ≤8 refs) · cloud: `kling-video/o3/video-edit` | cloud |
| `video.edit.reframe` | change aspect | cli: workflow `reframe` · local: ffmpeg crop/pad with keyframed focal point (§17.4) | local |
| `video.upscale` | 1080p→4K | cli: `topaz_video` / `video_upscale` · local: ffmpeg lanczos scale (labelled "basic") | local |
| `video.cutout` | remove background from clip | cli: `video_background_remover` · none locally → capability reports `unavailable (needs Higgsfield CLI login)`; the only capability allowed to be unavailable in API-only mode, and it is not on any main flow | — |
| `talent.identity.train` | Soul ID | cli: `soul-id create --soul-2` · fallback `reference_pack` mode (no training; identity via refs in every prompt) | reference pack |
| `audio.tts`, `audio.music` | stretch (§24) | cli: `text2speech_v2`, `sonilo_music` · local: import files | import files |

Model routing defaults are editable in Settings → Models (per capability, per lane). `settings.capability_overrides` persists them.

### 8.5 Local tools
- `local/sharp.ts`: metadata, EXIF strip, resize for Claude, thumbnails, pad-to-aspect with mirrored blur, feathered alpha composite, contact sheet of stills, SSIM-lite comparison (downscale both to 256 px grayscale, mean abs diff + structural term; good enough as a gate), mean hue of a masked region (metal color check), unsharp.
- `local/ffmpeg.ts` + `ffprobe.ts`: `runFfmpeg(args, {onProgress, logPath, signal})` spawning `ffmpeg-static` (or `FFMPEG_PATH`) with `-hide_banner -nostats -progress pipe:1 -y`; parses `out_time_us`. Recipes in §17.

---

## 9. Domain: product spec

### 9.1 Enums (`src/domain/taxonomy.ts`)
```ts
jewelry_category: ring | necklace | earring | bracelet | brooch | anklet | body_jewelry | watch | cufflink
ring_subtype:     solitaire | band | eternity | half_eternity | signet | cocktail | stackable | halo | three_stone | cluster | dome | chevron
necklace_subtype: pendant | chain | choker | lariat | station | collar | tennis | layered | locket
earring_subtype:  stud | huggie | hoop | drop | chandelier | ear_cuff | climber | threader | jacket | clip_on
bracelet_subtype: tennis | bangle | cuff | chain | charm | beaded | cord | id_bar
metal:            yellow_gold | white_gold | rose_gold | platinum | sterling_silver | vermeil | gold_plated | gold_filled | titanium | stainless_steel | enamel | mixed_metal
karat:            10 | 14 | 18 | 22 | 24 | null
finish:           high_polish | satin | brushed | hammered | matte | sandblast | florentine
stone_type:       diamond | lab_diamond | moissanite | sapphire | ruby | emerald | aquamarine | morganite | tanzanite | amethyst | citrine | garnet | peridot | topaz | tourmaline | opal | turquoise | lapis | onyx | moonstone | labradorite | spinel | alexandrite | jade | pearl | cubic_zirconia | other
stone_shape:      round_brilliant | princess | cushion | oval | emerald | asscher | radiant | pear | marquise | heart | baguette | trillion | rose_cut | old_european | cabochon | bead | irregular
stone_role:       center | side | accent | pave | halo | melee | strand
setting:          prong | bezel | half_bezel | pave | micro_pave | channel | bar | halo | double_halo | tension | flush | cluster | invisible | bead | cathedral | basket | trellis
clasp:            lobster | spring_ring | toggle | box | magnetic | barrel | hook | slide | none
earring_back:     butterfly | screw | lever | latch | french_hook | hinged
chain_style:      cable | curb | rope | box | figaro | paperclip | snake | herringbone | rolo | wheat | bead
pearl_type:       akoya | freshwater | south_sea | tahitian | baroque | keshi
finger:           thumb | index | middle | ring | pinky ;  hand: left | right ;  ear_side: left | right | both
```

### 9.2 `ProductSpec` (zod, `src/domain/product.ts`)
```ts
{
  category, subtype?,                                   // from enums above (subtype validated per category)
  metal: { type, karat?, finish, plating?: 'rhodium'|'none' },
  stones: [{ role, type, shape, carat?, mm?: [w,h]|[d], count?, color?: string, clarity?: string, setting?: {type, prong_count?: 2|3|4|6|8}, cut?: 'faceted'|'cabochon'|'rose'|'bead' }],
  setting?: { type, prong_count?, halo?: boolean },      // primary setting (rings/pendants)
  chain?: { style, length_in?: number, width_mm?: number, clasp? },
  dimensions?: { band_width_mm?, band_thickness_mm?, face_mm?: [w,h], diameter_mm?, length_mm?, drop_mm?, inner_diameter_mm?, case_mm? },
  wear?: { hand?, finger?, stack_position?: number, ear_side?, sits_at?: 'base_of_neck'|'collarbone'|'below_collarbone'|'sternum'|'mid_chest'|'below_bust' },
  size_label?: string,                                   // e.g. "US 6", "18 in", "7 in"
  hallmarks?: string[],                                  // text that must appear exactly or be out of frame
  packaging?: string,
  description_freeform?: string
}
```
Validation rules: `prong_count` required when any setting is `prong`; `chain.length_in` required for necklaces (default 18) and bracelets (default 7); `mm` auto-filled from carat for round diamonds via the table below when absent (mark `derived:true` in UI); `wear.finger` default `left.ring` for solitaire/band/eternity, `right.index` for cocktail, `pinky` for signet.

### 9.3 Size tables (`src/domain/sizes.ts`, from docs/research/jewelry-craft.md §1)
- Round brilliant carat→mm: 0.05→2.4, 0.10→3.0, 0.25→4.1, 0.50→5.1, 0.75→5.8, 1.0→6.5, 1.5→7.4, 2.0→8.2, 3.0→9.3 (linear interpolate; ovals ≈ +15% length).
- Chain length→landmark: 14→base_of_neck (choker), 16→base_of_throat, 18→collarbone, 20→below_collarbone, 22–24→sternum, 28–30→mid_chest, 36+→below_bust (doubled).
- Ring band width classes: 1.5–2 fine, 2.5–3 classic, 4–6 bold, 8+ statement; US size→inner mm: 5→15.7, 6→16.5, 7→17.3, 8→18.1, 9→19.0, 10→19.8.
- Hoops: 12–20 small, 20–40 medium, 40–60 large, 60+ statement; huggies 8–15 inner; studs 2–4 mini, 5–8 standard, 9–12 large; drops 20–40 short, 40–60 mid, 70–90 long.
- Bracelets: chain 7 in women / 8 in men; bangle inner ≈ 60–65 mm; tennis width ≈ 2.1 mm (1 cttw), 2.8 (2 cttw), 3.2 (3 cttw).
- Scale anchors: adult finger base width ≈ 15–20 mm; these feed the "scale" sentence in prompts.

### 9.4 Product references
Roles: front, three_quarter, profile, back, macro, worn, packaging. Primary = the authoritative identity image (default: front). Minimum to generate: 1 image; recommended 3 (front, three_quarter, macro). UI warns when short side < 1500 px.

### 9.5 Fidelity invariants (derived, user-editable list of short sentences)
Generated by `deriveInvariants(spec)`; examples: "exactly 4 prongs", "one oval center stone, no accent stones", "18k yellow gold, high polish, warm reflections", "cable chain 18 in with lobster clasp", "no engraving or text visible", "pendant hangs centered at collarbone", "pair of earrings, identical". Stored in `products.invariants_json`; every prompt that renders the product includes the block `[PRODUCT — must match reference images exactly]` + invariants + "no added stones, no text, no logo, no hallmark"; QA rubric receives the same list.

### 9.6 Product sheet (job `product.sheet`)
Four stills via `image.generate.product` on seamless light-grey (not pure white; preserves white-metal edges): hero 45°, front straight-on, profile, macro top-down of the primary stone/detail. Prompt = Higgsfield "clean premium start frame" master prompt (docs/research/higgsfield-craft-from-mcp.md) with background fixed to `#EDEDED`, product 60–70% of frame, aspect 1:1, resolution 2k. Each result QA-scored against the uploaded refs; the owner approves which sheet frames become references (role `sheet`). Sheet frames are then included (after the uploads) in `reference_asset_ids` for all later shots.

---

## 10. Domain: talent (people)

### 10.1 `TalentSpec`
```ts
{
  name, gender_presentation: 'woman'|'man'|'nonbinary', age_range: '18-24'|'25-34'|'35-44'|'45-60'|'60+',
  skin_tone_monk: 1..10, undertone: 'warm'|'cool'|'neutral'|'olive', heritage_notes?: string,
  hair: { length: 'cropped'|'short'|'bob'|'shoulder'|'long', texture: 'straight'|'wavy'|'curly'|'coily', color: string, default_state: 'down'|'tucked_behind_ear'|'up'|'pulled_back' },
  face_notes: string,                 // written by Claude from the brief; mature adult structure enforced
  body: string, height_cm?: number,
  hands: { nails: 'natural'|'clear'|'nude'|'soft_pink'|'french'|'short_neutral', notes?: string },
  ears: { lobe_visible: true, other_piercings: 'none'|'single'|'stack' },
  consent: 'original_character'       // v1 only supports invented people; real-person likeness is out of scope
}
```
Outfit: `{ name, description, palette: hex[], neckline: 'v'|'crew'|'scoop'|'sweetheart'|'high'|'turtleneck'|'strapless'|'off_shoulder'|'halter'|'collar_shirt', fabric_finish: 'matte'|'satin'|'knit'|'linen'|'silk', notes }` + optional reference images. Rule table (from jewelry-craft §7): neckline↔necklace compatibility warnings (halter → suggest earrings; turtleneck → long chain), undertone↔metal pairing hint, fabric matte preferred near product.

### 10.2 Identity modes
- `reference_pack` (always available): character sheet + reference pack images are passed as references (role-named in prompt) to every generation; identity drift is checked by QA (`identity_consistency` score vs the sheet).
- `soul_id` (Lane B): after the sheet is approved, train Soul with 8–12 generated views (`talent.soul_train`); later person stills use `text2image_soul_v2 --soul-id`. Video still uses reference packs (Soul is image-only).

### 10.3 Character sheet workflow (job `talent.sheet`)
1. Claude Opus expands the brief into `TalentSpec.face_notes/body` using the slot architecture in docs/research/higgsfield-craft-from-mcp.md ("Character sheet") with the anti-AI realism module, mature adult structure, original character only.
2. Generate sheet A: split-screen (full body standing left, chest-up right), 16:9, 2k, `image.character_sheet`. Owner picks 1 of N variants (default N=4).
3. Generate sheet B from A as reference: turnaround (front, ¾, profile, back) 16:9; sheet C: expression grid; sheet D (jewelry-specific): hands close-up (both hands, relaxed, nails per spec), ear profile left/right with hair tucked, neck/décolletage frontal. Each uses sheet A as ref #1 and says "identical original character".
4. Crop sheets into individual reference images with sharp (fixed layout grid per template) and store `talent_refs` roles. Owner can reject any crop.
5. Optional: outfit sheet per outfit (same character, head-to-toe wardrobe described, 2 views).

---

## 11. Domain: lighting and scene vocabulary (`src/domain/lighting.ts`)

```ts
light_setup:      one_light | key_fill | key_fill_rim | tent_wrap | gradient_panel | sparkle_accent | backlit_glow | window | practical
key_quality:      soft_large | medium | hard_point | mixed_soft_plus_point
key_direction:    top | top_front | top_back | side_left | side_right | front | under | high_45_left | high_45_right
fill:             none | white_card | silver_card | second_soft | ambient
negative_fill:    none | black_card_left | black_card_right | black_card_top | black_gradient_reflection
rim:              none | edge_light | hair_light | double_rim
sparkle:          none | low | medium | high
reflection_style: clean_gradient | environment_reflection | mirror_black | studio_white_wrap
color_temp_k:     2700 | 3200 | 4000 | 4500 | 5000 | 5500 | 6500 | mixed_warm_cool
white_balance:    neutral_locked | warm_bias | cool_bias
mood:             high_key | low_key | studio_clean | window_daylight | golden_hour | blue_hour | overcast | candlelight | neon | moody_spotlight | dappled_shadow
background:       seamless_white | seamless_grey | seamless_black | black_velvet | marble_white | marble_black | travertine | slate | sandstone | concrete | silk | satin | linen | velvet_colored | water_surface | wet_stone | sand | glass | mirror | acrylic_gradient | gradient_paper | foliage | fabric_drape | wood_light | wood_dark | custom
surface_finish:   matte | satin | glossy | textured
lens_mm:          24 | 35 | 50 | 85 | 100 | 135 ;  aperture: f1.4 | f2 | f2.8 | f4 | f5.6 | f8 | f11 | f16
shot_size:        ECU | CU | MCU | MS | MLS | WS ;  angle: eye_level | high | low | top_down | three_quarter_45
```
`LightingSpec = { setup, key_quality, key_direction, fill, negative_fill, rim, sparkle, reflection_style, color_temp_k, white_balance, mood, background, background_custom?, surface_finish }`.

Material rules (`applyMaterialRules(spec, product)`) — applied as defaults and as QA hints: diamond/moissanite → sparkle medium|high, black negative fill, neutral_locked; step cuts (emerald/asscher/baguette) → soft_large key, sparkle low; colored transparent stones → soft key + optional backlit_glow, complementary saturated background; pearls/opals/cabochons → one_light soft, sparkle none|low, side key for luster; yellow/rose gold → warm environment reflections allowed (color_temp 4500–5000 on scene, metal stays true); white_gold/platinum/silver → neutral-grey environment, neutral_locked, no warm cast; enamel → diffused, no hard specular; high_polish → reflection_style clean_gradient required; video → sparkle capped at medium (flicker risk).

Mood presets (seed `presets` table): `studio_packshot`, `black_velvet_luxury`, `marble_morning`, `golden_hour_skin`, `candlelit_gift`, `neon_edit` (flagged: metal color accuracy at risk), `water_reflection`, `botanical_shadows`, plus Higgsfield's product-shot presets `clean-studio`, `dramatic-studio`, `minimal-design`, `luxury-editorial`, `floating-product` (vocabulary in docs/research/higgsfield-craft-from-mcp.md).

Scene spec: `{ format (§13.2 enum), environment: string, props: string[], copy_safe_area?: 'left'|'right'|'top'|'bottom'|'center'|'none', season?: occasion enum, time_of_day? }`.

---

## 12. Prompt compiler (`src/domain/prompt/`)

Deterministic: same inputs → same `PromptBundle`. Claude is used only to (a) write free-text creative sentences for a shot when the shot spec has `free_text`, and (b) critique. The compiler never invents product facts.

### 12.1 Inputs
`{ shot: Shot, product?: ProductSpec+invariants, talent?: TalentSpec+outfit, lighting: LightingSpec, scene: SceneSpec, target: { capability, model_id, lane }, references: ReferenceRole[] }` where `ReferenceRole = { asset_id, role: 'product_primary'|'product_angle'|'product_macro'|'product_sheet'|'talent_identity'|'talent_hands'|'talent_ear'|'outfit'|'style'|'composition'|'source_image'|'mask_preview' }`.

### 12.2 Section order (stills)
Earlier tokens weigh more; keep this order:
1. `[FORMAT]` shot type for channel, aspect, resolution.
2. `[PRODUCT — must match reference images exactly]` structured description (metal/karat/finish → stones → setting with prong count → chain/clasp → dimensions → wear), then invariants list, then "Reference image 1 is the authoritative product; images 2–N show additional angles" (role sentence per reference, in order).
3. `[WEAR / PLACEMENT]` where on the body, contact ("in full contact with skin, ring seated at the base of the finger"), scale sentence from §9.3.
4. `[TALENT]` identity sentence ("identical original character shown in reference images K–M"), age/skin tone (Monk number translated to words, never the number), hair state, nails, wardrobe (palette, neckline, fabric), expression/gesture, anti-AI realism module.
5. `[COMPOSITION]` shot size, angle, placement rule, negative space / copy-safe area, product share of frame (40–60% for closeups).
6. `[LIGHTING]` compiled from `LightingSpec` into photographic language with Kelvin and shadow behavior (vocabulary from docs/research/higgsfield-craft-from-mcp.md), plus material rule sentences.
7. `[CAMERA]` lens mm, aperture, DOF sentence, focus point.
8. `[SCENE]` background surface + finish, environment, props, mood/time.
9. `[STYLE]` craft descriptors only (never photographer or brand names), "commercial jewelry photography, magazine editorial standard".
10. `[QUALITY]` "tack-sharp facets, true metal color, hyper-detailed, photorealistic, no AI artifacts".
11. `[AVOID]` merged negative blocks (universal + anti-uncanny if people + anti-text-warp + jewelry list: "extra stones, extra or missing prongs, duplicated or merged chain links, floating jewelry, plastic sheen, blurry facets, invented hallmarks or engraving, extra or fused fingers, warped jewelry").
12. Model tail: for GPT Image 2.5 / Marketing Studio end with the literal line `resolution: 2k` (or 4k) as Higgsfield's recipes do; for Qwen edit put the AVOID list into `negative_prompt` instead of the prompt; for Nano Banana Pro keep the same text (no negative field).

### 12.3 Templates (`templates/*.ts`), one per shot `format`
`packshot_white`, `hero_still_life`, `macro_detail`, `on_model_beauty_crop` (ear | neck | hand | wrist variants), `lifestyle_editorial`, `flat_lay`, `ghost_mannequin`, `hand_model`, `couples_gifting`, `seasonal`, `social_ugc_tryon` (still frame), `unboxing`, `clean_plate`, `product_sheet`, `character_sheet`, `refine`, `relight`, `outpaint_fill`, `inpaint_region`, `upscale_rerender`. Each template fixes defaults (lens, aperture, shot size, product share, aspect) and the sentence patterns for §12.2. The Higgsfield master prompts (hero, luxury, in-hand, start-frame, macro-glide, light-sweep) are stored verbatim in `templates/higgsfield-masters.ts` and used by `hero_still_life` (variants `hero`, `luxury`), `hand_model` (`in_hand`), `clean_plate`, and the video presets.

### 12.4 Video prompts
Order: `[SHOT]` duration, shot size, one camera move with speed, `[SUBJECT ACTION]`, `[PRODUCT invariants, "in every frame"]`, `[LIGHTING]` (static, "no flicker, stable speculars"), `[SCENE]`, `[MOTION RULES]` ("motion physically plausible, temporal consistency high, edges stable, do not morph/melt/duplicate the product, no new objects"), `[AUDIO]` (silent unless specified), `[END]` ("end on a clean stable frame"). Max ~900 characters for Kling (multi_prompt items ≤512), ≤1500 for Seedance. Start frame = approved keyframe; end frame = next shot's keyframe when `transition_in` is `match_cut` or when the storyboard marks `continuous`.

### 12.5 Model adapters (`compile.ts → ModelParams`)
| target | params produced |
|---|---|
| cloud `marketing-studio/image/flare` | `{prompt, image_urls: [uploaded refs in role order], quality:'high', resolution:'2k'|'4k', aspect_ratio, moderation:'auto', enhance_prompt:false}` |
| cli `gpt_image_2_5` | `--prompt --image <path>... --quality high --resolution 2k --variant flare --aspect_ratio` |
| cli `nano_banana_2` | `--prompt --image <path>... --resolution 2k --aspect_ratio` (≤14 refs) |
| cli `seedream_v4_5` | `--prompt --image... --quality high --aspect_ratio` |
| cloud `alibaba/qwen-image-3/edit` | `{prompt, image_urls (≤3), negative_prompt, resolution:'2k', aspect_ratio, seed?}` |
| cloud `higgsfield-ai/soul/v2/standard` | `{prompt, aspect_ratio, resolution:'1080p', batch_size:1|4, enhance_prompt:false, seed?}` |
| cloud `kling-video/v3.0/pro/image-to-video` | `{prompt, image_url, last_image_url?, duration, sound:'off', cfg_scale:0.5}` |
| cloud `bytedance/seedance-2.0/image-to-video` | `{prompt, image_url, end_image_url?, duration, resolution:'1080p'|'4k', generate_audio:false}` |
| cloud `bytedance/seedance-2.5/reference-to-video` | `{prompt, image_urls, duration, resolution:'720p', aspect_ratio, bitrate_mode:'high', generate_audio:false}` |
| cloud `kling-video/o3/image-reference` | `{prompt, image_urls, first_frame_url?, last_frame_url?, mode:'pro', duration, aspect_ratio, sound:'off', shot_type:'customize', multi_shots:false}` |
| cloud `bytedance/seedance-2.5/video-extend` | `{prompt, video_url, duration, resolution:'720p', generate_audio:false}` |
| cloud `higgsfield/genjutsu/object-swap/v1.0` | `{prompt, video_url, image_urls (≤8), resolution:'720p'}` |
Aspect ratios are validated against each endpoint's enum (Appendix A); unsupported → nearest supported + note on the generation row.

### 12.6 `PromptBundle` (persisted on shot + generation)
`{ prompt_text, negative_text?, sections: Record<string,string>, references: ReferenceRole[], model_params, compiler_version, warnings: string[] }`. The UI shows sections as editable blocks; a manual edit sets `shot.spec.prompt_override` and the compiler keeps it until the owner clicks "Recompile".

---

## 13. Creative director (Claude) contracts

### 13.1 `CampaignBrief`
```ts
{ goal: string, channels: ChannelId[], tone: string[], must_include: string[], must_avoid: string[],
  references_text?: string, hero_products: productId[], talent?: talentId[], occasion?: occasion, locale?: string,
  deliverables: { stills?: number, videos?: { count: number, duration_s: 6|10|15|20|30 }[] }, budget_usd?: number }
```

### 13.2 `Shot` (still)
```ts
{ id, title, format: 'packshot_white'|'hero_still_life'|'macro_detail'|'on_model_beauty_crop'|'lifestyle_editorial'|'flat_lay'|'ghost_mannequin'|'hand_model'|'couples_gifting'|'seasonal'|'social_ugc_tryon'|'unboxing',
  crop?: 'ear'|'neck'|'decolletage'|'hand'|'wrist'|'face_34'|'half_body'|'full_body',
  purpose: string, product_ids: string[], talent_id?, outfit_id?, lighting: LightingSpec, scene: SceneSpec,
  camera: { lens_mm, aperture, angle, shot_size, focus: 'product'|'face'|'rack' }, aspect: '1:1'|'4:5'|'3:4'|'2:3'|'9:16'|'16:9',
  free_text?: string, variants: number (default 4), channels: ChannelId[], priority: 1|2|3,
  prompt_override?: string, qa_focus: ('prong_count'|'stone_shape'|'metal_color'|'chain_geometry'|'clasp'|'placement'|'scale'|'hands'|'identity'|'text')[] }
```
`ShotList = { rationale: string, shots: Shot[], open_questions: string[] }`. Claude returns 6–16 shots sized to `deliverables.stills`, every shot citing a product id from the brief (validated; unknown ids → job fails with a clear error and the raw output saved).

### 13.3 `Storyboard` (video)
```ts
{ title, duration_s, structure: 'reveal_6s'|'detail_10s'|'lifestyle_15s'|'ugc_20s'|'gifting_30s'|'turntable_loop'|'custom', aspect: '9:16'|'1:1'|'16:9',
  music: { mood: string, bpm_hint?: number, source: 'owner_upload'|'none' }, end_card: { copy?: string, logo_asset_id?: string, duration_s: 1.5 },
  shots: [{ id, order, duration_s (2–8), shot_size, angle, camera_move: enum (docs/research/jewelry-craft.md §6.2), move_speed: 'slow'|'medium', lens_mm, aperture, focus,
            lighting: LightingSpec, scene: SceneSpec, subject_action: string, product_placement: { product_id, visibility: 'full'|'partial'|'reveal', wear? },
            talent_id?, outfit_id?, invariants: string[], transition_in: 'cut'|'dissolve'|'match_cut'|'whip'|'light_flare'|'fade', transition_out,
            audio_cue: string, text_overlay?: { copy, position: 'top'|'center'|'bottom', in_s, out_s }, continuous_with_next: boolean,
            keyframe_prompt_hint: string, video_prompt_hint: string, qa_flags: string[] }] }
```
Rules Claude must follow (in the system prompt): one motion idea per shot; luxury = slow; shots 2–8 s (model limits 3–15 s, clips generated at the shot length rounded up to the model's minimum and trimmed in assembly); sparkle ≤ medium; product visible in every shot unless `visibility:'reveal'`; total duration matches `deliverables`.

### 13.4 System prompt contents (frozen file `src/providers/claude/prompts/craft.md`, cached)
Compiled from docs/research: jewelry taxonomy and how each type is worn/framed; campaign formats and shot lists; lighting craft and vocabulary; AI failure modes; video structures and camera moves; casting rules; Higgsfield prompt conventions (specific over generic, Kelvin, lens, no names); the JSON contracts above; and the hard rules (never invent product details; use only ids provided; respect must_avoid; original characters only).

### 13.5 Other director tasks
- `prompt_assist`: given a shot with `free_text`, return the three creative sentences (`subject_action`, `scene_detail`, `mood_line`) — nothing structural.
- `critique`: owner asks "why does this look off?" on a candidate → Claude (Haiku, or Opus on request) returns `{ issues: [{kind, where, fix_prompt}] }` using the refinement fix-language in docs/research/higgsfield-craft-from-mcp.md; one click turns a fix into an `edit.refine` job.
- `brief_parse`: pasted client email/brief → `CampaignBrief` draft.

---

## 14. Workflows (step by step, as the worker and UI execute them)

### 14.1 Project + product intake (M2)
1. Create project (name, client, brand notes, palette, default channels).
2. Add product: drag images (jpg/png/webp/heic→converted by sharp), fill `ProductSpec` form (category first; subtype and fields adapt), assign reference roles. Derived invariants shown as chips; owner edits.
3. Click "Prepare references": enqueues `product.clean_plate` for the primary ref (+ others optional) and `product.sheet`. Results appear in the product page; owner approves sheet frames.
4. Product card shows: spec summary, refs, plates, sheet, invariants, "reference set for generation" (ordered list used by every later shot).

### 14.2 Talent creation (M3)
1. "New person": brief text + casting fields (§10.1) + optional outfits. Claude expands notes.
2. Sheet A variants → pick → sheets B/C/D → crops → approve refs. Optional Soul training (Lane B) shows status chip.
3. Talent page: identity refs, outfits, "locked features" list (face, hair, skin tone, nails) used in QA.

### 14.3 Image campaign (M4)
1. New campaign (kind image): brief form (§13.1) + products + talent/outfit + style references (upload or paste text), defaults (variants per shot=4, model routing, lighting preset, aspect per channel, budget).
2. "Plan shots" → `director.shot_list` → shots appear as cards with compiled prompt preview and estimate per shot (variants × unit price). Owner edits any field, reorders, deletes, adds manual shots, approves (bulk or per shot). Status `shots_pending_approval` → `generating` when "Generate approved" is clicked (one `fanout.await` parent with a `gen.image` child per shot).
3. Each `gen.image`: compile → upload refs (cache) → estimate → ledger → submit → poll → download N candidates → thumbs → `qa.image` batch.
4. Review board (§15.4): grid of candidates per shot with QA score and flags; approve/reject/flag/maybe; compare any two; zoom to 200%; "Refine" opens the refinement dialog (pick one issue → `edit.refine` with the fix language; max 2 refinements per candidate lineage, enforced); "More variants" re-runs the shot with a new seed; "Change lighting" opens the lighting editor and re-generates.
5. Approved candidate becomes `shot.selected_asset_id`. "Finalize": optional `image.upscale` per selected (4k for print/web hero), then `export.run` per channel (§18). Campaign status `done`. Exports folder opens in Finder/Explorer (`shell.openPath` equivalent: `open`/`explorer` spawn).

### 14.4 Video campaign (M5)
1. Brief (kind video, with durations) → "Storyboard" → `director.storyboard` → storyboard view: shot cards in order with duration, move, lighting, action; drag to reorder (`@dnd-kit`), edit any field, split/merge, add/delete, set transitions, mark `continuous_with_next`. Approve storyboard → shots rows.
2. Keyframes: for each shot enqueue `gen.image` using the shot's still template (format derived: `macro_detail` → macro template, talent shots → `on_model_beauty_crop` etc.) with `variants=3`; review board per shot; approve one keyframe per shot (`shot.keyframe_asset_id`). Cost gate: shows total estimate for keyframes and clips before each stage.
3. Clips: for each shot choose capability automatically: talent or multi-product identity → `video.generate.r2v` (Seedance 2.5 r2v with keyframe + product refs + talent refs, or Kling O3 image-reference with `first_frame_url`=keyframe); product-only → `video.generate.i2v` (Kling 3.0 Pro with `image_url`=keyframe and `last_image_url`=next keyframe when `continuous_with_next`); Higgsfield preset moves (macro_glide, light_sweep, product_spin…) → `video.generate.product_preset`. Duration = shot duration rounded up to model minimum (Kling ≥3, Seedance ≥4). Variants default 2. After download: extract first/last frames; `qa.video`.
4. Review clips (player with frame-step, loop, A/B); approve → `shot.clip_asset_id`. "Extend" / "Object swap" / "Regenerate from last frame" available per clip (§8.4).
5. Assemble: timeline auto-built from approved clips in storyboard order (§17.1): trims to shot duration, transitions from storyboard, music (owner upload, trimmed with fades), text overlays, end card (logo asset + copy on brand background). Preview render at 540p (fast), final at delivery resolution. Export per channel.

### 14.5 Lighting control (everywhere)
Lighting editor component: visual pickers for every `LightingSpec` field with a live sentence preview of the compiled `[LIGHTING]` block and material-rule warnings. Available on shot cards, storyboard cards, the refine dialog ("Relight") and as saved presets.

### 14.6 Editing operations (M6)
- Inpaint: mask brush (react-konva) over the image at native resolution; export mask PNG (white = edit). Lane B: `gpt_image_2 --is_inpaint true --mask` with the instruction. Lane A: (1) make a preview with the mask outlined in red on a copy (ref #2) and the original (ref #1); (2) `image.edit.refine` with "Only change the region outlined in red in image 2: <instruction>. Everything else identical to image 1"; (3) sharp: feather mask 12 px, alpha-composite result over original inside mask only; (4) QA diff outside mask must be ≈0 (gate) else mark "review".
- Outpaint: target aspect → local pad with mirrored+blurred borders → refine with "replace the soft blurred border areas with a natural continuation" → composite original center back → QA.
- Relight: lighting editor → `image.edit.relight` (refine with lighting block + invariants; optional product mask protection via the inpaint composite in reverse: keep product pixels from the original).
- Cutout / clean plate: as §8.4.
- Upscale: as §8.4 with SSIM gate for the generative path; UI shows "basic" vs "generative" vs "Topaz".
- Reframe (video): local ffmpeg crop with a focal-point keyframe editor (2+ points, linear interpolation) or Lane B reframe.
- Extend (video): Seedance 2.5 video-extend; or "continue from last frame" (i2v from last frame + concat with 6-frame crossfade).
- Object swap (video): Genjutsu object-swap with product refs (swap a placeholder ring for the real one, or change talent).
- Crop/adjust (local, non-AI): crop to aspect with focal point, exposure/contrast/saturation/white balance sliders via sharp (`modulate`, `linear`, `tint`), export as new version.
- Every edit creates a new asset version with `parent_asset_id`; the asset drawer shows the lineage and a before/after slider.

---

## 15. UI

Design language and quality bar are specified in §28 (design system, motion, states, polish checklist); resumability rules in §27. Tailwind 4 + shadcn (installed via CLI into `src/components/ui`). Keyboard-first review. All screens are client components fed by TanStack Query; SSE updates `queryClient.setQueryData`.

### 15.1 Routes (`app/(studio)/...`)
| Route | Screen |
|---|---|
| `/` | Projects home: "Continue where you left off" hero card (last project, last screen, last touched asset, running jobs), recent projects row, all projects grid (cover image = latest approved asset, client, status, spend, last opened), search, archive toggle, provider status chips (Cloud OK / CLI logged-in or "login needed" / Claude OK). |
| global | Project switcher in the top bar (`⌘/Ctrl+P`) and command palette (`⌘/Ctrl+K`, cmdk) listing projects, campaigns, products, talent, recent assets and actions; switching restores that project's last location (§27.2). |
| `/settings` | Keys status (never shows values), lane availability + probe results, model routing per capability, concurrency, daily cap, DATA_DIR, binaries, "Run doctor". |
| `/projects/[id]` | Project overview: products, talent, campaigns, recent assets, spend. |
| `/projects/[id]/products/[productId]` | Product spec form (§9), refs with roles, plates, sheet, invariants chips, generation history for this product. |
| `/projects/[id]/talent/[talentId]` | Talent spec, sheets, reference pack, outfits, Soul status, identity QA samples. |
| `/projects/[id]/campaigns/[campaignId]` | Campaign hub: brief, products, talent, refs, status stepper (Plan → Approve shots → Generate → Review → Finalize [→ Keyframes → Clips → Assemble] → Export). |
| `.../campaigns/[campaignId]/shots` | Shot planner (image) — cards with prompt preview, estimate, lighting chip, approve toggle, bulk actions. |
| `.../campaigns/[campaignId]/storyboard` | Storyboard editor (video) — sortable cards, durations sum, transitions, continuous links, "Generate keyframes". |
| `.../campaigns/[campaignId]/review` | Review board (§15.4). Query params `?stage=keyframes|clips|stills`. |
| `.../campaigns/[campaignId]/assemble` | Timeline assembler (§15.5). |
| `.../campaigns/[campaignId]/exports` | Export matrix: channels × selected assets, status, open folder. |
| `/projects/[id]/library` | Virtualized gallery of all project assets with filters (role, status, score, model, shot, product, talent, tag, date), bulk tag, bulk export. |
| `/assets/[assetId]` (drawer, not page) | Asset drawer: zoomable viewer / player, metadata, prompt bundle, references used, QA report, lineage, actions (refine, inpaint, outpaint, relight, upscale, crop, cutout, export, open file). |
| `/jobs` | Job monitor: running/queued/failed with progress, logs, cancel, retry; ledger table. |

### 15.2 Shared components
`ImageDropzone` (multi, HEIC→JPEG via sharp server-side), `ProductSpecForm` (RHF+zod, category-driven), `LightingEditor`, `SceneEditor`, `PromptBundleView` (sections editable, "recompile"), `EstimateBadge` (usd or credits, refreshes on param change), `CandidateGrid` (react-virtuoso grid), `CandidateCard` (thumb, score ring, flags, review state, hover actions), `CompareDialog` (react-compare-slider, images or videos), `ZoomViewer` (react-zoom-pan-pinch, 100%/200%/fit buttons), `MaskBrush` (react-konva, brush size, eraser, invert, export PNG at source size), `VideoPlayer` (media-chrome, frame-step ←/→, loop, A/B toggle), `StoryboardCard` (dnd-kit sortable), `TimelineStrip`, `JobToast` (sonner, progress), `CapabilityBadge` (active implementation + degraded note), `CostLedgerTable`.

### 15.3 Keyboard map (review board)
`J/K` or `←/→` next/prev candidate · `A` approve · `X` reject · `F` flag · `M` maybe · `C` compare with last approved · `Z` toggle 200% zoom at cursor · `R` refine dialog · `L` relight · `I` inpaint · `Space` play/pause (video) · `,` `.` frame step · `Esc` close drawer · `1–5` quick-filter by score bucket.

### 15.4 Review board behavior
- Grouped by shot; each group shows the shot's purpose, compiled prompt (collapsible), estimate spent, QA summary (pass/retry/review counts).
- Filters: review state, QA verdict, score ≥ N, flags (prong_count, metal_color, hands…), model, lane, date. Sort: score, newest, manual.
- Candidate card shows: QA score ring (0–10), top 2 issues as chips, lane/model, seed, cost. Click → drawer.
- Bulk: approve best-scored per shot, reject all below N, re-run rejected with "more variants".
- Rejection reasons (optional chips) feed the project's "learned avoids" list that the compiler appends to AVOID for that product (max 8 phrases).

### 15.5 Assembler screen
Top: preview player. Middle: horizontal strip of clips in order (dnd sortable), each with duration, trim handles (in/out), transition picker between clips (cut, fade, dissolve, wipeleft, smoothleft, circleopen; duration 0.25–1 s), text overlay toggle (copy, position, in/out, font, size, color), end card toggle. Side: music (upload, trim offset, volume, fade in/out, duck under clip audio or replace), output preset (channel → size/fps/bitrate), "Preview 540p" and "Render final". Timeline JSON (§17.1) is the saved state.

---

## 16. HTTP API (`app/api/**/route.ts`; JSON; zod-validated; errors `{error:{code,message,details?}}`)

| Method & path | Purpose |
|---|---|
| `GET /api/health` | versions, lanes availability, DB ok, binaries ok |
| `GET /api/capabilities` | resolver output: per capability the active implementation + alternates + degraded note |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` | CRUD (delete = archive) |
| `POST /api/projects/:id/assets` (multipart, streamed to tmp) → `202 {job_id, asset_ids[] pending}` | ingest via `asset.ingest` |
| `GET /api/assets/:id`, `PATCH` (tags, note), `GET /api/assets?project_id&filters` | asset metadata/list |
| `GET /api/media/[...path]` | Range-capable file streaming with traversal guard (docs/research/tech-stack.md §11); `HEAD` supported |
| `GET /api/media/thumb/:assetId?w=` | lazy webp thumb |
| `GET/POST /api/projects/:id/products`, `GET/PATCH /api/products/:id`, `POST /api/products/:id/refs`, `POST /api/products/:id/prepare` | product + plates/sheet jobs |
| `GET/POST /api/projects/:id/talent`, `GET/PATCH /api/talent/:id`, `POST /api/talent/:id/sheet`, `POST /api/talent/:id/soul`, `POST /api/talent/:id/outfits` | talent |
| `GET/POST /api/projects/:id/campaigns`, `GET/PATCH /api/campaigns/:id` | campaign |
| `POST /api/campaigns/:id/plan` (image) / `POST /api/campaigns/:id/storyboard` (video) | director jobs |
| `GET /api/campaigns/:id/shots`, `PATCH /api/shots/:id` (spec, order, approved), `POST /api/shots` (manual), `DELETE /api/shots/:id` | shots |
| `POST /api/shots/:id/compile` → PromptBundle + estimate | dry run |
| `POST /api/shots/:id/generate {variants?, capability?, model_id?, seed?}` → `202 {job_id}` | one shot |
| `POST /api/campaigns/:id/generate {stage:'stills'|'keyframes'|'clips', shot_ids?}` → `202 {parent_job_id, estimate_total}` | fan-out |
| `GET /api/campaigns/:id/candidates?stage&filters`, `PATCH /api/candidates/:id {review, note}`, `POST /api/candidates/:id/select` | review |
| `POST /api/edits {op, source_asset_id, params, mask_asset_id?}` → `202 {edit_id, job_id}`; `GET /api/edits/:id` | editing |
| `GET/PUT /api/campaigns/:id/timeline`, `POST /api/campaigns/:id/render {preview:boolean}` | assembler |
| `POST /api/campaigns/:id/exports {channel_ids[], asset_ids[]}`, `GET /api/exports?campaign_id` | export |
| `GET /api/jobs?status`, `GET /api/jobs/:id`, `POST /api/jobs/:id/cancel`, `POST /api/jobs/:id/retry`, `GET /api/jobs/:id/events` | jobs |
| `GET /api/events?since=` (SSE) | live updates for all jobs |
| `GET /api/ledger?project_id&from&to`, `GET /api/ledger/summary` | cost |
| `GET/PUT /api/settings`, `POST /api/settings/probe` | settings + probes |
| `GET/POST/DELETE /api/presets` | presets |
| `POST /api/director/critique {candidate_id}`, `POST /api/director/brief-parse {text}` | director utilities |

Every `202` returns a job id; the client subscribes via SSE and updates the Query cache; a `refetchInterval: 5000` safety net remains on list queries.

---

## 17. ffmpeg assembler

### 17.1 `Timeline` JSON
```ts
{ version: 1, output: { width, height, fps: 30, channel_id?: ChannelId },
  clips: [{ asset_id, in_s, out_s, fit: 'cover'|'contain', transition_in?: { type, duration_s }, overlays?: [{ kind:'text', copy, font:'Inter-SemiBold', size_px, color, position, in_s, out_s, bg?:{color,opacity} }], speed?: 1 }],
  end_card?: { duration_s, bg_color, logo_asset_id?, copy?, fade_in_s: 0.3 },
  music?: { asset_id, offset_s, volume: 0.8, fade_in_s: 1, fade_out_s: 2, mode: 'replace'|'duck'|'mix' },
  keep_clip_audio: boolean }
```

### 17.2 Render pipeline (`handlers/ffmpeg.render.ts`)
1. Probe all inputs. 2. Normalize each clip to output `W×H`, 30 fps, `yuv420p`, SAR 1 (`scale=W:H:force_original_aspect_ratio=increase,crop=W:H` for cover; `decrease,pad` for contain), trimmed with `-ss/-to` re-encode into `tmp/<render>/clip<i>.mp4` (CRF 16, fast). Text overlays burned per clip with `drawtext` (`fontfile` from `assets/fonts`, `textfile=` UTF-8, escaped path on Windows) or, when the overlay has a background box or non-Latin text, render a transparent PNG with sharp and `overlay` it. 3. End card rendered with sharp to PNG → `-loop 1 -t d` clip. 4. Join: if every transition is `cut` → concat demuxer; else chain `xfade` pairwise with computed offsets (durations from ffprobe, `offset = cumulative − accumulated fade`), `acrossfade` for audio when clips have audio. 5. Music: `atrim`, `afade in/out`, `volume`; `mode:'replace'` maps only music; `'duck'` uses `sidechaincompress` on music keyed by clip audio; `'mix'` `amix=inputs=2:duration=first`. 6. Final encode `-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k`; preview uses 540p and `-preset veryfast -crf 24`. 7. Progress from `-progress pipe:1` relative to total duration. 8. Poster frame `-ss 0.5 -frames:v 1`.

### 17.3 Frame utilities
First frame: `-frames:v 1 -update 1`. Last frame: `-sseof -0.1 -i in.mp4 -update 1 -frames:v 1`. Contact sheet (QA): `select='not(mod(n,FR))',scale=320:-2,tile=3x2`. Ken Burns for stills in a video timeline: `zoompan` (docs/research/tech-stack.md §4.3).

### 17.4 Reframe (local)
Given focal keyframes `[{t, x, y}]` (normalized), compute per-frame crop window with `crop=w:h:x(t):y(t)` using `ffmpeg` expressions with linear interpolation between keyframes (`lerp` via `if(lt(t,t1), x0+(x1-x0)*(t-t0)/(t1-t0), ...)`), then scale to target. Fallback when no keyframes: center crop.

---

## 18. Delivery channels (`src/domain/delivery.ts`, editable in Settings)

| ChannelId | aspect | px | video | notes/safe zone |
|---|---|---|---|---|
| `ig_feed_45` | 4:5 | 1080×1350 | ≤60 s | center-safe |
| `ig_feed_11` | 1:1 | 1080×1080 | — | |
| `ig_reels` | 9:16 | 1080×1920 | ≤90 s default | text out of top 14%, bottom 35%, sides 6% |
| `ig_story` | 9:16 | 1080×1920 | ≤15 s per card | same |
| `tiktok` | 9:16 | 1080×1920 | 9–34 s sweet spot | avoid top 150 px, right 120 px, bottom 400 px |
| `yt_shorts` | 9:16 | 1080×1920 | ≤180 s | bottom 15% clear |
| `pinterest_pin` | 2:3 | 1000×1500 | 6–15 s | |
| `meta_ad_feed` | 4:5 / 1:1 | 1080×1350 / 1080×1080 | ≤60 s | |
| `meta_ad_story` | 9:16 | 1080×1920 | ≤60 s | 14/35/6 |
| `web_hero` | 16:9 (+ mobile 4:5 crop) | 2560×1440 / 1080×1350 | ≤20 s loop, muted | focal point centered |
| `email_hero` | 2:1 | 1200×600 | — | <200 KB jpg q80 |
| `print_a4_300` | 1:1.414 | 2480×3508 | — | export RGB TIFF/PNG + 3 mm bleed variant; CMYK out of scope |
| `master` | native | native | native | untouched copy |

Export job: image → sharp resize with focal-point crop (default center; per-asset focal point editable), format/quality per channel, safe-zone overlay preview in UI before export; video → ffmpeg normalize to channel size (cover with focal point) and duration cap warning. Filenames `<project>_<campaign>_<shot>_<channel>_<v>.<ext>`.

---

## 19. QA and filtration

### 19.1 Flow
Every candidate: local checks (§19.2) → Haiku rubric (§19.3) → `qa_score` (0–10) and `verdict` → review state stays `unreviewed` (QA informs; the owner decides). Thresholds (Settings): auto-flag `< 5`, highlight `≥ 8`.

### 19.2 Local checks (sharp/ffprobe, no cost)
- Resolution/aspect match request; file integrity; duplicate (sha256) detection.
- Metal hue check: mean hue/saturation of the product region (rough region = center crop for packshots; skipped for on-model shots) vs the plate's; flag `metal_color` if hue delta > 12° on gold or saturation > 0.12 on white metals.
- Edit gates: outside-mask diff ≈ 0 for inpaint; center diff ≈ 0 for outpaint; SSIM ≥ 0.85 for generative upscale.
- Video: frame count/duration, first/last frames extracted, luminance flicker metric (std-dev of mean luminance deltas over frames > threshold → `sparkle_flicker`).

### 19.3 Haiku rubric (`QAResult`)
Input: product plate (ref #1), product sheet frame(s), talent identity ref (if any), then up to 6 candidates, then the invariants list and shot purpose. Output per candidate:
```ts
{ candidate_index, score: 0..10, product_fidelity: 0..10, brief_adherence: 0..10, technical: 0..10, identity_consistency?: 0..10,
  defects: [{ kind: 'prong_count'|'extra_stone'|'missing_stone'|'stone_shape'|'metal_color'|'chain_geometry'|'clasp'|'placement'|'scale'|'contact_float'|'hands'|'face'|'text_artifact'|'lighting_mismatch'|'plastic_sheen'|'blur'|'composition'|'other', where: string, severity: 'minor'|'major', fix_prompt: string }],
  verdict: 'pass'|'retry'|'review', one_line: string }
```
For video: same on a 6-frame contact sheet with `temporal_consistency` and `morph` defects. On `stop_reason:'refusal'` → verdict `review`, no retry.

### 19.4 Filtration
Filters in review board + library are server-side (`/api/campaigns/:id/candidates` query params) so they work on thousands of rows. Saved filter views per campaign. "Learned avoids" (§15.4).

---

## 20. Cost control
- Estimate before every paid job; displayed in the confirm dialog with lane and model. Fan-outs show the total.
- Ledger row per job with estimate; actual when known (Cloud: estimate reconciled is not retrievable → actual = estimate unless the status response carries cost; CLI: credits from `generate cost` + `account` delta when available).
- `DAILY_SPEND_CAP_USD`: the worker refuses to submit when today's ledger sum + estimate exceeds the cap (job fails with `cap_exceeded`; the owner can raise the cap in Settings). Credits count as $0 toward the USD cap but have their own optional daily credit cap.
- Dashboard: today/month per lane, per project, per model; top 10 most expensive shots.

---

## 21. Testing
- Unit (vitest): taxonomy validation, size tables, invariants derivation, lighting material rules, prompt compiler golden files (one per template × model; snapshot the `PromptBundle`), timeline→filtergraph builder (string snapshots), delivery resizing math, CLI output parser against recorded fixtures, cloud client against msw (submit/poll/complete, 400 concurrency retry, 422 permanent, upload flow, idempotency reuse).
- Integration: queue claim atomicity (two workers on one tmp DB), retry/backoff, cancel, crash sweep with provider id resume; ffmpeg render of synthetic `testsrc` clips with xfade + music + drawtext → ffprobe asserts; sharp composite gates.
- E2E (Playwright, `MOCK_PROVIDERS=1` swaps both lanes and Claude for fixture implementations that return bundled sample images/clips): create project → product → prepare → campaign → plan → approve → generate → review → finalize → export; video path through assemble.
- Live smoke (manual, `pnpm doctor --live`): one `/estimate`, one cheapest Soul 2 image ($0.004), one `kling-video/v3.0-turbo` 3 s clip, one Haiku QA; CLI `account status`, `model get nano_banana_2`.

---

## 22. Milestones and acceptance criteria

**M0 Foundation** — scaffold, env, DB + migrations, DATA_DIR, media route with Range, queue + worker + SSE, jobs page, settings page, doctor script, design system shell (§28: tokens, fonts, app frame, top bar with project switcher and command palette, toast system, skeleton and empty-state primitives), resume store (§27.2). Done when: the §28 polish checklist passes on the shell and settings screens; `pnpm dev` runs both processes; uploading a file creates an asset with thumb; a dummy job emits progress visible live; `pnpm test` green; Range request on an mp4 returns 206.

**M1 Providers** — cloud client (+msw tests), CLI adapter (+fixture tests), Claude client (+cached system block test asserting `cache_read_input_tokens>0` on second call in live mode), capability registry + `/api/capabilities`, estimate + ledger + cap, probe job writing `docs/probes/*.md`. Done when: live smoke passes on the owner's Mac with real keys; API-only mode (CLI logged out) shows every capability available except `video.cutout`.

**M2 Products** — spec form, refs, invariants, clean plate, product sheet, product page. Done when: a real ring produces an approved 4-frame sheet and an invariants list the owner accepts.

**M3 Talent** — talent spec, sheets A–D, crops, outfits, optional Soul. Done when: a person created from a 2-line brief yields a reference pack and an on-model ear/hand test still keeps identity (QA identity ≥ 7).

**M4 Image campaigns** — brief, shot list, planner, generation fan-out, QA, review board with keyboard map, refine loop, upscale, export. Done when: the §27.4 resume test passes (quit mid-generation, relaunch, switch projects twice, return: nothing lost, jobs finished); every M4 screen passes the §28 checklist; a 10-shot campaign runs end to end with ≤ 1 manual intervention per failure class, exports land in the channel folders with correct sizes, ledger matches estimates.

**M5 Video campaigns** — storyboard, editor with reorder, keyframes, clips (i2v, r2v, flf, presets), video QA, assembler, render, export. Done when: a 15 s 9:16 reel with 4 shots, music and end card renders at 1080×1920 with xfade transitions and plays in Safari and Chrome.

**M6 Editing** — inpaint (both lanes), outpaint, relight, cutout/clean plate, upscale (3 paths), reframe, extend, object swap, crop/adjust, versions, compare. Done when: each op has a unit/integration test and a live example in the demo project.

**M7 Library, cost, hardening** — library filters, presets, learned avoids, cost dashboard, critique/brief-parse, project archive/duplicate/export-bundle/import-bundle and backups (§27.3), Windows pass (install, paths, drawtext font escaping, CLI `.cmd`), error copy review, full §28 design audit across all screens, README with setup steps. Done when: a project bundle exported on Mac imports on Windows and resumes; fresh clone on Windows reaches M4 acceptance; `pnpm build && pnpm start` serves standalone on both OSes.

Each milestone ends with a commit `feat(Mx): ...` and a short `docs/progress/Mx.md` (what works, what was deferred, live-test evidence).

---

## 23. Desktop option (later, not v1)
Keep: no edge runtime; all paths from `DATA_DIR`; bind 127.0.0.1 with configurable port; `output: standalone`; worker started by the same supervisor; explicit SIGTERM handling that kills ffmpeg/CLI children. Then Electron 44 (lower risk) or Tauri 2 with Node sidecar can wrap it. Store keys in the OS keychain at that point.

---

## 24. First-run probes and known unknowns (resolve in M1; write results to `docs/probes/`)
1. **Cloud rate limit / concurrency** for the owner's account: submit 6 cheap Soul 2 jobs at once; record first 400 "concurrency" if any; set `WORKER_CONCURRENCY_PROVIDER` accordingly (default 4).
2. **Legacy Cloud endpoints**: `POST /estimate/nano-banana-pro`, `/estimate/bytedance/seedream/v4/text-to-image`, `/estimate/flux-pro/kontext/max/text-to-image`; a 404 means absent. If any exist, add them to `endpoints.ts` and the registry as higher-priority Lane A implementations.
3. **Cloud response shapes**: record a real `completed` body for an image and a video endpoint; confirm `images[].url` / `video.url`.
4. **Webhook** not used (local app). Skip.
5. **CLI JSON shapes**: `generate create ... --wait --json`, `generate get --json`, `upload create --json`, `generate cost --json`, `account status --json`, `soul-id create --json`; store verbatim samples; make `parse.ts` strict for them.
6. **CLI token lifetime**: record how long a login lasts in practice; the Settings page shows "last successful CLI call" and a "Login needed" banner when `auth status` fails. Consider a periodic `auth status` check every 30 min while the worker runs.
7. **CLI utility schemas**: `model get` for `topaz_image`, `bytedance_image_upscale`, `video_upscale`, `topaz_video`, `image_background_remover`, `outpaint`, `gpt_image_2` (mask shape), `reframe` workflow.
8. **Seedance 2.5 Cloud resolution** is 480p/720p only; 1080p/4K product video must route to Seedance 2.0 (4k) or Kling 3.0 4k / O3 4k. Confirm pricing via `/estimate`.
9. **Marketing Studio Image presets**: `GET /marketing-studio/image/presets` — list and store; optional "Higgsfield preset mode" (`enhance_prompt:true, preset_id, image_urls:[product, person?]`) as an extra implementation of `image.generate.product`.
10. **@imgly/background-removal-node license**: read `LICENSE.md` in the package before adding it; if not acceptable, remove the local cutout implementation (clean plate remains).
11. **Anthropic**: confirm model ids `claude-opus-5-5`, `claude-haiku-5-5` respond; structured outputs via `messages.parse`; prompt caching minimum (512 tokens assumed) by asserting cache reads.
12. **Stretch (Lane B only)**: `text2speech_v2` and `sonilo_music` for VO/music; add as `audio.*` capabilities after M7 if the owner asks.

---

## 25. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Product drift (prongs, stones, chain) | invariants in every prompt; multi-angle refs + sheet; QA rubric; refine loop; "learned avoids"; plates not raw photos as ref #1 |
| CLI session expiry mid-batch | per-job PermanentError with clear instruction; registry falls back to Lane A; banner in UI; probe records lifetime |
| Double charging | idempotency keys; persist provider id before polling; crash sweep resumes by id |
| Expired provider URLs | immediate download; never reference provider URLs in UI |
| Windows path/escaping bugs | path helpers; drawtext via PNG overlay when text has special chars; CI-like checklist in M7 |
| ffmpeg "input link parameters do not match" | normalize every clip before xfade/concat (§17.2) |
| Claude refusal/parse failure | guard `stop_reason`, save raw, retry once with simplified brief, surface error |
| Cost runaway | estimates, confirm dialogs, daily cap, ledger |
| Model catalog changes | endpoints/ids live in one table (`endpoints.ts`, `models.ts`) + Settings overrides; probes on startup |

## 26. Glossary
Lane A = Higgsfield Cloud API (`api.higgsfield.ai`). Lane B = Higgsfield consumer CLI (`higgsfield`). Plate = product on seamless background. Sheet = multi-view generated reference set. Candidate = one generated output. Keyframe = approved still that seeds a clip. Invariants = product facts that must hold in every render. Capability = app-level operation resolved to a lane implementation.

---

## 27. Projects: save, stop, resume, switch

Goal: the owner can close the laptop mid-campaign, come back a week later, or hop between three client projects in one afternoon, and every project is exactly where it was left. There is no Save button anywhere in the app.

### 27.1 Persistence rules
- **Source of truth is the database and `DATA_DIR`, never React state.** Every mutation goes through a Route Handler and lands in SQLite before the UI confirms it (optimistic update in TanStack Query, rolled back on failure with a toast).
- **Drafts persist on change.** Brief forms, product spec forms, talent specs, storyboard edits (text, order, durations, transitions), timeline edits (trims, overlays, music), lighting editor values, prompt-section edits, filter views, and review notes are written with a debounced `PATCH` (≤ 500 ms) and also flushed on `beforeunload`/`visibilitychange`. Half-filled forms are valid draft states: campaigns have `status:'draft'` and store partial `brief_json`; validation only gates the "Plan" / "Generate" actions, not saving.
- **Autosave indicator.** The top bar shows "Saved" / "Saving…" / "Offline — retrying" (server unreachable) derived from the mutation queue; failed writes are retried with backoff and never silently dropped (queued mutations live in `localStorage` only as a crash buffer and are replayed on reload).
- **Versioned documents.** Storyboards and timelines keep a `revisions` history (table `doc_revisions { id, doc_type, doc_id, revision, data_json, created_at }`, last 50 per doc) so "Revert to the version before I reordered everything" is one click.
- **Jobs are project-scoped and durable.** The worker keeps running jobs for every project regardless of which project is open; the Jobs page and the per-project hub both show them. Restarting the app resumes polling by provider request id (§7.1). A job's outputs are attached to their shot/product/talent rows, so returning to a project shows results that finished while it was closed.
- **Nothing depends on the browser tab.** SSE is a view, not a dependency; a project opened in two tabs stays consistent because both read the same DB and events.
- **DB safety.** WAL with `wal_autocheckpoint`; `PRAGMA integrity_check` on worker boot (result in Settings); `pnpm backup` and a nightly backup job (`backup.snapshot`) copy `studio.sqlite` via the SQLite backup API to `DATA_DIR/backups/studio-<date>.sqlite` (keep 14); media files are never deleted by the app except through explicit "Delete asset" with confirmation, which moves to `DATA_DIR/trash/` (emptied after 30 days).

### 27.2 Resume state ("jump back in")
- Table `ui_state { scope PK, data_json, updated_at }` with scopes `global`, `project:<id>`, `campaign:<id>`, `review:<campaignId>:<stage>`, `library:<projectId>`.
- Stored per scope: last route, selected tab/stage, active filters and sort, selected candidate id, scroll position (virtualized index), zoom level, drawer open/closed, assembler playhead, last-used generation settings (model, variants, aspect), collapsed panels.
- Opening a project (`/projects/:id`) redirects to its last route if one exists and the target still exists; otherwise the hub. The switcher (`⌘/Ctrl+P`) lists projects by last opened with status and running-job count; switching is a client navigation that restores `project:<id>` state. The home page's "Continue" card uses `global.last_project_id`.
- Breadcrumbs always show Project › Campaign › Stage so the owner never loses orientation after a switch.

### 27.3 Project lifecycle operations
- **Archive / unarchive** (hidden from switcher and home grid, data untouched). **Duplicate** (copies project, products, talent, presets; not generations) for a returning client. **Rename / change client / cover image.**
- **Export bundle**: `jewelry-studio-<project>.jsbundle` = zip with `manifest.json` (schema version, app version), a JSON dump of every row scoped to the project, and the project's media tree. **Import bundle** on another machine (Mac ⇄ Windows) recreates the project with new ids mapped, verifies sha256 of every file, and reports missing files. Used for moving between the owner's two computers.
- **Open folder** reveals `DATA_DIR/projects/<id>` in Finder/Explorer.
- **Delete project** requires typing the project name; moves everything to `DATA_DIR/trash/<projectId>/`.

### 27.4 Resume test (automated, Playwright, `MOCK_PROVIDERS=1`)
1. Create project A, product, campaign; plan shots; start generation of 6 shots (mock latency 5 s each).
2. After 2 s, navigate to project B, edit a storyboard, reorder two shots, edit a brief field, close the browser.
3. Kill and restart both processes.
4. Reopen: home shows "Continue" to project B with the storyboard screen; storyboard order and brief edit are present; switch to project A: all 6 shots have candidates, review state intact, filters restored; the jobs page shows them succeeded; no duplicate generations exist (ledger count = 6).

---

## 28. Premium UI/UX design system

The app is used in front of jewelry clients. It must look and feel like a high-end creative tool, not an admin panel. These rules are binding; the implementing session must read `docs/design/` (created in M0 from this section) before building any screen.

### 28.1 Design principles
1. **The work is the interface.** Images and clips dominate every screen; chrome is thin, dark and quiet. No cards inside cards, no borders where spacing will do.
2. **One accent.** A single warm gold accent for primary actions, focus and progress; everything else is neutral. Status colors are desaturated and used sparingly.
3. **Fast and certain.** Every action responds within 100 ms (optimistic UI), every long task shows real progress with an ETA, and every destructive or paid action has a clear, well-designed confirmation that states cost and consequence.
4. **Keyboard-first, mouse-perfect.** Every workflow has shortcuts (§15.3), every control is reachable by tab, and pointer interactions have hover previews, drag affordances and precise hit areas.
5. **Calm density.** Dense information where the owner is working (review grid, storyboard), generous whitespace where they are deciding (brief, confirmations).
6. **Nothing jumps.** Reserved space for images (known aspect ratio from the DB), skeletons that match final layout, no layout shift when data arrives.

### 28.2 Tokens (`src/styles/tokens.css`, Tailwind 4 `@theme`)
- **Color (dark default, light available):** surfaces `--bg-0 #0C0C0D`, `--bg-1 #141416`, `--bg-2 #1B1B1F`, `--bg-3 #232328`; hairlines `--line rgba(255,255,255,0.08)`; text `--fg-0 #F5F3EE` (warm white), `--fg-1 #B8B5AD`, `--fg-2 #7D7A73`; accent gold `--accent #D4B27A`, `--accent-strong #E8C98C`, `--accent-muted rgba(212,178,122,0.16)`; status `--ok #8FBF9F`, `--warn #D9B36B`, `--danger #D98B86`, `--info #8FA9C9`. Light theme mirrors with warm paper neutrals (`#F7F5F0` base). Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI glyphs.
- **Type:** UI `Inter Variable` (bundled via `@fontsource-variable/inter`, no external font requests); display headings and client-facing titles `Instrument Serif` (`@fontsource/instrument-serif`). Scale: 12 / 13 / 14 (body) / 16 / 20 / 28 / 40 (display). Tabular numerals for costs and durations. Letter-spacing tightened on display sizes.
- **Space:** 4-px base; component paddings 8/12/16; section gaps 24/32/48. **Radii:** 6 (controls), 10 (cards), 16 (dialogs/drawers), full (pills). **Shadows:** only on floating layers (popovers, drawers, dialogs), soft and large; none on in-flow cards. **Hairline borders** at 1 px with `--line`.
- **Icons:** lucide at 16/20 px, 1.5 px stroke.

### 28.3 Motion (`motion` 14, respects `prefers-reduced-motion`)
- Durations: 120 ms micro (hover, toggles), 180 ms standard (panels, drawers), 260 ms large (dialogs, route transitions). Easing `cubic-bezier(0.2, 0.8, 0.2, 1)`; exits faster than entrances.
- Review grid: new candidates fade-and-rise in as they arrive; approve/reject gives a 120 ms scale-and-tint pulse; removing a card collapses its slot smoothly.
- Storyboard drag: lifted card gets elevation and 1.02 scale; siblings animate to new positions (`@dnd-kit` + `motion` layout animations).
- Progress: thin accent progress bars on job cards and a subtle top-of-screen bar for the active fan-out; numeric percent only where it is honest (ffmpeg, downloads), otherwise a determinate-looking stage stepper ("Uploading refs → Submitted → Rendering → Downloading → QA").
- No decorative animation. No spinners longer than 300 ms without text.

### 28.4 Application frame
- Left rail (64 px, icons with tooltips): Home, Projects, Library, Jobs, Settings. Top bar: breadcrumbs, project switcher, autosave state, running-jobs pill (click → jobs drawer), spend today, command palette trigger. Content area edge-to-edge. Right-side drawers (asset, job, lighting editor) at 420–560 px with resizable handle. Dialogs centered, max 640 px, with a clear primary action and cost line when money is involved.
- Command palette (`cmdk`): projects, campaigns, products, talent, recent assets, actions ("New campaign", "Generate approved shots", "Open exports folder", "Switch theme").

### 28.5 Screen-level direction
- **Home:** large "Continue" card with the last touched asset as a soft blurred backdrop, project name in Instrument Serif, one-line status and a primary "Resume" button; recent projects as cover-image tiles.
- **Project hub:** cover image header (latest approved still), client and brand palette swatches, three columns (Products, Talent, Campaigns) with cover thumbnails; status pills; spend.
- **Product page:** large reference viewer left, spec form right in two columns, invariants as editable chips, plates/sheet strip below with approve toggles.
- **Shot planner:** card per shot with a 3:4 placeholder sized to the shot aspect, title in serif, purpose, lighting and lens chips, estimate badge, prompt preview on hover/expand; bulk approve bar sticky at bottom with total cost.
- **Review board:** full-bleed masonry/grid, cards show image only until hover (then score ring, flags, actions); selected card has a 2 px accent ring; the drawer opens from the right without covering the selected card; compare mode is a true side-by-side with synchronized zoom/pan.
- **Storyboard:** horizontal filmstrip of cards with durations drawn as proportional widths, transitions as small glyphs between cards, total duration vs target shown as a bar; cards expand inline for editing.
- **Assembler:** cinema-style player top, filmstrip with trim handles that snap to frames, music waveform (peaks computed by ffmpeg `astats`/`showwavespic` into a PNG), overlays shown as tracks under the strip.
- **Jobs:** calm list grouped by project, progress bars, log drawer with monospace output.
- **Settings:** grouped sections, key status as masked chips with "Test" buttons, lane status with the exact fix instruction when something is off.

### 28.6 States and copy
- Every list has a designed empty state (illustration-free: a serif headline, one sentence, one primary action). Every async view has a skeleton matching final layout. Every error shows what happened, why it probably happened, and the one action to take (copy written in plain English; provider error text in a collapsible "details").
- Confirmations for paid actions: title, what will be generated, lane and model, estimate in large tabular numerals, remaining daily budget, primary button labelled with the verb ("Generate 24 images").
- Undo for review actions (toast with "Undo", 6 s). Undo for storyboard reorder and timeline edits via revisions (§27.1).
- Tooltips on every icon button; shortcut hints in tooltips and menus.
- Numbers formatted consistently (`$0.46`, `1.2k credits`, `00:12.5`).

### 28.7 Accessibility and responsiveness
- Minimum viewport 1280 × 800 (laptop); layouts fluid up to ultrawide with max content width for forms (720 px). Focus rings visible (accent, 2 px, offset 2). All controls labelled; drawers and dialogs trap focus and restore it. Color never the only signal (icons/text accompany status). Reduced-motion respected.

### 28.8 Polish checklist (run per screen before closing its milestone; record in `docs/progress/Mx.md`)
1. Matches tokens (no ad-hoc colors, radii, shadows, font sizes).
2. No layout shift on load, on data arrival, or on hover.
3. Loading, empty, error, and success states all designed and reachable.
4. Keyboard path for the primary task works end to end; focus visible.
5. Hover/pressed/disabled states on every control; cursor correct.
6. Text truncation and long names handled (ellipsis + title).
7. Dark and light themes both correct.
8. Motion within §28.3 budgets; reduced-motion honoured.
9. Paid-action dialogs show cost and consequence.
10. Screenshot at 1440 × 900 saved to `docs/progress/screens/<screen>.png`.

### 28.9 Reference points (direction only; never copy)
Linear (density and keyboard model), Frame.io (review and compare), Capture One (image-first dark studio chrome), Arc/Raycast (command palette feel), high-end jewelry e-commerce (type and whitespace). The build session should load the `anthropic-skills:frontend-design` skill when implementing screens and follow this section where the two differ.

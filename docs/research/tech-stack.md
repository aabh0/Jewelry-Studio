# Jewelry Studio - Pinned Tech Stack (verified 2026-10-14)

Scope: single-user, local-only web app (Mac/PC, opened in a browser, no auth, no cloud hosting). Orchestrates Higgsfield Cloud image/video jobs, calls the Claude API for storyboards and vision QA, stores metadata in SQLite and media on disk, assembles video with ffmpeg.

Verification method: every package version below was read from `registry.npmjs.org` (`dist-tags.latest` + `engines`) on 2026-10-14; Node release lines from `nodejs.org/dist/index.json` and the `nodejs/Release` schedule; Anthropic model/pricing/vision facts from the `claude-api` skill (cached 2026-10-06) and the live vision doc at platform.claude.com. Web search was used for changelog facts (cited inline). A raw version dump is in `npm-versions.tsv` next to this file.

---

## 0. Decision summary (one line each)

| Area | Decision |
|---|---|
| Runtime | Node **24.21.0** (Active LTS "Krypton"; Node 26 becomes LTS 2026-10-28, adopt after better-sqlite3/sharp confirm prebuilds). `engines.node: ">=24.0.0 <27"`. |
| Package manager | **pnpm 12.11.2** (`packageManager` field + `pnpm.onlyBuiltDependencies` for native deps). |
| Framework | **Next.js 16.4.0** App Router + **React 19.3.0**; Turbopack (default); `output: "standalone"`; TypeScript **6.x**, not 7 (see 1.4). |
| Job submission | **Route Handlers** (`app/api/**/route.ts`) for everything that touches jobs/files; Server Actions only for trivial form mutations. |
| Background worker | **Separate Node process** (`worker/main.ts` via `tsx`), run with `concurrently` in dev and in `npm start`. Not the instrumentation hook, not a custom server. |
| Database | **better-sqlite3 13.0.3** + **drizzle-orm 0.45.4** / **drizzle-kit 0.31.11**, WAL mode, `drizzle-kit generate` + programmatic `migrate()` on boot. |
| Queue | **Hand-rolled SQLite table** + polling worker loop with `p-limit` concurrency. No queue package. |
| Images | **sharp 0.35.5** (prebuilt `@img/sharp-*` binaries, no compile). |
| Video | **Direct `child_process.spawn`** of **ffmpeg-static 5.3.0** (ffmpeg 6.1.1) + **@derhuerst/ffprobe-static 5.3.0**. `fluent-ffmpeg` is deprecated on npm - do not use. |
| UI | Tailwind **4.3.3**, shadcn CLI **4.21.4** (+ `radix-ui` 1.8.1, `lucide-react` 1.57.0), `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0, `react-compare-slider` 4.0.0, `react-zoom-pan-pinch` 4.2.0, `konva` 10.8.0 + `react-konva` 19.3.0 (mask brush), plain `<video>` + `media-chrome` 4.19.3, `react-virtuoso` 4.18.19, `react-hook-form` 7.90.0 + `zod` 4.6.7 + `@hookform/resolvers` 5.9.1, `@tanstack/react-query` 5.104.2, `sonner` 2.0.8. |
| Progress | **SSE via Route Handler** (one stream per open page) with TanStack Query as the cache; polling as the fallback mode. |
| Claude | `@anthropic-ai/sdk` **0.133.0**; storyboard = `claude-opus-5-5` (structured output via `messages.parse` + `zodOutputFormat`); vision QA = `claude-haiku-5-5`; prompt caching on the craft-guidance system block. |
| Config | `.env.local` + `@t3-oss/env-nextjs` 0.13.11 (zod 4) - server-only schema, no `NEXT_PUBLIC_` secrets. |
| Tests | `vitest` 5.0.4 (+ `vite` 8.3.4 peer), `@playwright/test` 1.64.0, **msw 3.0.3** for Higgsfield/Anthropic HTTP mocking. |
| Media serving | Route Handler `GET /api/media/[...path]` streaming from disk with HTTP Range support. No symlinks into `/public`, no rewrites. |
| Desktop later | Keep Node-only runtime, no edge runtime, all paths from env - Tauri 2 (`@tauri-apps/cli` 2.12.2) with a Node sidecar running the standalone server is viable; Electron 44.7.2 is the lower-risk fallback. |

---

## 1. Framework

### 1.1 Versions
- `next` **16.4.0** (published 2026-10-06; engines `node >=20.9.0`; peer `react ^19`). Next 16 was released 2025-10-21; 16.1 made Turbopack filesystem cache default; 16.3 added opt-in TS 7 checking. Breaking vs 15: `middleware.ts` -> `proxy.ts` (Node runtime only), async-only `cookies()/headers()/params`, `next lint` removed, Turbopack is default for dev and build (custom webpack config fails the build), `cacheComponents` replaces `experimental.ppr`. Sources: [nextjs.org/blog/next-16](https://nextjs.org/blog/next-16), [wisp 16.1 guide](https://www.wisp.blog/blog/nextjs-16-1-upgrade-guide), [ecorpit migration](https://ecorpit.com/nextjs-16-migration-async-request-apis-cache-components-2026/).
- `react` / `react-dom` **19.3.0**, `@types/react` / `@types/react-dom` **19.3.0**.
- `eslint` 10.12.0 + `eslint-config-next` 16.4.0 (flat config; `next lint` is gone, run `eslint .`).
- Do **not** enable `cacheComponents` - this app is fully dynamic and local; it adds complexity and reported memory overhead for nothing.
- Set `serverExternalPackages: ["better-sqlite3", "sharp", "ffmpeg-static", "@derhuerst/ffprobe-static"]` in `next.config.ts` so Turbopack never tries to bundle native modules or binary paths.
- `output: "standalone"` from day one (needed for the desktop packaging path, section 10).

### 1.2 Server Actions vs Route Handlers for job submission - **Route Handlers**
Reasons:
1. Server Actions have a 1 MB request body default (`serverActions.bodySizeLimit`), counted including multipart overhead; reference-product uploads and masks blow through it. Route Handlers read `request.formData()` / `request.body` streams with no framework cap. Source: [serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).
2. Job submission returns a job id and the client subscribes to progress - that is a plain `POST /api/jobs` -> `201 {id}` contract, testable with Playwright `request` and curl, and reusable unchanged by a future Tauri/Electron shell or a CLI.
3. Server Actions are POST-only RPC bound to React's serialization; SSE, Range-streamed media and binary responses need Route Handlers anyway, so one mechanism for all server I/O keeps the mental model small.
4. Idempotency: Route Handlers can read an `Idempotency-Key` header and return the existing job; Server Actions have no header access without `headers()` gymnastics.

Use Server Actions only for small, non-file mutations tied to a form (rename a project, toggle a flag) if `revalidatePath` is convenient - otherwise skip them entirely.

### 1.3 Background worker - **separate Node process via `concurrently`**
Options considered:
- **Instrumentation hook (`instrumentation.ts` `register()`)** - runs once per Next server instance before it serves requests; must not block; must be gated on `process.env.NEXT_RUNTIME === "nodejs"`. Rejected: in `next dev` the server process restarts on config changes and the worker dies with it, hot-reload makes "is the loop already running" ambiguous, a crash in ffmpeg handling takes the UI down, and `next build` imports the file (so the worker must guard against running during build). It is fine for *lightweight* startup (running DB migrations) - use it for that only. Source: [instrumentation docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
- **Custom server (`server.js` wrapping `next()`)** - rejected: disables Turbopack-dev fast paths and standalone output optimizations, and the Next docs steer away from it.
- **Separate process** - chosen. `worker/main.ts` opens the same SQLite file (WAL makes cross-process readers/writers safe), polls the `jobs` table, runs Higgsfield/Claude/ffmpeg steps, writes progress rows. Isolation means ffmpeg OOMs or Higgsfield hangs never affect the UI, and the worker can be restarted independently.

Scripts:
```json
"scripts": {
  "dev": "concurrently -k -n next,worker -c blue,magenta \"next dev\" \"tsx watch worker/main.ts\"",
  "build": "next build",
  "start": "concurrently -k -n next,worker \"node .next/standalone/server.js\" \"node dist/worker/main.js\"",
  "worker:build": "tsc -p worker/tsconfig.json"
}
```
(`concurrently` 10.0.6, engines node >=22; `tsx` 4.23.15; `cross-env` 10.1.0 if Windows env quirks appear.) In production build the worker is compiled with `tsc` to `dist/worker` so `node` runs it without `tsx`. Both processes share `src/lib/db`, `src/lib/queue`, `src/lib/ffmpeg` - keep those modules free of `next/*` imports.

Worker and UI communicate only through SQLite (job rows + `job_events` rows). The UI's SSE handler tails `job_events` - no IPC, no sockets, no port juggling.

### 1.4 TypeScript
`typescript` latest is **7.0.2** (Go-native compiler, released 2026-07). Next 16.3+ supports it only behind `experimental.useTypeScriptCli: true` because TS 7.0 lacks the JS compiler API Next's in-process checker uses (expected in 7.1). Pin **`typescript@^6`** (install as `typescript@6` - exact 6.x latest was not queried; see "Could not verify") for the Next app until Next removes the flag; the worker can use either. Sources: [Next useTypeScriptCli](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli), [TS 7 release coverage](https://infoq.com/news/2026/08/typescript-7-released/).

---

## 2. Database

### 2.1 Driver - **better-sqlite3 13.0.3**
| Candidate | Verdict |
|---|---|
| `better-sqlite3` 13.0.3 (2026-08-05, engines node >=22) | **Chosen.** v13 moved to N-API, so one prebuilt binary works across Node/Electron versions; prebuilt binaries are shipped inside the npm package (no `prebuild-install` download step, no GitHub rate-limit failures behind proxies). Falls back to node-gyp compile only when no prebuild matches the platform. Synchronous API = simplest possible transaction semantics for a queue. Sources: [v13.0.0 notes](https://newreleases.io/project/npm/better-sqlite3/release/13.0.0), [README](https://app.unpkg.com/better-sqlite3@13.0.1/files/README.md). |
| `@libsql/client` 0.18.0 | Rejected: its value is remote/embedded-replica Turso sync, which a local app does not need; async API complicates the worker's transaction-per-poll pattern; native `@libsql/*` binaries are a second prebuild matrix to worry about. |
| `node:sqlite` (built-in) | Rejected for now: as of the current Node docs it is **Stability 1.2 - Release candidate** (made RC in v25.7.0), still not marked stable even on 26.x; Drizzle has no `node:sqlite` driver in 0.45.x or in the 1.0 RC notes. Revisit when it hits Stability 2 and Drizzle ships a driver - the migration would be mechanical (same SQL). Source: [nodejs.org/api/sqlite.html](https://nodejs.org/api/sqlite.html). |

Native build facts (Mac/Windows): better-sqlite3 13 includes prebuilds for current LTS lines (Node 22, 24) on darwin-arm64/x64 and win32-x64; Node 26 prebuilds are the thing to check before moving the engine pin (README says "prebuilt binaries are available for LTS versions"). If a compile is triggered you need Python 3 + Xcode CLT (Mac) or VS Build Tools (Windows) - treat that as a bug in the pin, not a setup step. With pnpm 12, native postinstall scripts are blocked unless whitelisted: add `"pnpm": { "onlyBuiltDependencies": ["better-sqlite3", "sharp"] }` (sharp needs none but whitelisting avoids warnings).

### 2.2 ORM - **Drizzle** (`drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `@types/better-sqlite3` 9.6.0)
- Drizzle 1.0 is still **rc.4** (2026-06-27); 0.45.4 (2026-10-08) is `latest` and what the docs target. Pin 0.45.x; the 1.0 migration is additive (relations v2) and can wait. Source: [drizzle releases](https://github.com/drizzle-team/drizzle-orm/releases).
- Why not Prisma: `prisma` latest is **8.0.0-rc.22** (RC on the `latest` tag, engines node >=22.18) with `@prisma/client` 7.10.0 - version split, Rust-free engine churn still settling, generated client + query engine complicates `standalone` and desktop packaging, no synchronous API (the worker wants `db.transaction(() => ...)` to claim a job atomically). Drizzle is a thin typed layer over `better-sqlite3` with zero runtime engine.
- Schema is plain TS (`src/db/schema.ts`); use `drizzle-zod` only if you want DB-derived zod types (not pinned; optional).

### 2.3 Migration workflow
1. `drizzle.config.ts`: `dialect: "sqlite"`, `driver` omitted (better-sqlite3 default), `dbCredentials.url` from env, `out: "./drizzle"`.
2. Dev loop: edit schema -> `pnpm drizzle-kit generate` (writes SQL + snapshot into `./drizzle`, commit it) -> app applies on boot.
3. Apply on boot, programmatically, from **one** place (the Next `instrumentation.ts` register, gated to the nodejs runtime, or the worker - pick the worker since it starts first in `start`): `migrate(db, { migrationsFolder })` from `drizzle-orm/better-sqlite3/migrator`. Migrations are idempotent via Drizzle's `__drizzle_migrations` table, so both processes calling it is safe but wasteful.
4. Never use `drizzle-kit push` against the user's real DB - generated migrations are the only path that is reproducible on another machine.

### 2.4 SQLite settings (apply on every connection open)
```ts
const sqlite = new Database(env.DB_PATH, { timeout: 5000 });
sqlite.pragma("journal_mode = WAL");      // UI + worker in separate processes
sqlite.pragma("synchronous = NORMAL");    // safe with WAL, much faster
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");
```
WAL is what makes a two-process design safe: readers never block the single writer. Keep write transactions short (claim job, write event) - ffmpeg and HTTP calls happen outside transactions.

---

## 3. Job queue (no Redis) - **hand-rolled table + polling worker**

Evaluated:
- `bullmq`, `pg-boss`, `graphile-worker`: need Redis/Postgres - out.
- `better-queue` 3.8.12: last published **2022-09**, store adapters are callback-style, SQLite store is a thin wrapper that does not expose idempotency keys or per-job events - out.
- `plainjob` 0.0.14: last published **2024-10**, pre-1.0, single maintainer, better-sqlite3-backed but abstracts away exactly the table we want to query from the UI - out.
- Other "sqlite-queue"-style packages: all small/stale; none worth a dependency when the whole thing is ~150 lines.

Recommendation: own the schema, it *is* the product's data model (the UI needs to render job history, retries and events anyway).

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,                 -- nanoid
  type TEXT NOT NULL,                  -- 'image.generate' | 'video.generate' | 'qa.score' | 'ffmpeg.assemble' ...
  payload TEXT NOT NULL,               -- JSON (validated with zod on both sides)
  idempotency_key TEXT UNIQUE,         -- hash(type + canonical payload) or client-supplied
  status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|succeeded|failed|cancelled
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after INTEGER NOT NULL,          -- epoch ms; backoff sets this
  locked_by TEXT, locked_at INTEGER,   -- worker id + heartbeat
  parent_id TEXT REFERENCES jobs(id),  -- storyboard -> shots -> clips fan-out
  result TEXT, error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_poll ON jobs(status, run_after, priority);
CREATE TABLE job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  ts INTEGER NOT NULL, kind TEXT NOT NULL,   -- 'progress'|'log'|'status'|'artifact'
  data TEXT NOT NULL                         -- JSON {pct, message, path...}
);
```

Worker loop (`p-limit` 7.3.3 for concurrency; `nanoid` 6.0.2 for ids):
1. Every 500 ms (or immediately after a job finishes): in one `db.transaction`, `SELECT ... WHERE status='queued' AND run_after<=now ORDER BY priority DESC, created_at LIMIT n` then `UPDATE ... SET status='running', locked_by=?, locked_at=?, attempts=attempts+1` for each - the transaction makes the claim atomic even with a second worker process.
2. Run the handler under `p-limit(concurrency[type])` - e.g. Higgsfield jobs limit 4 (they are remote polls), ffmpeg limit 1-2 (CPU bound), Claude limit 3.
3. Handlers write `job_events` as they go; the Higgsfield poll handler re-checks `jobs.status` so cancel works.
4. On error: if `attempts < max_attempts` set `status='queued', run_after = now + 2^attempts * 5s + jitter`; else `failed`. Non-retryable errors (4xx validation, content policy) throw a `PermanentError` and go straight to `failed`.
5. Startup sweep: any `running` row whose `locked_at` is older than the heartbeat window (worker crashed mid-job) is reset to `queued`.
6. Idempotency: `POST /api/jobs` computes/accepts `idempotency_key`; `INSERT ... ON CONFLICT(idempotency_key) DO NOTHING` then return the existing row. Higgsfield's own request ids are stored in `result` so a retried job re-polls instead of re-submitting (and re-charging).

Keep the handler registry a plain `Record<JobType, (ctx) => Promise<Result>>`; the UI imports only the types.

---

## 4. Media handling

### 4.1 Images - **sharp 0.35.5**
- Published 2026-09-27, engines node >=20.9. Binaries come as optional deps `@img/sharp-darwin-arm64`, `@img/sharp-darwin-x64`, `@img/sharp-win32-x64`, `@img/sharp-win32-arm64`, `@img/sharp-linux-*` - pnpm fetches only the matching one. 0.35 removed the install script entirely (source compile is opt-in via `build` script), so there is no node-gyp path by accident; libvips 8.18.3. win32-ia32 is deprecated (irrelevant). Source: [0.35.0 notes](https://newreleases.io/project/npm/sharp/release/0.35.0-rc.3).
- Uses: downscale reference/product images for Claude (long edge 1568 for QA - see 7.4), thumbnails (`.resize({ width: 512, withoutEnlargement: true }).webp({ quality: 80 })`), contact sheets of stills (`sharp({ create })` + `.composite([...])`), mask PNG normalization, EXIF strip.
- Next's built-in image optimizer also uses sharp; set `images.unoptimized: true` anyway - local files served through our own route (section 11) do not need `next/image` optimization.

### 4.2 ffmpeg - **direct `spawn`**, binaries from `ffmpeg-static` 5.3.0 + `@derhuerst/ffprobe-static` 5.3.0
- `fluent-ffmpeg` 2.1.3: last publish 2024-05; **npm shows it deprecated ("Package no longer supported")** and the GitHub README says it is no longer maintained. Do not add it. Sources: [npm](https://npmjs.com/package/fluent-ffmpeg), [depscope](https://mcp.depscope.dev/pkg/npm/fluent-ffmpeg).
- `ffmpeg-static` 5.3.0 (2025-11-14) downloads release tag **b6.1.1** (ffmpeg 6.1.1) for darwin-arm64/x64, win32-x64, linux on install (postinstall, needs network; honours `FFMPEG_BINARIES_URL`). `@derhuerst/ffprobe-static` 5.3.0 is the matching ffprobe from the same author (the older `ffprobe-static` 3.1.0 is from 2022 and bundles an ancient ffprobe - skip it). `@ffmpeg-installer/ffmpeg` 1.1.0 is from 2021 (ffmpeg 4.x, no xfade on some builds) - skip.
- Escape hatch: `FFMPEG_PATH` / `FFPROBE_PATH` env override so users with Homebrew ffmpeg 7/8 (hardware encoders, newer filters) can point at it; `ffmpeg-static` is just the zero-setup default.
- Wrapper: a ~60-line `runFfmpeg(args: string[], { onProgress })` that spawns with `-hide_banner -nostats -progress pipe:1 -y`, parses `out_time_us=`/`frame=` lines into job_events, captures stderr tail for errors, and supports cancel via `child.kill()`. Build filtergraphs as strings with a tiny helper; no DSL library.

### 4.3 ffmpeg recipes (ffmpeg 6.1)
Conventions: target 1080x1920 (9:16), 1080x1080 (1:1) or 1920x1080 (16:9); 30 fps; `-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k`. Always normalize every input to the same size/fps/SAR/pixel format *before* concat or xfade - mismatches are the number-one cause of "Input link parameters do not match" errors.

- **Probe:** `ffprobe -v error -print_format json -show_format -show_streams in.mp4` -> JSON (duration, width/height, r_frame_rate, has audio).
- **Normalize a clip** (fit inside W x H, pad to exact, letterbox blur optional):
  `-vf "scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p"`
  Fill-crop variant: `scale=W:H:force_original_aspect_ratio=increase,crop=W:H`.
- **Concatenate clips with different resolutions:** normalize each to the same W x H/fps in one filtergraph then `concat`:
  `ffmpeg -i a.mp4 -i b.mp4 -i c.mp4 -filter_complex "[0:v]scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:-1:-1,setsar=1,fps=30[v0];[1:v]...[v1];[2:v]...[v2];[v0][v1][v2]concat=n=3:v=1:a=0[v]" -map "[v]" ...`
  If inputs already match exactly, use the concat demuxer (`-f concat -safe 0 -i list.txt -c copy`) for a lossless, instant join. Generate silent audio (`anullsrc`) for clips without audio when a=1 is needed.
- **Trim:** accurate: `-ss 1.5 -to 4.0 -i in.mp4 -c:v libx264 ...` (input seeking + re-encode). Fast/keyframe-only: `-ss ... -i in.mp4 -c copy`.
- **Crossfade (xfade), N clips:** chain pairwise; each offset = cumulative duration minus accumulated fade time:
  `[v0][v1]xfade=transition=fade:duration=0.5:offset=D0-0.5[x1];[x1][v2]xfade=transition=fade:duration=0.5:offset=D0+D1-1.0[x2]` - offsets are computed from ffprobe durations in code. Audio equivalent: `acrossfade=d=0.5`. Inputs must have identical size/fps/format (normalize first). Transitions worth exposing: `fade`, `dissolve`, `wipeleft`, `smoothleft`, `circleopen`.
- **Add music with fade in/out, trimmed to video length:**
  `-i video.mp4 -i music.mp3 -filter_complex "[1:a]atrim=0:DUR,afade=t=in:st=0:d=1,afade=t=out:st=DUR-2:d=2,volume=0.8[a]" -map 0:v -map "[a]" -shortest`
  Mixing with existing clip audio: add `[0:a][a]amix=inputs=2:duration=first:dropout_transition=2`.
- **Burn text overlay (drawtext):** needs a font file - ffmpeg-static builds have no fontconfig on Windows/Mac, so **ship a TTF** (e.g. `assets/fonts/Inter-Regular.ttf`) and pass `fontfile=` with an escaped path (on Windows, `C\\:/path/Inter.ttf`). Example:
  `drawtext=fontfile='/abs/Inter.ttf':text='%{eif\:...}':textfile=caption.txt:fontsize=56:fontcolor=white:borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=h-th-120:enable='between(t,0.5,3.5)'`
  Use `textfile=` (UTF-8) rather than `text=` to avoid quoting/escaping bugs; escape `:`, `'`, `\` and `%` in paths/text. For richer typography, render the caption with sharp/SVG to a transparent PNG and `overlay` it instead - no font escaping, exact brand fonts.
- **Export at a given aspect:** combine the normalize filter with the target W x H; for 4:5 use 1080x1350. Always `-pix_fmt yuv420p` and even dimensions (`scale=trunc(iw/2)*2:trunc(ih/2)*2` if dynamic).
- **Thumbnail / poster:** `ffmpeg -ss 1 -i in.mp4 -frames:v 1 -vf "scale=640:-2" -q:v 3 thumb.jpg` (or `thumbnail=300` filter to pick a representative frame).
- **First frame:** `ffmpeg -i in.mp4 -frames:v 1 -update 1 first.png`.
  **Last frame** (for start/end-frame chaining into the next Higgsfield video): `ffmpeg -sseof -0.1 -i in.mp4 -update 1 -frames:v 1 last.png` (seek relative to end; `-update 1` writes a single image). Verify with ffprobe `nb_frames` if exactness matters: `-vf "select='eq(n,NB-1)'" -vsync 0`.
- **Contact sheet of a video:** `ffmpeg -i in.mp4 -vf "select='not(mod(n,30))',scale=320:-2,tile=5x4" -frames:v 1 sheet.png` (one frame every 30, 20 tiles). Contact sheet of *stills* (storyboard review): do it with sharp composite - no ffmpeg needed.
- **Ken Burns on a still (image -> 4 s clip):** `-loop 1 -i still.png -t 4 -vf "scale=2160:-2,zoompan=z='min(zoom+0.0015,1.2)':d=120:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,format=yuv420p"`.

---

## 5. UI

| Need | Pick | Version | Why |
|---|---|---|---|
| Styling | `tailwindcss` + `@tailwindcss/postcss` | 4.3.3 | v4 CSS-first config (`@import "tailwindcss"`, `@theme`), no `tailwind.config.js`. |
| Components | `shadcn` CLI (devDep) + `radix-ui` + `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0, `tw-animate-css` 1.4.0, `lucide-react` 1.57.0 | shadcn 4.21.4, radix-ui 1.8.1 | shadcn 4.x CLI targets Tailwind v4 + React 19 and installs the unified `radix-ui` package instead of 20 `@radix-ui/react-*` deps. Components are copied into the repo - no version to pin beyond the CLI that generated them. |
| Storyboard reorder | `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 + `@dnd-kit/modifiers` 9.0.0 (+ `@dnd-kit/utilities` 3.2.2) | Dec 2024 releases, works on React 19 (peer `react >=16.8`), ~2.8M weekly downloads, keyboard + pointer sensors, grid sorting via `rectSortingStrategy`. The `@dnd-kit/react` 0.5.0 rewrite is still pre-1.0 - not yet. `@hello-pangea/dnd` 18.0.1 (Feb 2025) is list-only and heavier; its react-beautiful-dnd lineage is a dead end. Source: [pkgpulse 2026](https://www.pkgpulse.com/guides/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026). |
| Before/after slider | `react-compare-slider` 4.0.0 | 2026-03, node >=20, React 19 ok | Dependency-free, handles images and arbitrary children (so a video-vs-video compare works). |
| Zoom/pan viewer | `react-zoom-pan-pinch` 4.2.0 | 2026-09 | Standard choice; wraps any element, exposes `useControls` for fit/100% buttons. |
| Mask / brush canvas | `konva` 10.8.0 + `react-konva` 19.3.0 | 2026-10 / 2026-09 | react-konva 19.3 peers exactly `react ^19.3.0` - matches. Layer model (image layer + mask layer with `globalCompositeOperation`) maps directly to "paint a mask, export PNG at source resolution via `stage.toDataURL({ pixelRatio })`". `fabric` 7.4.0 is heavier and object-oriented (good for text/vector editing, which this app does not need); plain canvas means rewriting hit-testing/undo. Load `react-konva` with `next/dynamic({ ssr: false })`. |
| Video player | plain `<video>` + `media-chrome` 4.19.3 | 2026-09 | Local MP4s need no HLS; media-chrome gives accessible, skinnable controls (scrub, frame-step via `media-seek-*`, playback rate) as web components with a React wrapper (`media-chrome/react`). Nothing else needed. |
| Virtualized gallery | `react-virtuoso` 4.18.19 | 2026-10 | `VirtuosoGrid` handles variable-height masonry-ish grids with far less code than `@tanstack/react-virtual` 3.14.19 (which is the pick only if you need full layout control). |
| Forms | `react-hook-form` 7.90.0 + `zod` 4.6.7 + `@hookform/resolvers` 5.9.1 | | Same zod 4 schemas validate job payloads on the server (`safeParse` in Route Handlers). RHF 8 is still beta. |
| Data fetching | `@tanstack/react-query` 5.104.2 | | Query cache is the single client state store for jobs/assets; SSE events call `queryClient.setQueryData`. |
| Toasts | `sonner` 2.0.8 | | shadcn's default toast. |

---

## 6. Real-time progress - **SSE Route Handler, TanStack Query as the store**

- `GET /api/events?since=<event_id>` returns `text/event-stream`; the handler polls `job_events WHERE id > since` every 300-500 ms from SQLite (cheap: indexed, WAL, read-only) and writes `id:`/`data:` frames. Client uses native `EventSource` with `Last-Event-ID` so reconnects resume without gaps. One connection per tab, not per job.
- Set `export const dynamic = "force-dynamic"`, headers `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; return the `Response` **immediately** with a `ReadableStream` whose `start()` schedules work (do not `await` the loop before returning). Do **not** route SSE through `next.config` `rewrites` - Next's rewrite proxy buffers upstream bodies to completion (reported on 15/16 standalone). Sources: [open-notebook PR #770](https://cubic.dev/pr/lfnovo/open-notebook/pull/770), [Medium SSE fix](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996).
- Why not pure polling: a storyboard run fans out to 10-40 jobs with per-second ffmpeg/Higgsfield progress; polling `/api/jobs` every second re-serializes the whole list. SSE pushes deltas and still ends up in the same Query cache, so UI code is identical. Keep a `refetchInterval: 5000` on the jobs list query as a safety net when the stream is down (`EventSource.readyState !== OPEN`).
- Why not WebSockets: bidirectional is unnecessary (commands go through POST), and WS needs a custom server or `next-ws` patching in Next.

---

## 7. Anthropic SDK and model choices (from the `claude-api` skill, cached 2026-10-06, + live vision doc)

### 7.1 SDK
`@anthropic-ai/sdk` **0.133.0** (2026-10-09; peer `zod ^3.25 || ^4` - zod 4.6.7 is fine). Client: `new Anthropic()` reads `ANTHROPIC_API_KEY` from env (server/worker only). TS timeout unit is **milliseconds**; default `maxRetries: 2` already retries 429/5xx. Always check `stop_reason` (`"refusal"` can occur on current models) before reading content.

### 7.2 (a) Creative-director storyboard with structured JSON - **`claude-opus-5-5`**
- Pricing $4 / $20 per MTok, cache reads $0.20/MTok (0.05x), 1M context, 128K output. Thinking is always on; control with `output_config.effort` (default **`medium`** on this model - set `"high"` explicitly for storyboard creativity; `xhigh` only if quality measurably improves). Forced `tool_choice` returns 400 on this model - use structured outputs instead.
- Structured output (recommended by the skill):
```ts
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
const res = await client.messages.parse({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  output_config: { effort: "high", format: zodOutputFormat(StoryboardSchema) },
  system: [{ type: "text", text: CRAFT_GUIDANCE, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: [ /* product images first, then brief text */ ] }],
});
if (res.stop_reason === "refusal") { /* handle */ }
const storyboard = res.parsed_output; // null if parse failed - guard
```
  Note: `output_config.format` is incompatible with citations and with `max_tokens: 0` pre-warming. Include the `fallbacks: "default"` + `betas: ["server-side-fallback-2026-07-01"]` opt-in on the beta client if refusal fallbacks are wanted (skill default for Opus 5.5).
- Why Opus 5.5 over Sonnet 5.5 ($2/$10): the skill's rule is Opus 5.5 unless the user names another model; the storyboard is the one high-leverage call per project (tens per day, not thousands), and the cost delta is cents. If budget matters later, A/B `claude-sonnet-5-5` with the same schema.
- Stream if `max_tokens` is large (`client.messages.stream(...).finalMessage()`); for a ~3-6K-token JSON storyboard a non-streaming `parse` under 16K is fine.

### 7.3 (b) Cheap vision QA scoring - **`claude-haiku-5-5`**
- $0.10 / $0.50 per MTok (prompts <=100K), 1M context, adaptive thinking on by default (set `output_config.effort: "low"` for scoring), structured output via `messages.parse` works the same. No server-side refusal fallback on Haiku - on `stop_reason: "refusal"` mark the QA as `needs_review` rather than retrying.
- Pattern: user content = `[text "Reference product:", image(ref), text "Candidate 1:", image(gen1), ..., text(rubric question)]`; schema `{ score: 0-10, product_fidelity, brief_adherence, defects: string[], verdict: "pass"|"retry"|"review" }`. Put images before text (doc guidance). Batch several candidates per call (up to the limits below) to amortize the reference image and cached rubric.

### 7.4 Vision limits (live doc, platform.claude.com/docs/en/build-with-claude/vision)
- Max **600 images per request** on 1M-context models (100 for 200K models); **>20 images in one request** forces every image to <=2000 px per side or the request is rejected. Max 8000x8000 px, **10 MB per image (base64)** on the Claude API, 32 MB total request. Formats: JPEG, PNG, GIF (first frame), WebP.
- Token cost = `ceil(w/28) * ceil(h/28)`. Claude 4.7-and-later models (Opus 5.5, Sonnet 5.5, Haiku 5.5) are **high-resolution tier**: long edge up to 2576 px / 4784 tokens before downscaling; older models cap at 1568 px / 1568 tokens. So a 1920x1080 image costs 2691 tokens on current models (vs 1560 before) - **pre-downscale with sharp**: 1092 px long edge ~1.5K tokens is enough for composition/fidelity QA; use 1568-2000 px only when checking fine detail (prong setting, engraving).
- Local files: `fs.readFileSync(p).toString("base64")` into `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }`; no newlines in the base64 string. For a reference image reused across many QA calls, upload once via `client.files.upload(...)` and reference `{ type: "file", file_id }` (Files API is GA, no beta header) - keeps request bodies small.

### 7.5 Prompt caching for the craft-guidance system prompt
- Render order `tools -> system -> messages`; put the long, frozen jewelry-craft guidance as the **first** system text block with `cache_control: { type: "ephemeral" }` and everything volatile (project brief, date, product name) after it in `messages`. Minimum cacheable prefix on Opus 5.5 / Sonnet 5.5 / Haiku 5.5 is **512 tokens** (skill table; "check the docs before relying on" for the newest models). Max 4 breakpoints.
- Economics: write 1.25x, read 0.1x (0.05x = $0.20/MTok on Opus 5.5). Default TTL 5 min, refreshed by every hit; use `ttl: "1h"` (2x write) only if storyboard calls are typically >5 min apart - for a human-driven studio they are, so **set `ttl: "1h"` on the system block** and keep the 5-minute default for the QA rubric (QA calls come in bursts).
- Verify: assert `usage.cache_read_input_tokens > 0` on the second call in an integration test; any `Date.now()`, random id or re-ordered JSON in the system block silently kills the cache.

### 7.6 Approximate cost per call (list prices above; assumes caching warm)
- **Storyboard (Opus 5.5):** 8K-token cached guidance read (8K x $0.20/M = $0.002) + 2K uncached brief/images ($0.008) + ~5K output incl. thinking (5K x $20/M = $0.10) -> **~$0.11 per storyboard**; first call of the hour adds the cache write (8K x $5/M = $0.04). Same call on Sonnet 5.5 ~$0.055.
- **QA (Haiku 5.5):** 1 reference + 4 candidates at 1092 px (~1.5K tokens each = 7.5K) + 2K cached rubric + 0.5K text -> ~10K input ($0.001) + 300 output tokens ($0.00015) -> **~$0.0012 per 4-candidate QA call** (about 0.03 cents per image). At 2000 px images it is ~3.5x more, still well under a cent.

---

## 8. Config and secrets

- Files: `.env.local` (git-ignored) holds `ANTHROPIC_API_KEY`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET`, `DATA_DIR`, `DB_PATH`, `FFMPEG_PATH?`, `FFPROBE_PATH?`, `WORKER_CONCURRENCY?`. `.env.example` is committed. Next loads `.env.local` automatically; the worker process loads it with `dotenv` 18.0.7 (`import "dotenv/config"`) or `node --env-file=.env.local` (Node 24 supports `--env-file`; prefer it in `start`, dotenv in `tsx watch` dev).
- Validation: `@t3-oss/env-nextjs` 0.13.11 (peer zod 4 ok): `createEnv({ server: { ANTHROPIC_API_KEY: z.string().min(1), DATA_DIR: z.string().default(defaultDataDir()) , ...}, client: {}, runtimeEnv: process.env })`. Importing `env` from a client component throws at build time, which is the guard you want. The worker reuses the same `src/env.ts` (it uses `@t3-oss/env-core` under the hood - import the nextjs variant only from Next code, or split into `env.server.ts` built on `@t3-oss/env-core` 0.13.11 shared by both).
- Never prefix secrets with `NEXT_PUBLIC_`; no secret ever reaches a Route Handler response. The only env the browser needs is `NEXT_PUBLIC_APP_NAME`-type cosmetics.
- Key storage beyond `.env.local` (OS keychain) is a desktop-packaging concern (section 10); design `env.ts` so the source of `process.env` can be swapped.

---

## 9. Testing

- **Unit/integration:** `vitest` 5.0.4 (engines node ^22.12 || ^24 || >=26; peer `vite` ^6.4 || ^7 || ^8 - install `vite` 8.3.4), `@vitejs/plugin-react` 6.1.2, `@vitest/coverage-v8` 5.0.4, `@testing-library/react` 16.3.3 + `jsdom` 30.1.2 for component tests (`happy-dom` 21.0.1 is faster but jsdom tracks Node support exactly; either works). Queue/DB tests run against a temp `:memory:` or tmp-file SQLite with real migrations - fast and deterministic, no mocks.
- **E2E:** `@playwright/test` 1.64.0 (also installs `playwright` 1.64.0; `pnpm exec playwright install chromium`). Run the app with `HIGGSFIELD_BASE_URL` pointed at an msw-driven mock, or with the `MOCK_PROVIDERS=1` flag that swaps the Higgsfield client for a fixture implementation.
- **Mocking Higgsfield / Anthropic HTTP - `msw` 3.0.3** (2026-09-28; ESM-only, Node >=22.12, peer typescript >=5.9). `setupServer(http.post("https://platform.higgsfield.ai/v1/...", ...))` intercepts `fetch` in both the worker and Route Handler tests (Node's undici `fetch` is supported via `@mswjs/interceptors`). Handlers can simulate the submit -> poll -> `completed` state machine with a per-test in-memory map, plus 429/5xx to exercise retry/backoff. The Anthropic SDK also uses `fetch`, so the same server can return canned `messages` JSON (or just set `client` to a stub in unit tests). `nock` 15.0.1 works too but is `http`-module-centric; msw 3 gives one mocking layer for Node, Vitest browser mode and Playwright (`msw/browser`) if ever needed. Source: [msw 3.0.0 notes](https://newreleases.io/project/npm/msw/release/3.0.0).
- ffmpeg in tests: generate 1-2 s synthetic inputs with `-f lavfi -i testsrc=size=640x360:rate=30 -t 2` so assembly tests have no fixtures to commit; assert via ffprobe JSON (duration, dimensions).

---

## 10. Keeping the desktop option open (Tauri 2 / Electron)

Design the Next app as "a Node HTTP server plus a browser", never as "a Vercel deployment". Concretely: no `runtime = "edge"` anywhere (proxy.ts is Node-only in 16 anyway); all filesystem roots come from `env.DATA_DIR` with a per-OS default (`~/Library/Application Support/JewelryStudio`, `%APPDATA%\JewelryStudio`) resolved at runtime, never `process.cwd()` or `/public`; bind to `127.0.0.1` on a port discovered at startup (`PORT=0` -> read the actual port) rather than hard-coding 3000, and avoid `NEXT_PUBLIC_*` URLs that bake a port into the client bundle; `output: "standalone"` so the whole server is `node .next/standalone/server.js`; native deps limited to better-sqlite3 (N-API, Electron-safe) and sharp (prebuilt); ffmpeg resolved from a configurable path so a packaged app can ship its own binary under the app resources dir; the worker started by the same supervisor as the server (today `concurrently`, later the Rust/Electron main process) with explicit SIGTERM handling so no zombie ffmpeg processes survive quit; keep `localStorage` usage trivial. With those rules, **Tauri 2** (`@tauri-apps/cli` 2.12.2, `@tauri-apps/api` 2.12.3) can bundle Node as a sidecar (`externalBin`) and point its WebView at the standalone server (reported working, ~160 MB bundles, with known gotchas: empty PATH in macOS GUI apps, zombie sidecars, baked-in ports); **Electron 44.7.2** (engines node >=22.12) is the lower-risk path because it already ships Node and better-sqlite3's N-API build loads without rebuild. Sources: [Tauri Node sidecar guide](https://v2.tauri.app/ja/learn/sidecar-nodejs/), [worldmonitor desktop builds](https://www.mintlify.com/koala73/worldmonitor/deployment/desktop-builds).

---

## 11. Local file storage layout and serving media

Layout (all under `DATA_DIR`, content-addressed where cheap, human-browsable where it matters):
```
DATA_DIR/
  studio.sqlite  (+ -wal, -shm)
  projects/<projectId>/
    refs/<assetId>.<ext>            # uploaded product/reference images (original)
    shots/<shotId>/
      candidates/<jobId>-<n>.png    # Higgsfield image outputs
      clips/<jobId>.mp4             # Higgsfield video outputs
      frames/<jobId>-first.png, -last.png
      masks/<maskId>.png
    renders/<renderId>.mp4          # assembled videos
    exports/                        # final deliverables the user asked for
  cache/thumbs/<assetId>-<w>.webp   # regenerable, safe to delete
  tmp/                              # ffmpeg scratch, cleaned on worker start
  logs/worker.log, logs/ffmpeg/<jobId>.log
```
Rules: the DB stores paths **relative to `DATA_DIR`**; file writes are atomic (`write tmp -> rename`); every asset row has `sha256`, `width`, `height`, `duration_ms`, `bytes` so the UI never has to probe.

Serving to the browser - **Route Handler with Range support** (`app/api/media/[...path]/route.ts`):
- Resolve `path.join(DATA_DIR, ...segments)` and reject anything that does not `startsWith(DATA_DIR + sep)` after `path.resolve` (traversal guard); map extension -> MIME; `stat` for size and `ETag`/`Last-Modified`; on `Range: bytes=a-b` respond `206` with `Content-Range`, `Accept-Ranges: bytes`, `Content-Length`, and `Readable.toWeb(fs.createReadStream(p, { start, end }))` as the body; `HEAD` support; `Cache-Control: private, max-age=0, must-revalidate` for originals, `immutable` for content-addressed thumbs. Range support is what makes `<video>` scrubbing and Safari playback work - Safari refuses to play MP4 from a server that ignores `Range`.
- Rejected: **symlinks into `/public`** (`/public` is served only from build-time contents in production, Turbopack watches it in dev, Windows symlinks need privileges, and it leaks the whole data dir), and **`next.config` rewrites** to a static server (a second process to supervise, and the rewrite proxy buffers bodies - the same problem that breaks SSE).
- Use plain `<img src="/api/media/...">` and `<video src=...>`; no `next/image` (set `images.unoptimized: true`).

---

## 12. Node version and package manager

- **Node 24.21.0** ("Krypton", Active LTS; enters Maintenance 2026-10-20, EOL 2028-04-30). Node 26.11.1 is current but **not LTS until 2026-10-28**; Node 22.23.3 is in Maintenance. Every pinned package's `engines` is satisfied by 24 (`vitest` ^22.12||^24, `msw` >=22.12, `better-sqlite3` >=22, `concurrently` >=22, `nanoid` ^22||^24, `jsdom` ^22.22||^24.15, `electron` >=22.12, `next` >=20.9). Plan: move the pin to Node 26 LTS in Q1 2027 once better-sqlite3 13.x and sharp 0.35.x prebuilds for Node 26 are confirmed on macOS arm64 and Windows x64. Sources: [nodejs.org/dist/index.json](https://nodejs.org/dist/index.json), [nodejs/Release schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json).
- **pnpm 12.11.2** (stable since 2026-08-26; Rust rewrite, native executable that does not itself need Node, can auto-provision the project's Node via `devEngines`/`packageManager`; note `latest` on npm may still point at the 11 line - install via the standalone script or `corepack`/`packageManager` pin). Why over npm 11: strict, non-flat `node_modules` catches phantom imports between `app/` and `worker/`; content-addressed store makes the large native deps (sharp, better-sqlite3, ffmpeg-static) install once; `onlyBuiltDependencies` is an explicit allowlist for postinstall scripts (ffmpeg-static's binary download, better-sqlite3's prebuild check). Source: [pnpm 12 release](https://pnpm.io/blog/releases/12.0).
- `package.json`: `"packageManager": "pnpm@12.11.2"`, `"engines": { "node": ">=24.0.0 <27" }`, `.npmrc`: `engine-strict=true`.

---

## Pinned `package.json` (exact versions verified on registry.npmjs.org, 2026-10-14)

```json
{
  "name": "jewelry-studio",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.11.2",
  "engines": { "node": ">=24.0.0 <27" },
  "dependencies": {
    "next": "16.4.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "better-sqlite3": "13.0.3",
    "drizzle-orm": "0.45.4",
    "sharp": "0.35.5",
    "ffmpeg-static": "5.3.0",
    "@derhuerst/ffprobe-static": "5.3.0",
    "@anthropic-ai/sdk": "0.133.0",
    "zod": "4.6.7",
    "@t3-oss/env-nextjs": "0.13.11",
    "@t3-oss/env-core": "0.13.11",
    "p-limit": "7.3.3",
    "nanoid": "6.0.2",
    "pino": "10.4.0",
    "dotenv": "18.0.7",
    "@tanstack/react-query": "5.104.2",
    "react-hook-form": "7.90.0",
    "@hookform/resolvers": "5.9.1",
    "@dnd-kit/core": "6.3.1",
    "@dnd-kit/sortable": "10.0.0",
    "@dnd-kit/modifiers": "9.0.0",
    "@dnd-kit/utilities": "3.2.2",
    "react-compare-slider": "4.0.0",
    "react-zoom-pan-pinch": "4.2.0",
    "konva": "10.8.0",
    "react-konva": "19.3.0",
    "media-chrome": "4.19.3",
    "react-virtuoso": "4.18.19",
    "sonner": "2.0.8",
    "radix-ui": "1.8.1",
    "lucide-react": "1.57.0",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "3.7.0",
    "tw-animate-css": "1.4.0"
  },
  "devDependencies": {
    "typescript": "^6",
    "@types/node": "26.6.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@types/better-sqlite3": "9.6.0",
    "drizzle-kit": "0.31.11",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "shadcn": "4.21.4",
    "eslint": "10.12.0",
    "eslint-config-next": "16.4.0",
    "tsx": "4.23.15",
    "concurrently": "10.0.6",
    "cross-env": "10.1.0",
    "vitest": "5.0.4",
    "vite": "8.3.4",
    "@vitest/coverage-v8": "5.0.4",
    "@vitejs/plugin-react": "6.1.2",
    "@testing-library/react": "16.3.3",
    "jsdom": "30.1.2",
    "msw": "3.0.3",
    "@playwright/test": "1.64.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "sharp", "ffmpeg-static", "@derhuerst/ffprobe-static"]
  }
}
```
Deliberately **not** included: `fluent-ffmpeg` (deprecated), `@types/fluent-ffmpeg`, `ffprobe-static` 3.1.0 (2022), `@ffmpeg-installer/ffmpeg` 1.1.0 (2021), `prisma` (8.0.0-rc on latest), `@libsql/client`, `better-queue` (2022), `plainjob` (0.0.x), `@hello-pangea/dnd`, `fabric`, `@tanstack/react-virtual`, `nock`, `happy-dom`, `@dnd-kit/react` (0.5.0, pre-1.0).

Optional, version-verified if wanted later: `@tauri-apps/cli` 2.12.2 / `@tauri-apps/api` 2.12.3, `electron` 44.7.2, `@tanstack/react-virtual` 3.14.19, `happy-dom` 21.0.1, `nock` 15.0.1, `fabric` 7.4.0, `@hello-pangea/dnd` 18.0.1.

---

## Could not verify / caveats

1. **Exact latest TypeScript 6.x patch** - only `latest` (7.0.2) and dist-tags were queried; pin `typescript@^6` and let pnpm resolve, or query `npm view typescript@6 version` before locking.
2. **better-sqlite3 13.0.3 prebuilds for Node 26** - README says prebuilds cover LTS lines; no explicit Node 26 asset list was retrievable (GitHub release assets blocked by the proxy). Verified only that v13 is N-API and ships binaries in-package.
3. **Whether `next dev` buffers SSE differently from `next start`** - no source found; the reported buffering is specific to `rewrites()`. Test with `curl -N` on both.
4. **Next 16's default `serverExternalPackages` list** (whether better-sqlite3/sharp are already included) - unpkg was blocked; setting the option explicitly is harmless.
5. **node:sqlite stability in the Node 24.x docs specifically** - the current (26.x) docs page says "1.2 Release candidate" (RC since 25.7.0); Node 24's own page was not fetched. Either way it is not Stability 2.
6. **Anthropic prompt-caching minimum for Haiku 5.5 / Sonnet 5.5 / Opus 5.5** - the skill table says 512 tokens but flags "check the prompt caching docs before relying on their values".
7. **Haiku 5.5 vision tier** - inferred from the doc's "Claude 4.7 and later models" rule; the doc does not list Haiku 5.5 by name.
8. **Higgsfield Cloud REST API** specifics (endpoints, auth headers, rate limits, polling cadence) were out of scope and not researched here; the msw mock design assumes a submit/poll/result shape.
9. **ffmpeg-static 5.3.0 binary availability for win32-arm64 / linux-arm64** - the package's download matrix was not enumerated; darwin-arm64/x64 and win32-x64 are the documented targets. ARM Windows users should set `FFMPEG_PATH`.
10. **Drizzle 1.0 GA date** - rc.4 on 2026-06-27 is the latest pre-release; no GA announcement found.

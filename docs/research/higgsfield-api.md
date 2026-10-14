# Higgsfield Cloud API — Engineering Reference (researched 2026-10-14)

Scope: the programmatic, pay-as-you-go **Higgsfield Cloud API** (`api.higgsfield.ai`, console at `console.higgsfield.ai` / `cloud.higgsfield.ai` / `open.higgsfield.ai`), NOT the consumer web app / MCP / `higgsfield` consumer CLI (those use a different catalog with `job_set_type` ids like `nano_banana_pro`; see §11 for the mapping).

Confidence legend used throughout:
- **[SRC]** confirmed from source code / machine-generated schema files read in full (official SDKs, schemas synced from Higgsfield's per-model `llms.txt`).
- **[DOC]** from docs.higgsfield.ai content surfaced through search-engine summaries (the docs host is DNS-blocked from this container, so pages were not read verbatim).
- **[3P]** from a third-party package/blog that integrates the API (verified against the real API by its author, per its own README).
- **[INF]** inference; not verified. Do not build on it without a live test.

Sources actually read (all downloaded into `scratchpad/dl/`):
- npm `@higgsfield/client` **0.2.6** (2026-09-17) — full `dist/` + README + `RELEASE_NOTES.md` (from git clone of `higgsfield-ai/higgsfield-js`).
- PyPI `higgsfield-client` **0.2.0** — full `src/` + README + tests (and git clone of `higgsfield-ai/higgsfield-client`).
- git clone `higgsfield-ai/skills` (agent skills for the consumer CLI; `model-catalog.md`, `media-inputs.md`, `workflows.md`), `higgsfield-ai/cli` (consumer CLI `README.md` + `MODELS.md`).
- git clone `Koushik890/higgsfield-api-skill` (npm `higgsfield-api-skill` 1.0.1): **79 Cloud-API model JSON files generated from `https://dash.higgsfield.ai/models/<endpoint>/llms.txt` on 2026-09-26**, each with the live JSON Schema, example body, pricing note and a USD estimate returned by the real `/estimate` endpoint. This is the closest thing to the docs we could get and is treated as **[SRC]** for schemas.
- npm `@nodetool-ai/higgsfield-nodes` 0.8.3 (manifest of 80 Cloud endpoints with verified field lists), `@digitlimit/higgsfield` 1.0.0-beta.4 (typed SDK; webhook handler), `@lssm/integration.provider-higgsfield` 0.2.1, `@higgsfield/cloud-cli` 0.1.2 (binary wrapper only), `@higgsfield/cli` 1.1.26 (consumer CLI wrapper).
- MCP consumer catalog dump: `/root/.claude/projects/.../mcp-Higgsfield-models_explore-1791973901862.txt` (100 models).
- Generated companions in this folder: `cloud-models-summary.md` (all 79 endpoints, compact), `mcp-params.json` (requested consumer models' raw parameter JSON). Both are also appended at the end of this file.

---

## 1. Hosts, authentication, headers

| Item | Value | Confidence |
|---|---|---|
| Primary base URL | `https://api.higgsfield.ai` | [SRC] default in both official SDKs (`BASE_URL = 'https://api.higgsfield.ai'`, `baseURL: 'https://api.higgsfield.ai'`) |
| Alias base URL | `https://platform.higgsfield.ai` | [3P] `@digitlimit/higgsfield` and `@lssm/...` default to it and call the same `/requests/{id}/status` and `/v1/...` paths. Treat as an alias; prefer `api.higgsfield.ai`. |
| Agent API base | `https://api.higgsfield.ai` (configurable `agentBaseURL`) | [SRC] |
| Key creation | Higgsfield Console (`console.higgsfield.ai`; older links `cloud.higgsfield.ai`, `open.higgsfield.ai`). Each credential = key ID + secret. | [DOC]/[SRC] |
| Auth header (current) | `Authorization: Key <KEY_ID>:<KEY_SECRET>` | [SRC] both SDKs v2 |
| Auth header (legacy v1) | `hf-api-key: <id>` + `hf-secret: <secret>` | [SRC] JS v1 client (deprecated) |
| Content type | `Content-Type: application/json` | [SRC] |
| Env vars (JS SDK) | `HF_CREDENTIALS` or `HF_KEY` = `id:secret`; or `HF_API_KEY` + `HF_API_SECRET` | [SRC] `auth.js` |
| Env vars (Py SDK) | `HF_KEY` = `id:secret`; or `HF_API_KEY` + `HF_API_SECRET` | [SRC] `auth.py` |
| User-Agent sent by SDKs | `higgsfield-server-js/2.0` / `higgsfield-client-py/1.0` | [SRC] |
| Optional request header | `Idempotency-Key` on generation POSTs (same key + same body + same webhook returns the original request instead of a duplicate charge; reusing a key with different params → 422) | [DOC] (one docs page contradicts; newer pages say supported) |
| Response header | `X-Correlation-ID` on every API response | [DOC] |
| Browser use | JS v2 client throws `BrowserNotSupportedError` if `window` exists — server-side only. | [SRC] |
| Billing | Pay-as-you-go USD balance, min top-up $5 [DOC/3P]; failed / NSFW / timed-out requests are not charged (auto-refund) [DOC]. Invoice billing only for committed-use contracts [DOC]. |

---

## 2. Core HTTP surface (everything the app needs)

All generation endpoints are `POST https://api.higgsfield.ai/<endpoint-id>` where `<endpoint-id>` is a slash path such as `higgsfield-ai/soul/v2/standard` or `kling-video/o3/image-reference`. The SDKs just prefix `/` and POST the input object **as the raw JSON body** (v2). [SRC]

| Method & path | Purpose | Body / notes | Conf. |
|---|---|---|---|
| `POST /{endpoint}` | Submit a generation | JSON body = model parameters (see §9). Optional query `?hf_webhook=<urlencoded url>`. Returns `202/200` with `{status:"queued", request_id, status_url, cancel_url}`. | [SRC] |
| `GET /requests/{request_id}/status` | Poll status; when `completed` the same response carries outputs (`images[]`, `video`, …). | Both SDKs use this single URL for status **and** result (`response_url == status_url`). | [SRC] |
| `POST /requests/{request_id}/cancel` | Cancel a request **only while `queued`** | 400 if already processing. | [SRC] Python docstring |
| `POST /files/generate-upload-url` | Get a presigned PUT URL for a local file | Body `{"content_type":"image/jpeg"}` → `{upload_url, public_url, upload_headers?}`. Then `PUT upload_url` with the bytes (no API key!). Use `public_url` in `image_url`/`image_urls`/`video_url`/`audio_url`. | [SRC] both SDKs + tests |
| `POST /estimate/{endpoint}` | Price a request before running it | Body = same params as generation. Returns `{usd: "0.308", ...}` or `{pricing_description: "..."}` when the model is formula-priced. Free. | [3P] `hf.py` (live-tested 2026-09-26) |
| `GET /marketing-studio/image/presets?{query}` | List Marketing Studio image presets (`items[]` with `id,name,type`) | Needed when `enhance_prompt=true` on `marketing-studio/image`. | [3P]/[DOC] |
| `GET /v1/motions` | List DoP motions (v1, legacy) | | [SRC] JS v1 |
| `GET /v1/text2image/soul-styles` | List Soul style presets (`id,name,description,preview_url`) → `style_id` | Works in `@digitlimit` SDK too; status on the v2 catalog unverified. | [SRC] JS v1 |
| `POST /v1/custom-references` / `GET /v1/custom-references/{id}` / `GET /v1/custom-references/list?page=&page_size=` | v1 "SoulId" character training: `{name, input_images:[{type:"image_url", image_url}]}`; statuses `not_ready/queued/in_progress/completed/failed` | Legacy v1; whether still live is **unverified**. | [SRC] JS v1 |
| `POST /v1/text2image/soul`, `POST /v1/image2video/dop`, `POST /v1/speak/higgsfield`, `GET /v1/job-sets/{id}` | v1 legacy generation (body `{params:{...}, webhook?:{url,secret}}`, response `{id, jobs:[{id,status,results:{raw:{url,type},min:{url,type}}}]}`) | Deprecated in README; keep out of new code. | [SRC] |
| `POST /v1/agent/sessions`, `POST /v1/agent/sessions/{id}/messages`, `GET /v1/agent/sessions/{id}/messages?after=`, `POST /v1/agent/sessions/{id}/interrupt`, `POST /v1/agent/media`, `POST /v1/agent/media/{id}/confirm` | Agent API (account must be enabled; 403 otherwise) | Media upload here is slot-based: `{extension,type}` → `{id,type,content_type,upload_url,url}`; PUT bytes; confirm → `{status:"uploaded"}`. | [SRC] |

Model discovery: there is **no model-list endpoint in v2** (the SDK release notes say `getModelSchemas()` was removed because "endpoint not available in v2"). Discover models via the console / `open.higgsfield.ai/models/<endpoint>/api-reference`, or the per-model `https://dash.higgsfield.ai/models/<endpoint>/llms.txt` (machine-readable JSON Schema; this is what `sync_models.py` pulls). [SRC]/[3P]

### 2.1 Request lifecycle & status values

```
queued -> in_progress -> completed | failed | nsfw | canceled
```
- JS v2 type: `'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw'` (polling stops on completed/nsfw/failed). [SRC]
- Python enum adds `canceled` (`StatusEnum.CANCELED = 'canceled'`; class `Cancelled`); `DONE_STATUSES = (Completed, NSFW, Cancelled, Failed)`. [SRC]
- Docs spell the terminal states: completed, failed, nsfw, canceled. [DOC] Accept both `canceled`/`cancelled` defensively (`@digitlimit` does).
- `nsfw` = rejected by moderation, refunded. `failed` = errored or exceeded model-specific timeout, refunded. [DOC]

Submission response (exact shape from README/RELEASE_NOTES) [SRC]:
```json
{
  "status": "queued",
  "request_id": "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff",
  "status_url": "https://api.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/status",
  "cancel_url": "https://api.higgsfield.ai/requests/d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff/cancel"
}
```
Completed status response [SRC]:
```json
{
  "status": "completed",
  "request_id": "d7e6c0f3-…",
  "status_url": "…/status",
  "cancel_url": "…/cancel",
  "images": [{ "url": "https://…/image.jpg" }],
  "video":  { "url": "https://…/video.mp4" }
}
```
- Image models return `images: [{url}]` (array, `batch_size` items). Video models return `video: {url}`. Audio: `@digitlimit` types also allow `audio: {url}` / `audios: [{url}]` [3P/INF]. The schema files list `outputs` per model: images → `["images"]`; video → `["video","zip","mov","jsx","fbx","ply"]` (extra formats are console export options; the JSON response has been observed to carry `video.url` only — **[INF]** for zip/mov/jsx/fbx/ply presence in the API response).
- Robust extraction (`hf.py`): iterate every top-level key that is not `*_url`; collect `item.url` from dict or list values. [3P]
- Generation-level errors: `failed` may carry `error` (string or object) [3P/INF].

### 2.2 Polling guidance
- Docs: start at 2 s, back off ×1.5 to a 10 s cap, add jitter with many workers; stop on terminal; on 5xx/network retry status GET with backoff; 401 → stop; 404 → verify request id. [DOC]
- JS SDK defaults: `pollInterval 2000 ms`, `maxPollTime 300000 ms` (5 min — **too short for 30 s videos; raise it**), continues polling through 5xx. [SRC]
- Python SDK default poll delay **0.5 s** (aggressive) with no timeout. [SRC]
- Third-party clients use 1800 s timeouts for video, 900 s for images. [3P]

### 2.3 Errors & retries (sync HTTP errors)

| HTTP | Meaning (docs) | JS SDK maps to | Py SDK |
|---|---|---|---|
| 400 | invalid params / rejected input / **concurrency limit reached** / cannot cancel | `BadInputError(detail)` | `HiggsfieldClientError(detail)` |
| 401 | bad credentials | `AuthenticationError` | same |
| 402 | insufficient credits (Agent API; `hf.py` also hints "add credits") | `NotEnoughCreditsError` (agents) | `InsufficientCreditsError` (agents) |
| 403 | insufficient credits (generation API per docs & SDK) / agent access disabled | `NotEnoughCreditsError` (name `AccountError`) | — |
| 404 | request or model not found for this account | `APIError` | — |
| 422 | validation (FastAPI-style `detail: [{loc:[], msg}]`) / idempotency-key reuse with different body | `ValidationError(details)` | — |
| 429 | rate limited (hinted by `hf.py`; not in docs' table) | `APIError` | retried (Py default retryable set `{408,429,500,502,503,504}`) |
| 5xx | retry with backoff | retried on POST (JS: ECONNRESET/ETIMEDOUT/ENOTFOUND/≥500; `delay=min(backoff*2^n + rand(0..1s), maxBackoff)`, `maxRetries≤5`) | retried: exp backoff 0.2 s ×2, max 3 |

Error body: `{"detail": "..."}` or `{"detail": [{"loc": [...], "msg": "..."}]}`; Py also looks at `details`/`message`/`error`. [SRC]

Caution [SRC]: the JS v2 client **retries the generation POST** on 5xx/network errors without an idempotency key — a timed-out-but-accepted submission can be double-charged. Send `Idempotency-Key` yourself or implement submit-once semantics (the `@lssm` adapter deliberately submits once and treats ambiguous results as `unknown`).

---

## 3. Webhooks

- Configure per request via query string: `POST /{endpoint}?hf_webhook=<URL-encoded https url>`. Python: `get_url()` appends `'?' + urlencode({'hf_webhook': webhook_url})`; JS v2: `?hf_webhook=${encodeURIComponent(url)}`. [SRC]
- JS v2 `subscribe()` accepts `webhook: {url, secret}` but **only `url` is used** (the `secret` is ignored in v2 code). In v1 the secret was sent in the body as `webhook: {url, secret}` and delivered back as header `X-Webhook-Secret-Key` (helpers.js doc comment). Whether v2 deliveries carry any secret header is **unverified** [INF].
- Payload: docs changelog (2026-08-11) says webhook examples match the "current payload envelope" but no copy of the envelope was retrievable. `@digitlimit` parses the webhook body as the same object as a terminal `/status` response (`status`, `request_id`, `images`/`video`/`audio`, `error`) and keys idempotency on `request_id`. Treat as **[INF]**: on receipt, always re-`GET /requests/{id}/status` and act on that, which makes the payload shape irrelevant.
- Retries: docs say webhook deliveries "use their existing retry behavior" (schedule unknown); `@digitlimit` README: "Higgsfield retries failed webhook deliveries" → make the handler idempotent and answer 2xx fast. [DOC/3P]
- Idempotency-Key reuse rule: a key is tied to endpoint + body + webhook; changing the webhook makes it a different request. [DOC]
- For a local-machine app a webhook needs a public URL (tunnel). Polling is simpler and fully supported; webhooks are optional.

---

## 4. File inputs — can the app send local files? (Question 3f) — YES

**Confirmed [SRC]:** inputs are passed as **HTTPS URLs** (`image_url`, `image_urls[]`, `video_url(s)`, `audio_url(s)`, `first_frame_url`, `last_frame_url`, `end_image_url`, …). There is no base64/multipart generation input. But the API provides its own upload helper so local files are fine:

```
POST https://api.higgsfield.ai/files/generate-upload-url
Authorization: Key ID:SECRET
{"content_type": "image/png"}
→ 200 {"upload_url": "https://<storage>/...?signature=...",
       "public_url": "https://<cdn>/....png",
       "upload_headers": {"content-type": "image/png", "x-amz-tagging": "retention=temporary", ...}}   // optional

PUT <upload_url>            // NO Authorization header; use upload_headers if present else Content-Type
<raw bytes>

→ use public_url in the generation body
```
Notes:
- `upload_headers` must be echoed on the PUT when returned (Python test `test_upload_preserves_server_headers` shows `x-amz-tagging: retention=temporary`, `x-amz-meta-*`) → storage is S3-style and uploads are **temporary**. [SRC]
- Docs: upload URL expires after 1 hour; supported upload types JPEG/JPG/PNG/WebP/GIF, WAV, MP4; the content type on the PUT must match the one requested. [DOC] `hf.py` additionally caps at 500 MB client-side (its own rule). Audio for Seedance/Wan accepts WAV or MP3 per schema descriptions, but the documented *upload* list says WAV — upload MP3 only after a live test [INF].
- Any public HTTPS URL also works (your own S3/R2 bucket, Cloudflare tunnel, etc.). Seedance 2.5 docs: "asset:// references are rejected" — i.e. only real URLs. [DOC]
- Python SDK helpers: `upload(bytes, content_type)`, `upload_file(path)` (mime guessed), `upload_image(PIL.Image, format)`. JS **v2 has no upload helper** (only the deprecated v1 `HiggsfieldClient.upload()/uploadImage()`), so implement the two-step flow yourself (≈15 lines with `fetch`). [SRC]
- Agent API uses a different slot-based upload (`/v1/agent/media` + `/confirm`) — not needed for generation. [SRC]
- Generated **outputs** are returned as plain HTTPS URLs on Higgsfield's CDN; download immediately (see §5).

Recommended app design: `uploadLocalFile(path) → public_url` with an in-memory cache keyed by file hash; re-upload if a job is created more than ~1 h… actually the *public_url* remains readable after the presigned PUT URL expires, but retention of uploaded inputs is unspecified ("retention=temporary" tag) → re-upload per session is the safe default.

---

## 5. Retention, limits, concurrency (Question 3g)

| Topic | Finding | Conf. |
|---|---|---|
| Output URL validity | Generated files are stored **at least 7 days** from creation; may be removed any time after. Download to your own storage. | [DOC] (FAQ + lifecycle page) |
| Input uploads | tagged `retention=temporary`; duration unspecified. | [SRC]/[INF] |
| Rate limits | "Depend on your account and the selected model"; visible in the console dashboard; raise via Discord/console request. No numeric values published. The known-facts figure of **20 concurrent requests** was not found in any source read here — treat as unverified account-level default. | [DOC] |
| Concurrency exceeded | surfaces as **HTTP 400** ("concurrency reached"), not 429. | [DOC] |
| Job TTL / timeouts | model-specific generation timeouts; on timeout status → `failed`, not charged, resubmit allowed. No documented TTL for how long `/requests/{id}/status` stays queryable (assume ≥ 7 days like outputs — [INF]). | [DOC] |
| Cancel | only while `queued`; 400 otherwise. | [SRC] |
| Request id | UUID v4; stable key for polling, cancel, webhook dedupe, support. | [SRC]/[DOC] |
| Image count | `batch_size` 1 or 4 on Soul endpoints; most other image endpoints return 1 image per request. | [SRC] |

---

## 6. Official SDK details

### 6.1 `@higgsfield/client` 0.2.6 (npm, MIT, deps: axios ^1.6.5, form-data) [SRC]
Entry points: `@higgsfield/client` (v1, deprecated) and `@higgsfield/client/v2` (recommended).

```ts
import { higgsfield, config, createHiggsfieldClient, V2Response } from '@higgsfield/client/v2';
config({ credentials: 'KEY_ID:KEY_SECRET' });           // or env HF_CREDENTIALS / HF_KEY / HF_API_KEY+HF_API_SECRET
const res: V2Response = await higgsfield.subscribe('higgsfield-ai/soul/v2/standard', {
  input: { prompt: '...', aspect_ratio: '3:4', resolution: '1080p', batch_size: 4 },
  withPolling: true,                                     // default true; polls GET /requests/{id}/status every pollInterval
  webhook: { url: 'https://…', secret: 'ignored-in-v2' } // → appends ?hf_webhook=
});
if (res.status === 'completed') res.images?.forEach(i => console.log(i.url));
```
- `V2Response = { status, request_id, status_url, cancel_url, images?: {url}[], video?: {url} }`.
- Config: `baseURL` (default `https://api.higgsfield.ai`), `timeout 120000`, `maxRetries 3` (max 5), `retryBackoff 1000`, `retryMaxBackoff 60000`, `pollInterval 2000`, `maxPollTime 300000`, `headers`, `agentBaseURL`.
- **Missing in v2:** no `status(requestId)`, `cancel()`, `upload()` methods — only `subscribe()` and `agents`. If you need cancel/upload/resume-by-id, call the HTTP endpoints directly (trivial) or use `withPolling:false` and poll yourself. There is no typed per-model input (only legacy v1 types for soul/dop/speak), so `input` is `Record<string, any>`.
- Errors exported: `HiggsfieldError, AuthenticationError, CredentialsMissedError, APIError(statusCode,responseData), TimeoutError, NotEnoughCreditsError, ValidationError(details), BadInputError(details), BrowserNotSupportedError`, plus agent errors `AgentAccessDeniedError(403), SessionBusyError(409), AgentBackendError(5xx), AgentTimeoutError`.
- Helpers re-exported from v1: `InputImage.fromUrl`, `InputAudio.fromUrl`, `seed()` (0..1,000,000), `strength()` (0..1), `SoulSize` (13 WxH presets for the v1 Soul endpoint), `SoulQuality {SD:'720p',HD:'1080p'}`, `BatchSize {1,4}`, `DoPModel`, etc.
- Repo: github.com/higgsfield-ai/higgsfield-js (no examples/ folder; `test-nano-banana-pro.ts` referenced in package.json scripts is not published).

### 6.2 `higgsfield-client` 0.2.0 (PyPI, Apache-2.0, dep httpx) [SRC]
Module-level functions: `submit(application, arguments, webhook_url=None) → SyncRequestController`, `subscribe(...)` (submit+poll+get), `status(request_id)`, `result(request_id)`, `cancel(request_id)`, `upload(data, content_type)`, `upload_file(path)`, `upload_image(pil, format)`; `*_async` variants; `SyncClient(base_url, timeout=90, api_key)`; `client.agents`. Status classes `Queued, InProgress, Completed, Failed, NSFW, Cancelled`. Retry: exponential 0.2 s ×2, 3 tries, on `{408,429,500,502,503,504}`.

### 6.3 Other packages worth knowing
- `@higgsfield/cloud-cli` 0.1.2 → `hf-api` Go binary (downloads from github.com/higgsfield-ai/cloud-cli releases; repo not public-readable here). Usage: `HIGGSFIELD_API_KEY="id:secret" hf-api generate <slug> --param prompt="..." --wait`. [SRC README]
- `higgsfield-api-skill` 1.0.1 / `Koushik890/higgsfield-api-skill`: Python `hf.py` with `check/models/info/upload/presets/validate/estimate/run/submit/status/wait/download/list/attach/cancel`, SQLite job ledger; `tools/sync_models.py` regenerates schemas from `dash.higgsfield.ai/models/<endpoint>/llms.txt`. Live-tested 2026-09-26. Great reference implementation of "never double-charge". [3P]
- `@digitlimit/higgsfield` 1.0.0-beta.4: typed SDK with webhook handler; its model constants (`higgsfield-ai/soul/2`, `/soul/character`, `/soul/cinema`, `/soul/reference`, `/soul/id`, `/popcorn/auto`, `/dop/*`, `qwen/qwen-audio-3.0-tts-flash`) come from an **older** Cloud gallery and **none of them appear in the 2026-09-26 catalog** — treat those ids as unverified/legacy [INF].

---

## 7. Cloud API model catalog (as of 2026-09-26 sync; docs say 82 entries for sale on 2026-09-22: 16 image + 66 video)

Endpoint ids below are exact strings to POST to. Sample prices are what `POST /estimate/<endpoint>` returned for the model's *default* example body on 2026-09-26 (before account discounts). Full parameter schemas for every endpoint are in Appendix A.

### 7.1 Image (16 in docs; 15 generation endpoints + Soul ID training)
| Endpoint | Name | Inputs of note | Max res | Sample $ |
|---|---|---|---|---|
| `higgsfield-ai/soul/v2/standard` | Soul 2 | prompt, style_id(uuid), batch_size 1\|4, resolution 720p\|1080p, aspect_ratio 9:16,16:9,4:3,3:4,1:1,2:3,3:2, enhance_prompt, seed 1..1e6. **No image/reference input field in the published schema.** | 1080p | 0.004 |
| `higgsfield-ai/soul/standard` | Soul Standard (v1-era) | same + style_strength 0..1 | 1080p | 0.094 |
| `soul-id` | Soul ID (character training) | **no published inputs — console only** | — | n/a |
| `marketing-studio/image` | Marketing Studio Image (2.0 Alpha) | prompt ≤5000, `image_urls` 0..16 (product first, optional person 2nd when `enhance_prompt=true` + `preset_id`), quality low\|medium\|high, resolution 1k\|2k\|4k, aspect auto,1:1,3:2,2:3,4:3,3:4,16:9,9:16,21:9, moderation auto\|low | **4K** | 0.439 |
| `marketing-studio/image/flare` | same via "GPT Image 2.5 Flare" | same + quality adds xhigh\|max; token-metered | 4K | n/a |
| `marketing-studio/image/sunburst` | same via "Sunburst" variant | same as flare | 4K | n/a |
| `xai/grok-imagine-image-2.0` | Grok Imagine 2.0 (gen+edit) | prompt, `image_urls` 0..10, quality low\|medium, resolution 1k\|2k, aspect auto,1:1,1:2,2:1,3:2,2:3,4:3,3:4,16:9,9:16 | 2K | 0.060 |
| `alibaba/qwen-image-3/edit` | Qwen Image 3 Edit | prompt, `image_urls` 1..3, resolution 1k\|2k, 10 aspect ratios, negative_prompt, seed | 2K | 0.040 |
| `alibaba/qwen-image-3/text-to-image` | Qwen Image 3 | prompt, resolution 1k\|2k, prompt_extend, enable_thinking | 2K | 0.040 |
| `ideogram/v4.0` | Ideogram 4.0 (gen+edit) | prompt 2..2048, single `image_url` + `image_weight` 1..100, 23 aspect ratios, rendering_speed TURBO\|DEFAULT\|QUALITY | n/a | 0.060 |
| `recraft/v4.1/text-to-image` (+ `/pro/`, `/utility/`, `/utility/pro/`) | Recraft V4.1 | prompt ≤10000, colors[{rgb}], background_color, aspect (14), output_format jpg\|png\|webp; pro variants resolution 2k | 1k / 2k (pro) | 0.035 / 0.210 |
| `z-image/turbo` | Z-Image Turbo | prompt ≤800, resolution 1k\|2k, seed, prompt_extend | 2K | 0.015 |

**Not in the Cloud catalog (2026-09-26):** Nano Banana (any), Seedream (any), FLUX (any), GPT Image (except indirectly via `marketing-studio/image/flare`, "GPT Image 2.5 Flare"), Veo, Sora, Kling O1 image, Soul Cast/Location/Cinema, upscalers, background removal, outpaint, reframe, relight, inpaint, lipsync. The official SDK READMEs still show `bytedance/seedream/v4/text-to-image`, `flux-pro/kontext/max/text-to-image` and `nano-banana-pro` as example ids — these are **older** endpoints; whether they still respond is **unverified** (try `POST /estimate/<id>`; a 404 means gone). [SRC]/[INF]

### 7.2 Video (66 entries; 62 synced + Kling O3/Omni/Motion-Control variants)
Families and exact endpoint ids (all `POST /<id>`):
- **Seedance 2.5 (ByteDance)** — `bytedance/seedance-2.5/text-to-video`, `/image-to-video` (`image_url` + optional `end_image_url`), `/reference-to-video` (`image_urls` ≤30, `video_urls` ≤10, `audio_urls` ≤10, ≤50 total), `/video-edit` (`video_url` + refs), `/video-extend` (`video_url`, duration 4..30). duration 4–30 s, resolution **480p|720p only in API**, aspect 16:9,4:3,1:1,3:4,9:16,21:9, bitrate_mode standard|high, generate_audio, output_format mp4|mov (nodetool). Token-metered ($0.0214 / 1k video tokens; 0.6× with video input).
- **Seedance 2.0** — `bytedance/seedance-2.0/text-to-video`, `/image-to-video` (`image_url`, `end_image_url`), `/reference-to-video` (`image_urls` 1..9, `video_urls` 1..3, `audio_urls` 1..3). duration 4–15, resolution **480p|720p|1080p|4k**. Token-metered ($0.014/1k tokens ≤1080p, $0.008 at 4K).
- **Kling 3.0** — `kling-video/v3.0/{std|pro|4k}/{text-to-video|image-to-video}` (i2v: `image_url` + `last_image_url`, duration 3–15, sound on|off, cfg_scale 0..1, `elements[]`, multi_shots + `multi_prompt[≤6]{prompt≤512,duration}`), `kling-video/v3.0-turbo/{text|image}-to-video` (resolution 720p|1080p, no last frame). $0.347 (std) / 0.462 (pro) / 1.155 (4k) / 0.308 (turbo) per 5 s.
- **Kling O3** — `kling-video/o3/image-reference` (`image_urls` + `first_frame_url`/`last_frame_url` + `elements`, mode std|pro|4k, shot_type customize|intelligent, duration 3–15, multi_shots), `kling-video/o3/first-last-frame` (`first_frame_url` required, `last_frame_url`, mode std|pro|4k), `kling-video/o3/video-reference` (`video_urls` exactly 1, `image_urls` ≤4, `elements` ≤4, duration 3–10, mode std|pro), `kling-video/o3/video-edit` (`video_urls` 1, `image_urls` ≤4, mode std|pro|4k). $0.231–0.462.
- **Kling Omni** — `kling-video/omni/image-reference` (`image_urls`, `elements`, duration 3–10, mode std|pro), `/first-last-frame` (duration 5|10), `/video-reference`, `/video-edit` (source video 3–10 s ≤200 MB, ≤4 image_urls, ≤4 elements, prompt ≤2500). $0.308–0.462.
- **Kling 2.6 Pro** `kling-video/v2.6/pro/{text|image}-to-video` (duration 5|10, aspect 16:9,9:16,1:1, sound, cfg_scale); **Kling 2.5 Turbo** `kling-video/v2.5-turbo/{pro|standard}/image-to-video`, `/pro/text-to-video`.
- **Kling Motion Control** — `kling-video/v3/motion-control/{std|pro}` and `kling-video/motion-control/{std|pro}` (2.6): `image_url` + `video_url`, keep_original_sound yes|no, character_orientation image|video. (estimate endpoint errors on these.)
- **Higgsfield Cinema Studio 4.0** — `higgsfield/cinema-studio/4.0`: prompt, `image_urls` ≤30, `video_urls` ≤10, `audio_urls` ≤10, duration 4–30, resolution 480p|720p, aspect (6), generate_audio, plus enums era/genre/light/pacing/camera_lens/camera_model/camera_aperture/camera_movement (33 moves)/color_palette (50). Token-metered.
- **Genjutsu** — `higgsfield/genjutsu/motion-transfer/v1.0`, `higgsfield/genjutsu/object-swap/v1.0`: `video_url` (≥4 s) + `image_urls` 1..8, resolution 720p|480p, prompt ≤10000. $0.318/s @480p, $0.681/s @720p of input video.
- **MiniMax** — `minimax/h3/{text-to-video|image-to-video|reference-to-video}` (2K only, duration 5–15, i2v has `end_image_url`, r2v `image_urls` 1..9 (+$0.08 each beyond 5), `video_urls` ≤3, `audio_urls` ≤3); `minimax/hailuo-2.3/standard/{text|image}-to-video` (768p, duration 6|10, $0.07).
- **Wan** — `alibaba/wan-3.0-prime/{text|image|reference}-to-video` (480p|720p|1080p, duration 2–30, i2v `end_image_url`, r2v `image_urls` ≤10/`video_urls` ≤5/`audio_urls` ≤5, enable_thinking, `file_url`/`link_url`), `alibaba/wan-3.0/{text|image|reference}-to-video` ($0.05/0.10/0.20 per s), `wan/v2.7/{text|image|reference}-to-video` (i2v `end_image_url`, `audio_url`), `wan/v2.6/...`.
- **LTX-2.5** — `lightricks/ltx-2.5/{text|image}-to-video/{fast|pro}`: duration 6|8|10, fps 24|25|50, resolution 720p|1080p (fast adds 2k|4k), aspect 16:9|9:16, i2v `end_image_url`, camera_movement enum.
- **Happy Horse 1.0 / 1.1** — `alibaba/happy-horse[/v1.1]/{text|image|reference}-to-video` (r2v `image_urls` 1..9, duration 2–15, 720p|1080p).
- **Grok Imagine Video 1.5** — `xai/grok-imagine-video/v1.5/reference-to-video`: prompt, `image_url` (first frame), `image_urls` ≤7, `audio_url`, duration 1–15, resolution 480p|720p|1080p, aspect (8). $0.40.
- **PixVerse V6** — `pixverse/v6/{text|image}-to-video` (listed in nodetool catalog; schema not synced).

Pricing summary (list, pre-discount, per docs/blog/pricing page [DOC]): video is per generated second (e.g. Kling 3.0 list $0.084/s, discounted $0.042/s; Seedance 2.5 ≈$0.145–0.206/s; Wan 3.0 $0.05–0.20/s by resolution), images per image (Soul 2 $0.0032–0.004, Marketing Studio Image $0.0059–0.016 on the explore page but `/estimate` returned $0.439 for the default 2k/high body — **always call `/estimate`**).

---

## 8. Capability matrix (Questions 3a–3e)

### 3a. Multiple reference images for product identity (jewelry) and character identity
| Model / endpoint | Multi-ref field & limit | Identity use | Conf. |
|---|---|---|---|
| `marketing-studio/image` (and `/flare`, `/sunburst`) | `image_urls` 0..16 (product image first; with `enhance_prompt=true` + `preset_id`: 1–2 URLs = product + optional person). Resolution up to 4K. | **Best Cloud-API option for product (jewelry) shots**; explicitly designed for product + model reference. | [SRC] |
| `xai/grok-imagine-image-2.0` | `image_urls` 0..10 | general edit/reference; identity fidelity unverified | [SRC] |
| `alibaba/qwen-image-3/edit` | `image_urls` 1..3 ordered | instruction edits with references | [SRC] |
| `ideogram/v4.0` | single `image_url` + `image_weight` | one reference only | [SRC] |
| `higgsfield-ai/soul/v2/standard` | **none published** (only `style_id`). Consumer app/CLI sends `custom_reference_id` (Soul ID) and one `image_reference`; Cloud docs list "Soul ID training" as console-only. | Character identity via Soul ID is **not reachable through the published v2 schema**; v1 `/v1/custom-references` + `custom_reference_id` on `/v1/text2image/soul` existed but is deprecated/unverified. | [SRC]/[INF] |
| Video: `kling-video/o3/image-reference`, `kling-video/omni/image-reference` | `image_urls` (unbounded in schema; docs say ≤4 on video-edit/video-reference) + `elements[]` (Kling "element" ids = Kling-side trained character/object identities, must belong to your account; **no documented Cloud endpoint to create elements**) | product + character references into video | [SRC]/[DOC] |
| Video: `bytedance/seedance-2.5/reference-to-video` | `image_urls` ≤30 (+video ≤10, audio ≤10, ≤50 total) | strongest multi-reference video (identity across shots) | [SRC]/[DOC] |
| Video: `bytedance/seedance-2.0/reference-to-video` | `image_urls` 1..9 | 4K-capable reference video | [SRC] |
| Video: `higgsfield/cinema-studio/4.0` | `image_urls` ≤30 | | [SRC] |
| Video: `minimax/h3/reference-to-video` | `image_urls` 1..9 (first 5 free) | | [SRC] |
| Video: `alibaba/wan-3.0[-prime]/reference-to-video` | `image_urls` ≤10 | | [SRC] |
| Video: `xai/grok-imagine-video/v1.5/reference-to-video` | `image_urls` ≤7 | | [SRC] |
| Video: `alibaba/happy-horse[/v1.1]/reference-to-video` | `image_urls` 1..9 | | [DOC]/[SRC] |
| Genjutsu motion-transfer / object-swap | `image_urls` 1..8 + source `video_url` | **swap a product/character into an existing video** | [SRC] |
| Consumer-only (NOT Cloud): Nano Banana Pro/2 (`image_references` ≤14), Seedream 4.5 (≤14) / 5 Pro, Flux Kontext (≤4), GPT Image 2.5 (≤16), Kling O1 Image (≤10), Soul 2 w/ `custom_reference_id` | — | only via web app / MCP / consumer CLI | [SRC consumer CLI] |

### 3b. Start frame + end frame (storyboard frame-to-frame) — Cloud API
`bytedance/seedance-2.5/image-to-video` (`image_url`,`end_image_url`), `bytedance/seedance-2.0/image-to-video` (same, up to 4K), `kling-video/v3.0/{std|pro|4k}/image-to-video` (`image_url`,`last_image_url`), `kling-video/o3/first-last-frame` & `kling-video/o3/image-reference` (`first_frame_url`,`last_frame_url`, mode up to 4k), `kling-video/omni/first-last-frame` (duration 5|10), `minimax/h3/image-to-video` (`image_url`,`end_image_url`, 2K), `alibaba/wan-3.0[-prime]/image-to-video` (`image_url`,`end_image_url`, 2–30 s), `wan/v2.7/image-to-video`, `lightricks/ltx-2.5/image-to-video/{fast|pro}` (`image_url`,`end_image_url`). **Not** supported: Kling 3.0 Turbo, Kling 2.6/2.5, Hailuo 2.3, Happy Horse, Grok video (first frame only), Cinema Studio 4.0 (references only; consumer version has start/end roles). [SRC]

### 3c. Video extension / continuation
- `bytedance/seedance-2.5/video-extend` — `video_url` + prompt, `duration` 4–30 (new length), optional `image_urls`/`audio_urls`/`video_urls`, 480p|720p. [SRC]
- `bytedance/seedance-2.5/video-edit` and `kling-video/{o3|omni}/video-edit`, `kling-video/{o3|omni}/video-reference` — edit/restyle existing clips (not extension). [SRC]
- No other Cloud extension endpoint found. Consumer app: Seedance 2.5 `--mode video_extension`, Cinema Studio 4.0 `video_extension` mode. [SRC consumer]

### 3d. Image editing utilities (inpaint/mask, relight, upscale, background removal, outpaint, reframe)
Cloud API (2026-09-26): **none of these exist as dedicated endpoints.** Editing is only prompt-driven via `alibaba/qwen-image-3/edit`, `xai/grok-imagine-image-2.0` (image_urls), `ideogram/v4.0` (image_url), `marketing-studio/image` (image_urls). Video: `kling-video/*/video-edit`, `bytedance/seedance-2.5/video-edit`, Genjutsu object-swap. [SRC] — Consumer catalog (web/MCP/CLI) has `outpaint` (aspect_ratio), `reframe` (video, aspect/resolution), `image_background_remover`, `video_background_remover`, `topaz_image` (9 params), `bytedance_image_upscale`, `video_upscale`, `gpt_image_2` `--is_inpaint` + `--mask`, `nano_banana_2` mask role, `sync_so` lipsync, `relight` (MCP tool only). See Appendix B for their parameters.

### 3e. Max resolution / 4K availability (Cloud API)
- Image 4K: `marketing-studio/image` (+flare/sunburst) only. 2K: Grok Imagine 2.0, Qwen Image 3, Z-Image Turbo, Recraft pro variants. Soul 2: 1080p (`resolution` "720p"/"1080p"; consumer quality "1.5k"/"2k" maps to these).
- Video 4K: Seedance 2.0 (`resolution: "4k"`), Kling 3.0 4k endpoints, Kling O3 `mode: "4k"` (image-reference, first-last-frame, video-edit), LTX-2.5 fast (`2k|4k`). 2K: MiniMax H3. 1080p: Seedance 2.5 **not** (API caps at 720p even though consumer app allows 1080p), Kling 3.0 Turbo, Wan 3.0/2.7/2.6, Happy Horse, Grok video, LTX pro. 720p: Cinema Studio 4.0, Genjutsu, Seedance 2.5. [SRC]

---

## 9. Request body examples (exact field names) [SRC schemas]

```jsonc
// Soul 2 — editorial model shot
POST /higgsfield-ai/soul/v2/standard
{"prompt":"…","aspect_ratio":"3:4","resolution":"1080p","batch_size":4,"enhance_prompt":true,"seed":4242,"style_id":"<uuid from /v1/text2image/soul-styles>"}

// Marketing Studio Image — jewelry on a model, product + person references
POST /marketing-studio/image
{"prompt":"…","image_urls":["https://…/ring.png","https://…/model.jpg"],"quality":"high","resolution":"4k","aspect_ratio":"4:5","moderation":"auto","enhance_prompt":false}
// preset mode: {"enhance_prompt":true,"preset_id":"<uuid from GET /marketing-studio/image/presets>","image_urls":[product, person?], "quality":"high" (forced)}

// Kling O3 image-reference → video with product refs and a start frame
POST /kling-video/o3/image-reference
{"prompt":"…","image_urls":["https://…/ring-front.png","https://…/ring-side.png"],"first_frame_url":"https://…/shot1.png","last_frame_url":"https://…/shot2.png","mode":"pro","duration":5,"aspect_ratio":"9:16","sound":"off","shot_type":"customize","multi_shots":false}

// Kling 3.0 Pro frame-to-frame
POST /kling-video/v3.0/pro/image-to-video
{"prompt":"…","image_url":"https://…/a.png","last_image_url":"https://…/b.png","duration":5,"sound":"off","cfg_scale":0.5}

// Seedance 2.5 reference-to-video (identity across shots)
POST /bytedance/seedance-2.5/reference-to-video
{"prompt":"…","image_urls":["…"],"duration":8,"resolution":"720p","aspect_ratio":"9:16","bitrate_mode":"high","generate_audio":false}

// Seedance 2.5 extend
POST /bytedance/seedance-2.5/video-extend
{"prompt":"…","video_url":"https://…/clip.mp4","duration":10,"resolution":"720p","generate_audio":false}

// Seedance 2.0 4K image-to-video with end frame
POST /bytedance/seedance-2.0/image-to-video
{"prompt":"…","image_url":"…","end_image_url":"…","duration":5,"resolution":"4k","generate_audio":false}

// Estimate first (free)
POST /estimate/kling-video/o3/image-reference   (same body) → {"usd":"0.231"} | {"pricing_description":"…"}
```

---

## 10. Recommended Node/TypeScript implementation (derived from the above)

1. Thin client over `fetch` (no need for the SDK): `post(endpoint, body, {idempotencyKey, webhook?})`, `status(id)`, `cancel(id)`, `estimate(endpoint, body)`, `upload(path)`. Headers: `Authorization: Key ${id}:${secret}`, `Content-Type: application/json`, `Idempotency-Key: <uuid per logical job>`.
2. Submit once; persist `request_id` immediately; on network ambiguity re-send with the **same** Idempotency-Key (docs) rather than blind retry.
3. Poll `GET /requests/{id}/status` 2 s → ×1.5 → 10 s cap with jitter; retry 5xx/network; terminal on `completed|failed|nsfw|canceled|cancelled`; time-box per model (images 15 min, video 30 min+).
4. On `completed`, download every `url` found under `images[]`, `video`, `audio`, `audios[]` straight away (≥7-day retention, could vanish after). Media hosts need no auth header — never send the API key to them.
5. Inputs: `POST /files/generate-upload-url` → PUT with returned `upload_headers` → use `public_url`. Cache by content hash per run. Supported types: jpg/jpeg/png/webp/gif, wav, mp4.
6. Validate bodies against the JSON Schemas in Appendix A before submitting (saves 422s and money); call `/estimate` and show cost.
7. Handle 400 "concurrency" by queueing locally (no documented limit; start with ≤5 in flight and raise after checking the console dashboard).
8. Optional: refresh schemas from `https://dash.higgsfield.ai/models/<endpoint>/llms.txt` (unverified reachability from your network).

---

## 11. Consumer (MCP / web / `higgsfield` CLI) ids vs Cloud API endpoint ids

Consumer `job_set_type` ids come from the MCP dump and `higgsfield-ai/cli/MODELS.md`; "Cloud endpoint" is the matching `api.higgsfield.ai` path if one exists. Confidence: [SRC] when both sides are in source; [INF] when the mapping is by name only.

| Consumer id | Consumer name | Cloud API endpoint | Notes |
|---|---|---|---|
| `soul_2` / `soul_v2` / CLI `text2image_soul_v2` | Higgsfield Soul 2.0 | `higgsfield-ai/soul/v2/standard` [SRC] | Consumer adds `soul_id`→`custom_reference_id`, 1 image ref, quality 1.5k/2k = 720p/1080p. Cloud schema has no reference fields. |
| `soul_cinematic`, `soul_cinema_studio`, `soul_cast`, `soul_location` | Soul Cinema / Cast / Location | **none** | consumer only |
| `nano_banana_pro` (CLI alias `nano_banana_2`), `nano_banana_2` (MCP = NB2), `nano_banana_2_1`, `nano_banana_2_lite`, `nano_banana_flash`, `nano_banana` | Nano Banana family | **none** in current catalog (`nano-banana-pro` appears only in SDK release notes) [INF] | ≤14 image refs; NB2 has `mask` role |
| `seedream_v5_pro`, `seedream_v4_5`, `seedream_v5_lite`, `seedream_5_0_flash` | Seedream | **none** current (`bytedance/seedream/v4/text-to-image` in Py README — legacy/unverified) | ≤14 refs on 4.5 |
| `flux_3_image`, `flux_2`, `flux_kontext`, `flux_2_pro_outpaint` | FLUX | **none** current (`flux-pro/kontext/max/text-to-image` in JS README — legacy/unverified) | |
| `gpt_image_2_5`, `gpt_image_2`, `openai_hazel` | GPT Image | only via `marketing-studio/image/flare` ("GPT Image 2.5 Flare") and `/sunburst` [SRC] | consumer `gpt_image_2` supports `is_inpaint`+`mask` |
| `kling_omni_image` | Kling O1 Image | **none** | ≤10 refs |
| `kling3_0` (mode std/pro/4k) | Kling v3.0 | `kling-video/v3.0/{std,pro,4k}/{text,image}-to-video` [SRC] | start/end → `image_url`/`last_image_url` |
| `kling3_0_turbo` | Kling 3.0 Turbo | `kling-video/v3.0-turbo/{text,image}-to-video` [SRC] | |
| `kling2_6` | Kling 2.6 | `kling-video/v2.6/pro/{text,image}-to-video` [SRC] | |
| `kling_o3_image_reference` | Kling 3.0 Omni (image reference) | `kling-video/o3/image-reference` [SRC] | |
| `kling_o3_flf` | Kling 3.0 Omni (Frames) | `kling-video/o3/first-last-frame` [SRC] | |
| `kling_video_edit` | Kling 3.0 Omni Edit | `kling-video/o3/video-edit` (also `/o3/video-reference`) [SRC] | |
| `kling3_0_motion_control` | Kling 3.0 Motion Control | `kling-video/v3/motion-control/{std,pro}` [SRC] | |
| `seedance_2_0`, `seedance_2_0_mini` | Seedance 2.0 | `bytedance/seedance-2.0/{text,image,reference}-to-video` [SRC] | consumer has `mode std/fast`, `genre`; mini has no 4K |
| `seedance_2_5` (modes t2v/omni_reference/video_edit/video_extension) | Seedance 2.5 | `bytedance/seedance-2.5/{text-to-video,image-to-video,reference-to-video,video-edit,video-extend}` [SRC] | consumer allows 1080p; API 480p/720p |
| `seedance1_5` | Seedance 1.5 Pro | **none** | |
| `cinematic_studio_video_4_0` | Cinema Studio 4.0 | `higgsfield/cinema-studio/4.0` [SRC] | consumer exposes start/end frames + modes; API is references only |
| `cinematic_studio_3_0`, `_3_5`, `_v2`, `cinematic_studio_video`, `cinematic_studio_2_5` (image) | older Cinema Studio | **none** | |
| `minimax_h3`, `minimax_h3_max` | MiniMax H3 | `minimax/h3/{text,image,reference}-to-video` [SRC] (max → ? [INF]) | |
| `minimax_hailuo` | Hailuo (2.3 variants) | `minimax/hailuo-2.3/standard/{text,image}-to-video` [SRC] | |
| `grok_video_v15`, `grok_video_v15_lite`, `grok_video` | Grok Video | `xai/grok-imagine-video/v1.5/reference-to-video` [SRC] | |
| `grok_image`, `grok_image_2_0` | Grok Image | `xai/grok-imagine-image-2.0` [SRC] | |
| `flux_3_video`, `flux_3_video_edit` | FLUX 3 Video | **none** | |
| `wan2_6`, `wan2_7`, `wan3_0`, `wan3_0_prime` | Wan | `wan/v2.6/*`, `wan/v2.7/*`, `alibaba/wan-3.0/*`, `alibaba/wan-3.0-prime/*` [SRC] | |
| `happy_horse_video` | Happy Horse | `alibaba/happy-horse[/v1.1]/*` [SRC] | |
| `hf_mult_motion_control` / `hf_mult_replace_object` | Genjutsu | `higgsfield/genjutsu/motion-transfer/v1.0` / `higgsfield/genjutsu/object-swap/v1.0` [SRC] | |
| `veo3`, `veo3_1`, `veo3_1_lite`, `gemini_omni`, `sora*` | Google / OpenAI video | **none** | |
| `recraft_v4_1` (model_type standard/vector/utility/utility_vector) | Recraft | `recraft/v4.1/{,pro/,utility/,utility/pro/}text-to-image` [SRC] | |
| `ideogram_4_5` | Ideogram 4.5 | `ideogram/v4.0` (older version) [INF] | |
| `z_image` | Z Image | `z-image/turbo` [SRC] | |
| `marketing_studio_image` / `ms_image` (DTC Ads) / `marketing_studio_video` | Marketing Studio | `marketing-studio/image` (+flare/sunburst) [SRC]; video: **none** | |
| `sync_so` (Sync Lipsync 3), `text2speech_v2`, `sonilo_music`, `seed_audio`, `elevenlabs_*`, `voice_change`, `dubbing` | audio / lipsync | **none** (`qwen/qwen-audio-3.0-tts-flash` listed by @digitlimit — unverified) | |
| `outpaint`, `reframe`, `image_background_remover`, `video_background_remover`, `topaz_image`, `topaz_video`, `video_upscale`, `bytedance_image_upscale`, `image_decompose`, `video_deflicker`, `draw_to_video` | edit utilities | **none** | |
| `multi_image_to_3d`, `image_to_3d`, `sam_3_3d`, `3d_rigging` | 3D | **none** | |
| `brain_activity` | Virality Predictor | **none** | |

Consumer catalog access paths: web app; MCP server (`mcp__Higgsfield__generate_image/video`, `models_explore`, `media_upload`); `higgsfield` CLI (`higgsfield generate create <job_set_type> … --wait`, OAuth login, credit-based). None of these use the `Key id:secret` API.

---

## 12. What could NOT be verified
1. Any docs.higgsfield.ai page verbatim (DNS-blocked); in particular the **webhooks** page (payload envelope, signature header, retry schedule), **rate limits** page (numbers; the "20 concurrent requests" figure), **billing & retention** page beyond the 7-day minimum.
2. Whether legacy endpoints still respond: `bytedance/seedream/v4/text-to-image`, `flux-pro/kontext/max/text-to-image`, `nano-banana-pro`, all `/v1/*` (soul, dop, speak, custom-references, motions, soul-styles), and `@digitlimit`'s `higgsfield-ai/soul/{2,character,cinema,reference,id}`, `popcorn/auto`, `dop/*`.
3. How to train/use a Soul ID (character identity) through the Cloud API — published schema has no inputs; `custom_reference_id` on `soul/v2/standard` is an inference from the consumer CLI.
4. How Kling `elements[]` ids are created for API accounts (no endpoint found).
5. Exact `/estimate` response schema beyond `usd` / `pricing_description` (observed by a third party).
6. Whether MP3 uploads are accepted by `/files/generate-upload-url` (docs list WAV; model schemas mention MP3).
7. PixVerse V6 and `marketing-studio/image/sunburst` full schemas (only ids / assumed same as flare).
8. Presence of `zip/mov/jsx/fbx/ply` output keys in API responses (listed as model "outputs" but only `video.url` observed).
9. Nothing was executed against the live API (no key in this container).

---

## Appendix A — Full parameter summary of all 79 Cloud API endpoints (generated from schemas synced 2026-09-26 from dash.higgsfield.ai/models/<endpoint>/llms.txt) [SRC]

Format per param: `name`: type enum|values [min..max] items[min..max] maxLen default=… (URL = string with format uri). "required" lists schema-required fields; conditional requirements are shown raw.

### `alibaba/happy-horse/image-to-video`  — Happy Horse 1.0 (image2video)
- summary: Happy Horse 1.0 - Image to Video. Configured Alibaba route; cloned from hh/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.490
- required: image_url
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p


### `alibaba/happy-horse/reference-to-video`  — Happy Horse 1.0 (image2video)
- summary: Happy Horse 1.0 - Reference to Video. Configured Alibaba route; cloned from happy-horse/reference-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.490
- required: image_urls, prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_urls`: array
  - `resolution`: string 720p|1080p default=720p


### `alibaba/happy-horse/text-to-video`  — Happy Horse 1.0 (image2video)
- summary: Generates videos from text or image references with clips up to 15 seconds and 1080p resolution.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.490
- required: prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9


### `alibaba/happy-horse/v1.1/image-to-video`  — HappyHorse 1.1 (image2video)
- summary: HappyHorse 1.1 - Image to Video. Configured Alibaba route; cloned from hh/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.630
- required: image_url
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=1080p


### `alibaba/happy-horse/v1.1/reference-to-video`  — HappyHorse 1.1 (image2video)
- summary: HappyHorse 1.1 - Reference to Video. Configured Alibaba route; cloned from happy-horse/reference-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.630
- required: image_urls, prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `image_urls`: array
  - `resolution`: string 720p|1080p default=1080p


### `alibaba/happy-horse/v1.1/text-to-video`  — HappyHorse 1.1 (image2video)
- summary: Generates videos from text or image references with output at 1080p and clips up to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.630
- required: prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `resolution`: string 720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9


### `alibaba/qwen-image-3/edit`  — Qwen Image 3 (image_edit)
- summary: Edit images from an instruction and one to three ordered references with Qwen Image 3.
- outputs: images | sample price (defaults, 2026-09-26): $0.040
- required: prompt, image_urls  (allOf: [{"if":{"required":["enable_thinking"],"properties":{"enable_thinking":{"const":true}}},"then":{"required":["prompt_extend"],"properties":{"prompt_extend":{"const":true}}}}])
- params:
  - `seed`: integer [0..2147483647] — Optional random seed for similar, reproducible results.
  - `prompt`: string — Positive prompt or editing instruction in Chinese or English. Alibaba recommends at most 4,500 tokens.
  - `image_urls`: array items[1..3] — One to three ordered public image URLs used as editing references.
  - `resolution`: string 1k|2k default=1k — Output resolution tier. Both tiers produce PNG images.
  - `aspect_ratio`: string 1:1|2:3|3:2|3:4|4:3|7:9|9:7|9:16|16:9|21:9 default=1:1 — Output aspect ratio. Exact provider-recommended dimensions are selected automatically.
  - `prompt_extend`: boolean default=true — Improve the prompt before generation. Required when thinking mode is enabled.
  - `enable_thinking`: boolean default=true — Use model reasoning to improve image quality. Requires prompt enhancement.
  - `negative_prompt`: string — Content, styles, or artifacts to avoid in the output.
  - `prompt_extend_mode`: string direct default=direct — Direct enhancement is available for every request; agent enhancement is text-to-image only.


### `alibaba/qwen-image-3/text-to-image`  — Qwen Image 3 (text2image)
- summary: Generates images from English or Chinese text, with enhanced prompts and resolution up to 2K.
- outputs: images | sample price (defaults, 2026-09-26): $0.040
- required: prompt  (allOf: [{"if":{"required":["enable_thinking"],"properties":{"enable_thinking":{"const":true}}},"then":{"required":["prompt_extend"],"properties":{"prompt_extend":{"const":true}}}}])
- params:
  - `seed`: integer [0..2147483647] — Optional random seed for similar, reproducible results.
  - `prompt`: string — Positive prompt or editing instruction in Chinese or English. Alibaba recommends at most 4,500 tokens.
  - `resolution`: string 1k|2k default=1k — Output resolution tier. Both tiers produce PNG images.
  - `aspect_ratio`: string 1:1|2:3|3:2|3:4|4:3|7:9|9:7|9:16|16:9|21:9 default=1:1 — Output aspect ratio. Exact provider-recommended dimensions are selected automatically.
  - `prompt_extend`: boolean default=true — Improve the prompt before generation. Required when thinking mode is enabled.
  - `enable_thinking`: boolean default=true — Use model reasoning to improve image quality. Requires prompt enhancement.
  - `negative_prompt`: string — Content, styles, or artifacts to avoid in the output.
  - `prompt_extend_mode`: string direct|agent default=direct — Direct enhancement is available for every request; agent enhancement is text-to-image only.


### `alibaba/wan-3.0/image-to-video`  — Wan 3.0 Image to Video (image2video)
- summary: Generate videos from a starting image with Wan 3.0.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Priced per generated second by resolution: 480p $0.05, 720p $0.10, or 1080p $0.20. Rates shown are before any applicable customer discount.
- required: prompt, image_url
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0-prime/image-to-video`  — Wan 3.0 Prime Image to Video (image2video)
- summary: Generate videos from a starting image with Wan 3.0 Prime.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.980
- required: prompt, image_url
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0-prime/reference-to-video`  — Wan 3.0 Prime Reference to Video (image2video)
- summary: Generate videos guided by reference images with Wan 3.0 Prime.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.980
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `file_url`: string (URL) — One document (docx/xlsx/pptx/pdf/md). Forces deep thinking.
  - `link_url`: string (URL) — One public page. Forces deep thinking. Not combinable with file_url.
  - `audio_urls`: array items[0..5] — Up to 5 files, 30s total. WAV or MP3.
  - `image_urls`: array items[0..10]
  - `resolution`: string 480p|720p|1080p default=1080p
  - `video_urls`: array items[0..5] — Up to 5 clips, 30s total, each 1-30s.
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0-prime/text-to-video`  — Wan 3.0 Prime Text to Video (text2video)
- summary: Generates videos from text or media references with fast processing and clips up to 30 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.980
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0/reference-to-video`  — Wan 3.0 Reference to Video (image2video)
- summary: Generate videos guided by reference images with Wan 3.0.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Priced per generated second by resolution: 480p $0.05, 720p $0.10, or 1080p $0.20. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `file_url`: string (URL) — One document (docx/xlsx/pptx/pdf/md). Forces deep thinking.
  - `link_url`: string (URL) — One public page. Forces deep thinking. Not combinable with file_url.
  - `audio_urls`: array items[0..5] — Up to 5 files, 30s total. WAV or MP3.
  - `image_urls`: array items[0..10]
  - `resolution`: string 480p|720p|1080p default=1080p
  - `video_urls`: array items[0..5] — Up to 5 clips, 30s total, each 1-30s.
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `alibaba/wan-3.0/text-to-video`  — Wan 3.0 Text to Video (text2video)
- summary: Generates videos from text or images with native audio and adjustable duration up to 30 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Priced per generated second by resolution: 480p $0.05, 720p $0.10, or 1080p $0.20. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `seed`: integer [0..2147483647]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..30] default=5 — 2-30 seconds.
  - `resolution`: string 480p|720p|1080p default=1080p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|adaptive default=adaptive
  - `generate_audio`: boolean default=true
  - `enable_thinking`: boolean default=false


### `bytedance/seedance-2.0/image-to-video`  — Seedance 2.0 (image2video)
- summary: Generate videos from text with controls for duration, resolution, aspect ratio, and optional audio. Create polished multi-shot stories for ads, social content, and cinematic scenes
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil(generated video seconds × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Per 1,000 video tokens: 480p/720p/1080p $0.014, 4K $0.008. Rates shown are before any applicable customer discount.
- required: image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p|4k default=720p
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.0/reference-to-video`  — Seedance 2.0 (image2video, video2video)
- summary: Seedance 2.0 Reference to Video generates videos from images or existing videos, allowing customization of duration, resolution, aspect ratio, and audio inputs. It supports image-to-video and video-to-video transformations with optional audio generation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Per 1,000 video tokens: without video input — 480p/720p/1080p $0.014, 4K $0.008; with video input — 480p/720p/1080p $0.0084, 4K $0.0048 (0.6× the standard rate). With video references, both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required:   (conditional: {"if":{"required":["image_urls"]},"then":null,"else":{"required":["video_urls"]}})
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..15] default=5
  - `audio_urls`: array items[1..3]
  - `image_urls`: array items[1..9]
  - `resolution`: string 480p|720p|1080p|4k default=720p
  - `video_urls`: array items[1..3]
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.0/text-to-video`  — Seedance 2.0 (text2video)
- summary: Creates 4K video from text or media references. Supports up to 15 seconds with optional sound.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil(generated video seconds × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Per 1,000 video tokens: 480p/720p/1080p $0.014, 4K $0.008. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..15] default=5
  - `resolution`: string 480p|720p|1080p|4k default=720p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/image-to-video`  — Seedance 2.5 (image2video)
- summary: Seedance 2.5 Image to Video generates videos from a single image URL with optional prompts, customizable duration, resolution, and output format. It supports adding an end image and generating audio to enhance the video output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214. Rates shown are before any applicable customer discount.
- required: image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p default=720p
  - `bitrate_mode`: string standard|high default=high
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/reference-to-video`  — Seedance 2.5 (image2video, video2video)
- summary: Seedance 2.5 Reference to Video generates videos from images, videos, or audio inputs with customizable duration, resolution, aspect ratio, and output format. It supports image-to-video and video-to-video transformations, allowing creative control through prompts and audio integration.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214 without video input or $0.01284 with video input (0.6× the standard rate). With video references, both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required:   (conditional: {"if":{"required":["image_urls"]},"then":null,"else":{"if":{"required":["video_urls"]},"else":{"required":["audio_urls"]}}})
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `audio_urls`: array items[1..10]
  - `image_urls`: array items[1..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[1..10]
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `bitrate_mode`: string standard|high default=high
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/text-to-video`  — Seedance 2.5 (text2video)
- summary: Generates videos from text, images, video, and audio references, with optional audio generation. Supports videos up to 30 seconds with customizable resolution, aspect ratio, and output format.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (rule)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `resolution`: string 480p|720p default=720p
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `bitrate_mode`: string standard|high default=high
  - `output_format`: string mp4|mov default=mp4
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/video-edit`  — Seedance 2.5 (video2video)
- summary: Generate videos from text, images, video, and audio references, with clips up to 30 seconds. Animate images, edit or extend existing footage, and generate audio alongside your video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Video input is required. At 480p or 720p, each 1,000 video tokens cost $0.01284. Both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required: prompt, video_url
- params:
  - `prompt`: string — Write your prompt here
  - `video_url`: string (URL)
  - `audio_urls`: array items[1..10]
  - `image_urls`: array items[1..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[1..10]
  - `bitrate_mode`: string standard|high default=high
  - `generate_audio`: boolean default=true


### `bytedance/seedance-2.5/video-extend`  — Seedance 2.5 (video2video)
- summary: Seedance 2.5 Video Extend generates extended video content from an input video URL and text prompt, supporting up to 30 seconds duration and optional audio or image inputs. It outputs videos in 480p or 720p resolution with mp4 or mov format, allowing control over audio generation and multiple media inputs.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. Video input is required. At 480p or 720p, each 1,000 video tokens cost $0.01284. Both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required: prompt, video_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [4..30] default=5
  - `video_url`: string (URL)
  - `audio_urls`: array items[1..10]
  - `image_urls`: array items[1..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[1..10]
  - `bitrate_mode`: string standard|high default=high
  - `generate_audio`: boolean default=true


### `higgsfield-ai/soul/standard`  — Soul Standard (text2image)
- summary: Generates fashion and lifestyle photos from text, with style presets for editorial and social content.
- outputs: images | sample price (defaults, 2026-09-26): $0.094
- required: prompt
- params:
  - `seed`: integer [1..1000000]
  - `prompt`: string — Write your prompt here
  - `style_id`: string
  - `batch_size`: integer 1|4 default=1
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 9:16|16:9|4:3|3:4|1:1|2:3|3:2 default=4:3
  - `enhance_prompt`: boolean default=true
  - `style_strength`: number [0..1] default=1


### `higgsfield-ai/soul/v2/standard`  — Soul 2 (text2image)
- summary: Generates realistic portraits and fashion images, with natural textures and curated editorial styles.
- outputs: images | sample price (defaults, 2026-09-26): $0.004
- required: prompt
- params:
  - `seed`: integer [1..1000000]
  - `prompt`: string — Write your prompt here
  - `style_id`: string
  - `batch_size`: integer 1|4 default=1
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 9:16|16:9|4:3|3:4|1:1|2:3|3:2 default=4:3
  - `enhance_prompt`: boolean default=true


### `higgsfield/cinema-studio/4.0`  — Cinema Studio 4.0 (video2video)
- summary: Generates cinematic videos from text, image, or video references with automatic scene direction. Supports videos up to 30 seconds, optional sound, and customizable resolution and aspect ratio.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024). Image and audio references do not count as video input. At 480p or 720p, each 1,000 video tokens cost $0.0214 without video input or $0.01284 with video input (0.6× the standard rate). With video references, both input and generated video durations are billable. Rates shown are before any applicable customer discount.
- required: prompt
- params:
  - `era`: string 1960s|1980s|1990s|2000s|2020s
  - `genre`: string epic|drama|noir|comedy|horror|action
  - `light`: string silhouette|practicals|window|overhead-fall|contre-jour|soft-cross
  - `pacing`: string chaotic|dynamic|calm|single-shot
  - `prompt`: string
  - `duration`: integer [4..30] default=5
  - `audio_urls`: array items[0..10]
  - `image_urls`: array items[0..30]
  - `resolution`: string 480p|720p default=720p
  - `video_urls`: array items[0..10]
  - `camera_lens`: string clean-sharp|anamorphic|vintage-anamorphic|warm-vintage|halation-vintage
  - `aspect_ratio`: string 16:9|4:3|1:1|3:4|9:16|21:9 default=16:9
  - `camera_model`: string modern|35mm-film|8mm-film|dv-camcorder
  - `color_palette`: string static-noon|twilight-fable|back-row-kissing-seats|on-the-other-side-of-the-porthole|the-emerald-ambush|highway-standoff|the-faded-fresco|oil-ochre|the-mountain-convent|ghost-in-the-code|pink-velvet|two-days-to-the-horizon|industrial-fog|stairs-go-up|field-post|home-is-the-next-gas-station|glossy-flesh|the-crimson-ballet|neon-rain-at-midnight|the-morning-after-rain|the-iron-borough|the-ground|the-investigation|turquoise-mirage|a-dream-in-color|breakfast-on-schedule|favela-gold|a-hotel-for-one|after-dark|crimson-vigi|the-neighbors-saw-everything|the-grey-channel|mirage-at-noon|bubblegum-boulevard|yellow-room|the-earth-keeps-things-reluctantly|tropic-fever-dream|bioluminescent-night|dont-turn-it-off-im-watching|the-silk-curtain-falls|the-butterfly|playtime|wallpaper-romance|overtime|the-way-home-is-longer|everyone-speaks-in-whispers|runaway-summer|amber-wasteland|the-circus|gasoline-sunset
  - `generate_audio`: boolean default=true
  - `camera_aperture`: string f14-wide-open|f4-moderate|f11-deep-focus
  - `camera_movement`: string snorricam|robot-arm|tilt-up|rack-focus|tilt-down|pov|pan-left|crane-up|pan-right|crane-down|side-tracking|pedestal-up|pedestal-down|handheld|tracking|drone-orbit|dolly-zoom|aerial-pullback|static-shot|bullet-time|whip-pan|slow-zoom-in|arc-left|slow-zoom-out|arc-right|truck-right|dolly-in|truck-left|dolly-out|slider-right|crush-zoom|slider-left|helicopter-shot


### `higgsfield/genjutsu/motion-transfer/v1.0`  — Genjutsu Motion Transfer (video2video)
- summary: Transforms existing videos using image references for different characters, locations, and styles, preserving the original motion, camera movement, and timing throughout the resulting video clip.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per-second pricing. Each second of input video costs $0.318 at 480p or $0.681 at 720p. Input duration is rounded up to the nearest whole second. Rates shown are before any applicable customer discount.
- required: video_url, image_urls
- params:
  - `prompt`: string maxLen=10000 default=
  - `video_url`: string maxLen=2083 (URL)
  - `image_urls`: array items[1..8]
  - `resolution`: string 720p|480p default=720p


### `higgsfield/genjutsu/object-swap/v1.0`  — Genjutsu Object Swap (video2video)
- summary: One video. Endless ways to reimagine it.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per-second pricing. Each second of input video costs $0.318 at 480p or $0.681 at 720p. Input duration is rounded up to the nearest whole second. Rates shown are before any applicable customer discount.
- required: video_url, image_urls
- params:
  - `prompt`: string maxLen=10000 default=
  - `video_url`: string maxLen=2083 (URL)
  - `image_urls`: array items[1..8]
  - `resolution`: string 720p|480p default=720p


### `ideogram/v4.0`  — Ideogram 4.0 (image_edit, text2image)
- summary: Generates and edits images with multilingual text for posters, packaging and other graphic layouts.
- outputs: images | sample price (defaults, 2026-09-26): $0.060
- required: prompt
- params:
  - `prompt`: string maxLen=2048 — Write your prompt here
  - `image_url`: string (URL)
  - `aspect_ratio`: string 1:1|1:2|2:1|2:3|3:2|4:5|5:4|9:16|16:9|5:8|8:5|3:4|4:3|9:22|22:9|9:23|23:9|3:8|8:3|5:12|12:5|1:3|3:1 default=1:1
  - `image_weight`: integer [1..100] — How strongly the output should preserve the input image.
  - `rendering_speed`: string TURBO|DEFAULT|QUALITY default=DEFAULT


### `kling-video/motion-control/pro`  — Kling 2.6 (image2video)
- summary: Kling 2.6 Motion Control (Pro) generates videos by animating a source image using the motion from a provided video. Users can control character orientation and choose to retain the original video's sound for customized video creation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/motion-control/std`  — Kling 2.6 (image2video)
- summary: Kling 2.6 Motion Control (Standard) generates videos by animating a source image using motion from a reference video. Users provide an image URL and a video URL, with options to keep the original sound and align character orientation to either the image or video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/o3/first-last-frame`  — Kling O3 (image2video)
- summary: Generates and edits videos using image or video references, multi-shot scenes and native sound.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required:   (conditional: {"if":{"properties":{"multi_shots":{"const":true}}},"then":{"required":["multi_prompt","first_frame_url"]},"else":{"required":["prompt","first_frame_url"]}})
- params:
  - `mode`: string std|pro|4k default=pro
  - `sound`: string on|off default=off
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_frame_url`: string (URL)
  - `first_frame_url`: string (URL)


### `kling-video/o3/image-reference`  — Kling O3 (image2video)
- summary: Kling O3 Image Reference generates videos from one or multiple images using customizable prompts and settings like duration, aspect ratio, and sound. It supports both single and multi-shot workflows with options for intelligent or customized shot types.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.231
- required:   (conditional: {"if":{"properties":{"multi_shots":{"const":true}}},"then":{"required":["multi_prompt"]},"else":{"required":["prompt"]}})
- params:
  - `mode`: string std|pro|4k default=std
  - `sound`: string on|off default=off
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `shot_type`: string customize|intelligent default=customize
  - `image_urls`: array
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":0}}
  - `last_frame_url`: string (URL)
  - `first_frame_url`: string (URL)


### `kling-video/o3/video-edit`  — Kling O3 (image2video)
- summary: Kling O3 Video Edit generates edited videos from a single input video URL and optional images or elements, guided by a text prompt. Users can select modes including standard, professional, or 4K to customize output quality.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: prompt, video_urls
- params:
  - `mode`: string std|pro|4k default=pro
  - `prompt`: string — Write your prompt here
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]


### `kling-video/o3/video-reference`  — Kling O3 (image2video)
- summary: Kling O3 Video Reference generates videos based on a text prompt and a single reference video URL. Users can customize duration, aspect ratio, and optionally include images or elements to influence the output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: prompt, video_urls
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..10] default=5
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]
  - `aspect_ratio`: string 16:9|9:16|1:1


### `kling-video/omni/first-last-frame`  — Kling Omni (image2video)
- summary: Generates and edits videos using image or video references and controls for start and end frames.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt, first_frame_url
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `last_frame_url`: string (URL)
  - `first_frame_url`: string (URL)


### `kling-video/omni/image-reference`  — Kling Omni (image2video)
- summary: Kling Omni Image Reference generates videos from images and text prompts, allowing customization of duration, aspect ratio, and elements. It supports modes for standard or professional output, making it suitable for creating dynamic video content from static images.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..10] default=5
  - `elements`: array
  - `image_urls`: array
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `kling-video/omni/video-edit`  — Kling Omni (image2video)
- summary: Kling Omni Video Edit enables video generation from a single input video URL combined with text prompts and optional images or elements. Users can select between standard and pro modes to customize the editing process.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: prompt, video_urls
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]


### `kling-video/omni/video-reference`  — Kling Omni (image2video)
- summary: Kling Omni Video Reference generates videos from a single input video URL combined with a text prompt and optional images or elements. It supports customizable duration and aspect ratios, enabling creative video synthesis based on reference footage.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: prompt, video_urls
- params:
  - `mode`: string std|pro default=pro
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..10] default=5
  - `elements`: array items[0..4]
  - `image_urls`: array items[0..4]
  - `video_urls`: array items[1..1]
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `kling-video/v2.5-turbo/pro/image-to-video`  — Kling 2.5 Turbo Pro (image2video)
- summary: Kling 2.5 Turbo Pro converts a single image into a short video clip using a text prompt to guide the animation style. Users can specify video duration, CFG scale for prompt adherence, and provide negative prompts to refine output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.193
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `negative_prompt`: string default=


### `kling-video/v2.5-turbo/pro/text-to-video`  — Kling 2.5 Turbo Pro (text2video)
- summary: Provides high-end text-to-video output featuring seamless movement, cinematic-quality imagery, and standout prompt fidelity
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.193
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `negative_prompt`: string default=


### `kling-video/v2.5-turbo/standard/image-to-video`  — Kling 2.5 Turbo Standard (image2video)
- summary: Generates videos from text prompts and images, with fast generation and precise prompt control.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.116
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `negative_prompt`: string default=


### `kling-video/v2.6/pro/image-to-video`  — Kling 2.6 Pro (image2video)
- summary: Kling 2.6 Pro Image to Video generates short videos from a single image URL using a text prompt to guide the transformation. Users can customize video duration, aspect ratio, sound inclusion, and CFG scale to control creativity and output style.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.385
- required: prompt, image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `aspect_ratio`: string 16:9|9:16|1:1


### `kling-video/v2.6/pro/text-to-video`  — Kling 2.6 Pro (text2video)
- summary: Generates videos and sound from text or images, including dialogue, sound effects and ambience.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.385
- required: prompt
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `cfg_scale`: number [0..1] default=0.5
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `kling-video/v3/motion-control/pro`  — Kling 3.0 (image2video)
- summary: Kling 3.0 Motion Control (Pro) generates videos by animating a source image according to the motion in a provided video. Users can control character orientation and choose to retain the original video's sound for customized motion-driven video creation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/v3/motion-control/std`  — Kling 3.0 (image2video)
- summary: Kling 3.0 Motion Control (Standard) generates videos by animating a source image according to the motion in a provided video. Users can control character orientation and choose to retain the original video's sound for customized video creation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (estimate-error)
- required: image_url, video_url
- params:
  - `prompt`: string default= — Write your prompt here
  - `image_url`: string (URL)
  - `video_url`: string (URL)
  - `keep_original_sound`: string yes|no default=yes
  - `character_orientation`: string image|video default=video — Generate the orientation of the characters in the video, which can be selected to match the image or the video


### `kling-video/v3.0/4k/image-to-video`  — Kling 3.0 4k (image2video)
- summary: Kling 3.0 4K converts a single image URL into a video up to 15 seconds long, with optional sound generation and multi-shot or multi-prompt support. Users can customize duration, prompts, and configuration scale to influence the video output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $1.155
- required: image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `multi_shots`: boolean default=false
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_image_url`: string (URL)


### `kling-video/v3.0/4k/text-to-video`  — Kling 3.0 (text2video)
- summary: Generates videos from text or images, with optional audio generation and output in 4K resolution. Supports multi-shot sequences, start and end frames, and video durations from 3 to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $1.155
- required: 
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}


### `kling-video/v3.0/pro/image-to-video`  — Kling 3.0 Pro (image2video)
- summary: Kling 3.0 Image to Video (Pro) generates videos from a single image URL with optional sound and customizable duration up to 15 seconds. It supports multi-shot sequences with multiple prompts and fine-tuning via CFG scale for creative video outputs.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `multi_shots`: boolean default=false
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_image_url`: string (URL)


### `kling-video/v3.0/pro/text-to-video`  — Kling 3.0 Pro (text2video)
- summary: Kling 3.0 Text to Video (Pro) generates videos from text prompts with customizable duration, aspect ratio, and sound options. It supports multi-shot sequences and fine-tuning via CFG scale for creative video outputs.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.462
- required: 
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `multi_prompt`: array items[0..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}


### `kling-video/v3.0/std/image-to-video`  — Kling 3.0 Standard (image2video)
- summary: Kling 3.0 Standard converts a single image URL into a video clip with optional sound and customizable duration up to 15 seconds. Users can enhance the output with prompts, multiple shots, and control the CFG scale for creative variation.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.347
- required: image_url
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `image_url`: string (URL)
  - `multi_shots`: boolean default=false
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}
  - `last_image_url`: string (URL)


### `kling-video/v3.0/std/text-to-video`  — Kling 3.0 Standard (text2video)
- summary: Generates multi-shot videos from text or images, with native audio and durations up to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.347
- required: 
- params:
  - `sound`: string on|off default=on
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `elements`: array
  - `cfg_scale`: number [0..1] default=0.5
  - `multi_shots`: boolean default=false
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9
  - `multi_prompt`: array items[1..6] items={"prompt":{"type":"string","maxLength":512},"duration":{"type":"integer","maximum":15,"minimum":1}}


### `kling-video/v3.0-turbo/image-to-video`  — Kling 3.0 Turbo (image2video)
- summary: Kling 3.0 Turbo converts a single image into a short video clip using a text prompt to guide the animation. Users can specify the video duration between 3 to 15 seconds and choose between 720p or 1080p resolution for output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p


### `kling-video/v3.0-turbo/text-to-video`  — Kling 3.0 Turbo (text2video)
- summary: Kling 3.0 Turbo generates videos from text prompts, allowing customization of duration (3 to 15 seconds), resolution (720p or 1080p), and aspect ratio (16:9, 9:16, or 1:1). This variant focuses on efficient text-to-video creation with flexible output settings.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.308
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [3..15] default=5
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16|1:1 default=16:9


### `lightricks/ltx-2.5/image-to-video/fast`  — LTX-2.5 Fast (image2video)
- summary: LTX-2.5 Fast Image to Video on Runware with native audio and optional camera movement.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.540
- required: prompt, duration, image_url
- params:
  - `fps`: integer 24|25|48|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p|2k|4k default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `lightricks/ltx-2.5/image-to-video/pro`  — LTX-2.5 Pro (image2video)
- summary: LTX-2.5 Pro Image to Video on Runware with native audio and optional camera movement.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.720
- required: prompt, duration, image_url
- params:
  - `fps`: integer 24|25|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `end_image_url`: string (URL)
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `lightricks/ltx-2.5/text-to-video/fast`  — LTX-2.5 Fast (text2video)
- summary: Generates videos from text or images with native audio, camera motion controls and 4K resolution.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.540
- required: prompt, duration
- params:
  - `fps`: integer 24|25|48|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `resolution`: string 720p|1080p|2k|4k default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `lightricks/ltx-2.5/text-to-video/pro`  — LTX-2.5 Pro (text2video)
- summary: Generates videos from text or images with native audio, camera motion controls and 1080p output.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.720
- required: prompt, duration
- params:
  - `fps`: integer 24|25|50 default=25
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `duration`: integer 6|8|10 default=6
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `generate_audio`: boolean default=true
  - `camera_movement`: string dolly_in|dolly_out|dolly_left|dolly_right|jib_up|jib_down|static|focus_shift


### `marketing-studio/image/flare`  — Marketing Studio Image (image_edit, text2image)
- summary: Generate and edit Marketing Studio images with GPT Image 2.5 Flare.
- outputs: images | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per 1M tokens: text input $5, cached text input $1.25, text output $10; image input $8, cached image input $2, image output $30. Quality defaults to high. Final cost uses actual token usage and standard credit rounding. The initial charge is an estimate reconciled on completion.
- required: prompt  (allOf: [{"if":{"required":["enhance_prompt"],"properties":{"enhance_prompt":{"const":true}}},"then":{"required":["preset_id","image_urls"],"properties":{"image_urls":{"maxItems":2,"minItems":1}}}}])
- params:
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `quality`: string low|medium|high|xhigh|max default=high
  - `preset_id`: string
  - `image_urls`: array items[0..16]
  - `moderation`: string auto|low default=auto
  - `resolution`: string 1k|2k|4k default=2k
  - `aspect_ratio`: string auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9 default=auto
  - `enhance_prompt`: boolean default=false


### `marketing-studio/image/sunburst`  — Marketing Studio Image (image_edit, text2image)
- summary: Generate and edit Marketing Studio images with GPT Image 2.5 Sunburst.
- outputs: images | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: Per 1M tokens: text input $5, cached text input $1.25, text output $10; image input $8, cached image input $2, image output $30. Quality defaults to high. Final cost uses actual token usage and standard credit rounding. The initial charge is an estimate reconciled on completion.
- required: prompt  (allOf: [{"if":{"required":["enhance_prompt"],"properties":{"enhance_prompt":{"const":true}}},"then":{"required":["preset_id","image_urls"],"properties":{"image_urls":{"maxItems":2,"minItems":1}}}}])
- params:
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `quality`: string low|medium|high|xhigh|max default=high
  - `preset_id`: string
  - `image_urls`: array items[0..16]
  - `moderation`: string auto|low default=auto
  - `resolution`: string 1k|2k|4k default=2k
  - `aspect_ratio`: string auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9 default=auto
  - `enhance_prompt`: boolean default=false


### `marketing-studio/image`  — Marketing Studio Image (image_edit, text2image)
- summary: Generates and edits campaign images from text and image inputs, with resolutions from 1K to 4K. Preset mode uses a product photo and an optional model reference to guide the resulting image.
- outputs: images | sample price (defaults, 2026-09-26): $0.439
- required: prompt  (allOf: [{"if":{"required":["enhance_prompt"],"properties":{"enhance_prompt":{"const":true}}},"then":{"required":["preset_id","image_urls"],"properties":{"quality":{"const":"high"},"image_urls":{"maxItems":2,"minItems":1}}}}])
- params:
  - `prompt`: string maxLen=5000 — Write your prompt here
  - `quality`: string low|medium|high default=high
  - `preset_id`: string
  - `image_urls`: array items[0..16]
  - `moderation`: string auto|low default=auto
  - `resolution`: string 1k|2k|4k default=2k
  - `aspect_ratio`: string auto|1:1|3:2|2:3|4:3|3:4|16:9|9:16|21:9 default=auto
  - `enhance_prompt`: boolean default=false


### `minimax/h3/image-to-video`  — MiniMax H3 (image2video)
- summary: MiniMax H3 / Hailuo-03 preview integration using Video Generation V2.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.455
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [5..15] default=5
  - `image_url`: string (URL)
  - `resolution`: string 2K default=2K
  - `aspect_ratio`: string auto|adaptive|21:9|16:9|4:3|1:1|3:4|9:16 default=auto
  - `end_image_url`: string (URL)
  - `aigc_watermark`: boolean default=false


### `minimax/h3/reference-to-video`  — MiniMax H3 (image2video, video2video)
- summary: MiniMax H3 generates videos from reference images or videos using Video Generation V2. Users provide prompts, reference media URLs, and optional audio to create videos up to 15 seconds with customizable resolution and aspect ratio.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): n/a (unpriced)
- pricing: 2K output costs $0.13 per generated second. The first five reference images are included; each additional reference image costs $0.08. Rates shown are before any applicable customer discount.
- required: prompt  (conditional: {"if":{"required":["image_urls"]},"then":null,"else":{"required":["video_urls"]}})
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [5..15] default=5
  - `audio_urls`: array items[0..3]
  - `image_urls`: array items[1..9]
  - `resolution`: string 2K default=2K
  - `video_urls`: array items[1..3]
  - `aspect_ratio`: string auto|adaptive|21:9|16:9|4:3|1:1|3:4|9:16 default=auto
  - `aigc_watermark`: boolean default=false


### `minimax/h3/text-to-video`  — MiniMax H3 (text2video)
- summary: Generates 2K videos up to 15 seconds using text, image, video, and optional audio reference files.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.455
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [5..15] default=5
  - `resolution`: string 2K default=2K
  - `aspect_ratio`: string auto|adaptive|21:9|16:9|4:3|1:1|3:4|9:16 default=auto
  - `aigc_watermark`: boolean default=false


### `minimax/hailuo-2.3/standard/image-to-video`  — MiniMax Hailuo 2.3 Standard (image2video)
- summary: MiniMax Hailuo 2.3 Standard converts a single image into a short video clip of 6 or 10 seconds based on a text prompt. Users provide an image URL and optional prompt optimization to guide the video generation process.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.070
- required: prompt, image_url
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 6|10 default=6
  - `image_url`: string (URL)
  - `prompt_optimizer`: boolean default=true


### `minimax/hailuo-2.3/standard/text-to-video`  — MiniMax Hailuo 2.3 Standard (text2video)
- summary: Generates short videos from text or images with fluid body motion and natural facial expressions.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.070
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 6|10 default=6
  - `prompt_optimizer`: boolean default=true


### `recraft/v4.1/pro/text-to-image`  — Recraft V4.1 Pro (text2image)
- summary: Recraft V4.1 Pro generates images from text prompts with customizable resolution, aspect ratio, output format, and color options. Users can specify background and palette colors to tailor the visual style of the output.
- outputs: images | sample price (defaults, 2026-09-26): $0.210
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 2k default=2k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `recraft/v4.1/text-to-image`  — Recraft V4.1 (text2image)
- summary: Generates images and illustrations using custom palettes and background colors to fit your brand.
- outputs: images | sample price (defaults, 2026-09-26): $0.035
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 1k default=1k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `recraft/v4.1/utility/pro/text-to-image`  — Recraft V4.1 Utility Pro (text2image)
- summary: Recraft V4.1 Utility Pro generates images from text prompts with customizable resolution, aspect ratio, output format, and color options. Users can specify background colors and a palette of colors to influence the image creation process.
- outputs: images | sample price (defaults, 2026-09-26): $0.210
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 2k default=2k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `recraft/v4.1/utility/text-to-image`  — Recraft V4.1 Utility (text2image)
- summary: Recraft V4.1 Utility generates images from text prompts with customizable resolution, aspect ratio, output format, and color options including background and palette colors. This variant focuses on utility features for precise control over image attributes.
- outputs: images | sample price (defaults, 2026-09-26): $0.035
- required: prompt
- params:
  - `colors`: array items={"rgb":{"type":"array","items":{"type":"integer","maximum":255,"minimum":0},"maxItems":3,"minItems":3}}
  - `prompt`: string maxLen=10000 — Write your prompt here
  - `resolution`: string 1k default=1k
  - `aspect_ratio`: string 1:1|2:1|1:2|3:2|2:3|4:3|3:4|5:4|4:5|6:10|14:10|10:14|16:9|9:16 default=1:1
  - `output_format`: string jpg|png|webp default=jpg
  - `background_color`: object


### `soul-id`  — Soul ID (character)
- summary: 
- outputs: images | sample price (defaults, 2026-09-26): n/a (no-inputs)
- required: 
- params:



### `wan/v2.6/image-to-video`  — Wan 2.6 (image2video)
- summary: Wan 2.6 - Image to Video. Configured Alibaba route; cloned from wan-26/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt, image_url
- params:
  - `seed`: integer [-1..10000000]
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10|15 default=5
  - `audio_url`: string (URL)
  - `image_url`: string (URL)
  - `resolution`: string 480p|720p|1080p default=720p
  - `multi_shots`: boolean default=false
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `wan/v2.6/reference-to-video`  — Wan 2.6 (image2video)
- summary: Wan 2.6 - Reference to Video. Configured Alibaba route; cloned from wan-26/references-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt, video_urls
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10 default=5
  - `resolution`: string 720p|1080p default=720p
  - `video_urls`: array items[1..3]
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9


### `wan/v2.6/text-to-video`  — Wan 2.6 (text2video)
- summary: Generates multi-shot videos from text or images with native sound and optional video references.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt
- params:
  - `seed`: integer [-1..10000000]
  - `prompt`: string — Write your prompt here
  - `duration`: integer 5|10|15 default=5
  - `audio_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `multi_shots`: boolean default=false
  - `prompt_extend`: boolean default=false


### `wan/v2.7/image-to-video`  — Wan 2.7 (image2video)
- summary: Wan 2.7 - Image to Video. Configured Alibaba route; cloned from wan-27/image-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: image_url
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `audio_url`: string (URL)
  - `image_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `end_image_url`: string (URL)
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `wan/v2.7/reference-to-video`  — Wan 2.7 (image2video)
- summary: Wan 2.7 - Reference to Video. Configured Alibaba route; cloned from wan-27/reference-to-video.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt  (conditional: {"if":{"required":["image_urls"],"properties":{"image_urls":{"type":"array","minItems":1}}},"then":null,"else":{"required":["video_urls"],"properties":{"video_urls":{"type":"array","minItems":1}}}})
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..10] default=5
  - `image_urls`: array
  - `resolution`: string 720p|1080p default=720p
  - `video_urls`: array
  - `aspect_ratio`: string 16:9|9:16 default=16:9
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `wan/v2.7/text-to-video`  — Wan 2.7 (text2video)
- summary: Generates videos from text or images with native audio and consistent characters across scenes.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.250
- required: prompt
- params:
  - `seed`: integer [1..2147483646]
  - `prompt`: string — Write your prompt here
  - `duration`: integer [2..15] default=5
  - `audio_url`: string (URL)
  - `resolution`: string 720p|1080p default=720p
  - `aspect_ratio`: string 16:9|9:16|1:1|4:3|3:4 default=16:9
  - `prompt_extend`: boolean default=false
  - `negative_prompt`: string default=


### `xai/grok-imagine-image-2.0`  — Grok Imagine 2.0 (image_edit, text2image)
- summary: Generates images and makes precise edits while preserving image details and visual consistency.
- outputs: images | sample price (defaults, 2026-09-26): $0.060
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `quality`: string low|medium default=medium
  - `image_urls`: array items[0..10]
  - `resolution`: string 1k|2k default=1k
  - `aspect_ratio`: string auto|1:1|1:2|2:1|3:2|2:3|4:3|3:4|16:9|9:16 default=auto


### `xai/grok-imagine-video/v1.5/reference-to-video`  — Grok Imagine Video 1.5 (image2video, text2video)
- summary: Creates videos from text prompts or still images, with 1080p resolution and clips up to 15 seconds.
- outputs: video, zip, mov, jsx, fbx, ply | sample price (defaults, 2026-09-26): $0.400
- required: prompt
- params:
  - `prompt`: string — Write your prompt here
  - `duration`: integer [1..15] default=5
  - `audio_url`: string (URL)
  - `image_url`: string (URL)
  - `image_urls`: array items[0..7]
  - `resolution`: string 480p|720p|1080p default=480p
  - `aspect_ratio`: string auto|1:1|16:9|9:16|4:3|3:4|3:2|2:3 default=auto


### `z-image/turbo`  — Z-Image Turbo (text2image)
- summary: Generates images quickly with clear Chinese and English text rendering and PNG output up to 2K.
- outputs: images | sample price (defaults, 2026-09-26): $0.015
- required: prompt
- params:
  - `seed`: integer [0..2147483647] — Optional random seed for similar, reproducible results.
  - `prompt`: string maxLen=800 — Positive prompt describing the desired content, style, and composition.
  - `resolution`: string 1k|2k default=1k — Output resolution tier. Both tiers produce PNG images.
  - `aspect_ratio`: string 1:1|2:3|3:2|3:4|4:3|7:9|9:7|9:16|16:9|21:9 default=1:1 — Output aspect ratio. Exact provider-recommended dimensions are selected automatically.
  - `prompt_extend`: boolean default=false — Rewrite and reason over the prompt before generation; this uses the enhanced price tier.



## Appendix B — Consumer (MCP) catalog raw parameter JSON for the requested models (from models_explore dump; consumer app only, NOT Cloud API) [SRC]

```json
[
  {
    "id": "soul_2",
    "name": "Higgsfield Soul 2.0",
    "provider_name": "Higgsfield",
    "description": "Realistic UGC, fashion editorial and character generation",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "max": 1,
        "roles": [
          "image"
        ],
        "description": "roles: image x1"
      }
    ],
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output quality tier shown as 1.5k or 2k",
        "default": "2k",
        "options": [
          "1.5k",
          "2k"
        ]
      },
      {
        "name": "soul_id",
        "required": "optional",
        "type": "string",
        "description": "Soul-ID for personalized generation. Get one from soul_list."
      }
    ],
    "tags": [
      "ugc",
      "fashion",
      "editorial",
      "realistic",
      "character",
      "character-generation",
      "soul",
      "portrait",
      "v2",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "soul_cast",
    "name": "Soul Cast",
    "provider_name": "Higgsfield",
    "description": "Consistent cinematic character identity",
    "output_type": "image",
    "aspect_ratios": [
      "16:9"
    ],
    "medias": [],
    "parameters": [
      {
        "name": "budget",
        "required": "optional",
        "type": "number",
        "description": "Generation budget (10-500)",
        "default": 50
      }
    ],
    "tags": [
      "character",
      "identity",
      "consistent",
      "cinematic",
      "persona"
    ],
    "supports_unlim": null
  },
  {
    "id": "soul_location",
    "name": "Soul Location",
    "provider_name": "Higgsfield",
    "description": "Environment and location generation",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9",
      "9:21"
    ],
    "medias": [],
    "parameters": [],
    "tags": [
      "environment",
      "location",
      "background",
      "scene",
      "landscape"
    ],
    "supports_unlim": null
  },
  {
    "id": "nano_banana_pro",
    "name": "Nano Banana Pro",
    "provider_name": "Google",
    "description": "Ultimate quality, text and diagrams",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "2k"
      }
    ],
    "tags": [
      "quality",
      "text-rendering",
      "diagrams",
      "photorealistic",
      "versatile",
      "4k",
      "text-to-image",
      "image-to-image",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "nano_banana_2",
    "name": "Nano Banana 2",
    "provider_name": "Google",
    "description": "Fast, next-gen high-quality images",
    "output_type": "image",
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "mask"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "is_inpaint",
        "required": "optional",
        "type": "bool",
        "description": "Whether to restrict the edit to the supplied mask.",
        "default": false
      }
    ],
    "tags": [
      "fast",
      "high-quality",
      "photorealistic",
      "versatile",
      "4k",
      "text-to-image",
      "image-to-image",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "seedream_v4_5",
    "name": "Seedream 4.5",
    "provider_name": "Bytedance",
    "description": "4K output, precise control, transformations",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "4:3",
      "16:9",
      "3:2",
      "21:9",
      "3:4",
      "9:16",
      "2:3"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Output quality tier. 'basic' renders up to 4K; 'high' renders up to ~6K.",
        "options": [
          "basic",
          "high"
        ],
        "default": "basic"
      }
    ],
    "tags": [
      "4k",
      "high-resolution",
      "precise",
      "transformations",
      "editing",
      "control",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "flux_3_image",
    "name": "FLUX 3 Image",
    "provider_name": "Black Forest Labs",
    "description": "FLUX 3 image generation and editing with up to ten reference images",
    "output_type": "image",
    "aspect_ratios": [
      "auto",
      "21:9",
      "2:1",
      "16:9",
      "3:2",
      "7:5",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "5:7",
      "2:3",
      "9:16",
      "1:2"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution class. Exact pixel dimensions depend on aspect ratio.",
        "options": [
          "768sq",
          "1k",
          "1.5k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of output images to generate.",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place generated images in.",
        "nullable": true
      }
    ],
    "tags": [
      "text-to-image",
      "image-to-image",
      "editing",
      "multi-reference",
      "4k"
    ],
    "supports_unlim": null
  },
  {
    "id": "flux_3_video",
    "name": "FLUX 3 Video",
    "provider_name": "Black Forest Labs",
    "description": "Text-to-video, multi-frame image-to-video, and video continuation with synchronized audio",
    "output_type": "video",
    "aspect_ratios": [
      "auto",
      "21:9",
      "2:1",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in whole seconds (5-20).",
        "min": 5,
        "max": 20,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 720p or 1080p.",
        "options": [
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate synchronized speech, effects, and ambience.",
        "default": true
      }
    ],
    "tags": [
      "text-to-video",
      "image-to-video",
      "video-continuation",
      "audio",
      "start-frame",
      "end-frame",
      "storyboard",
      "1080p"
    ],
    "supports_unlim": null
  },
  {
    "id": "flux_kontext",
    "name": "Flux Kontext",
    "provider_name": "Black Forest Labs",
    "description": "Context-aware editing and style transfer",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [],
    "tags": [
      "editing",
      "style-transfer",
      "context-aware",
      "typography",
      "remix"
    ],
    "supports_unlim": null
  },
  {
    "id": "kling_omni_image",
    "name": "Kling O1 Image",
    "provider_name": "Kling",
    "description": "Versatile photorealistic generation",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "3:2",
      "2:3",
      "21:9"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k"
        ],
        "default": "1k"
      }
    ],
    "tags": [
      "photorealistic",
      "versatile",
      "wide-aspect-ratio",
      "realistic",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "gpt_image_2_5",
    "name": "GPT Image 2.5",
    "provider_name": "OpenAI",
    "description": "GPT Image 2.5 generation and editing with Flare and Sunburst variants",
    "output_type": "image",
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "21:9",
      "27:16",
      "16:27",
      "9:8",
      "8:9",
      "4:5",
      "5:4"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "variant",
        "required": "optional",
        "type": "string",
        "description": "Model variant.",
        "options": [
          "flare",
          "sunburst"
        ],
        "default": "flare"
      },
      {
        "name": "quality",
        "required": "optional",
        "type": "string",
        "description": "Rendering quality.",
        "options": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "default": "low"
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "1k",
          "2k",
          "4k"
        ],
        "default": "1k"
      },
      {
        "name": "background",
        "required": "optional",
        "type": "string",
        "description": "Background handling. Omit to keep the model default.",
        "options": [
          "auto",
          "opaque",
          "transparent"
        ],
        "nullable": true
      }
    ],
    "tags": [
      "image-generation",
      "editing",
      "reference-images",
      "4k",
      "text-rendering"
    ],
    "supports_unlim": null
  },
  {
    "id": "seedream_v5_pro",
    "name": "Seedream 5.0 Pro",
    "provider_name": "Bytedance",
    "description": "Pro-tier visual reasoning, instruction-based editing, up to 2K",
    "output_type": "image",
    "aspect_ratios": [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "3:2",
      "2:3",
      "21:9"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution tier.",
        "options": [
          "1k",
          "1.5k",
          "2k"
        ],
        "default": "2k"
      },
      {
        "name": "width",
        "required": "optional",
        "type": "number",
        "description": "Optional output width stored with the generation.",
        "min": 1,
        "nullable": true
      },
      {
        "name": "height",
        "required": "optional",
        "type": "number",
        "description": "Optional output height stored with the generation.",
        "min": 1,
        "nullable": true
      },
      {
        "name": "remove_bg",
        "required": "optional",
        "type": "bool",
        "description": "Remove the background from the generated image.",
        "default": false
      },
      {
        "name": "is_inpaint",
        "required": "optional",
        "type": "bool",
        "description": "Treat the request as an inpaint/edit of the reference image(s) instead of a fresh generation.",
        "default": false
      }
    ],
    "tags": [
      "editing",
      "instruction",
      "reasoning",
      "pro",
      "2k",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "grok_video_v15",
    "name": "Grok Video 1.5",
    "provider_name": "xAI",
    "description": "Multimodal video generation from text, a start image, or image and audio references",
    "output_type": "video",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "image_references",
          "audio_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (2-15).",
        "min": 2,
        "max": 15,
        "default": 5
      }
    ],
    "tags": [
      "audio",
      "cinematic",
      "text-to-video",
      "image-to-video",
      "reference",
      "audio-reference",
      "start-frame",
      "physics",
      "camera-motion",
      "preview"
    ],
    "supports_unlim": null
  },
  {
    "id": "sonilo_music",
    "name": "Sonilo Music",
    "provider_name": "FAL",
    "description": "Text-to-music generation with controllable duration. Game pipeline only.",
    "output_type": "audio",
    "aspect_ratios": [],
    "medias": [],
    "parameters": [
      {
        "name": "duration",
        "required": "required",
        "type": "number",
        "description": "Duration in seconds (e.g. 8)."
      }
    ],
    "tags": [
      "audio",
      "music",
      "text-to-music",
      "fal",
      "sonilo"
    ],
    "supports_unlim": null
  },
  {
    "id": "text2speech_v2",
    "name": "Text to Speech V2",
    "provider_name": "Higgsfield",
    "description": "Text-to-speech with a selectable engine (ElevenLabs, MiniMax, Seed Speech, Vibe Voice, Cozy Voice) via the variant param; preset or reference-element voices (voice_type + voice_id).",
    "output_type": "audio",
    "aspect_ratios": [],
    "medias": [],
    "parameters": [
      {
        "name": "variant",
        "required": "required",
        "type": "string",
        "description": "Text-to-speech engine.",
        "options": [
          "elevenlabs",
          "minimax",
          "seed_speech",
          "vibe_voice",
          "cozy_voice"
        ]
      },
      {
        "name": "voice_type",
        "required": "required",
        "type": "string",
        "description": "Whether voice_id is a built-in preset voice ('preset') or a workspace reference element ('element').",
        "options": [
          "preset",
          "element"
        ]
      },
      {
        "name": "voice_id",
        "required": "required",
        "type": "string",
        "description": "Voice id: a preset voice id when voice_type='preset', or a reference element id when voice_type='element'."
      }
    ],
    "tags": [
      "audio",
      "speech",
      "tts",
      "text-to-speech",
      "voice",
      "preset",
      "reference-element",
      "elevenlabs",
      "minimax",
      "seed_speech",
      "vibe_voice",
      "cozy_voice",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "image_background_remover",
    "name": "Image Background Remover",
    "provider_name": "",
    "description": "",
    "output_type": "image",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [],
    "tags": [],
    "supports_unlim": null
  },
  {
    "id": "sync_so",
    "name": "Sync Lipsync 3",
    "provider_name": "",
    "description": "",
    "output_type": "video",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "input_video",
          "input_audio"
        ]
      }
    ],
    "parameters": [
      {
        "name": "sync_mode",
        "required": "optional",
        "type": "string",
        "description": "How to reconcile a duration mismatch between the video and the audio: 'bounce' ping-pongs the video, 'loop' repeats it, 'cut_off' truncates to the shorter input, 'silence' pads the audio, 'remap' retimes the video.",
        "options": [
          "bounce",
          "loop",
          "cut_off",
          "silence",
          "remap"
        ],
        "default": "bounce"
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place the generated output in.",
        "nullable": true
      }
    ],
    "tags": [],
    "supports_unlim": null
  },
  {
    "id": "outpaint",
    "name": "Outpaint",
    "provider_name": "",
    "description": "",
    "output_type": "image",
    "aspect_ratios": [
      "auto",
      "1:1",
      "3:2",
      "2:3",
      "4:3",
      "3:4",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder placement for the generated image.",
        "nullable": true
      }
    ],
    "tags": [],
    "supports_unlim": null
  },
  {
    "id": "minimax_h3",
    "name": "MiniMax H3",
    "provider_name": "MiniMax",
    "description": "Multimodal video generation with keyframes or image/video/audio references",
    "output_type": "video",
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-15).",
        "min": 4,
        "max": 15,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "2K"
        ],
        "default": "2K"
      },
      {
        "name": "batch_size",
        "required": "optional",
        "type": "number",
        "description": "Number of videos to generate (1-4).",
        "min": 1,
        "max": 4,
        "default": 1
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place the generated video in.",
        "nullable": true
      }
    ],
    "tags": [
      "text-to-video",
      "image-to-video",
      "reference",
      "audio-reference",
      "video-reference",
      "start-frame",
      "end-frame",
      "2k"
    ],
    "supports_unlim": null
  },
  {
    "id": "seedance_2_0",
    "name": "Seedance 2.0",
    "provider_name": "Bytedance",
    "description": "Reference-driven video with image/video/audio reference inputs, consistent identity, multi-SKU; optional generate_audio for native audio",
    "output_type": "video",
    "aspect_ratios": [
      "auto",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "1:1",
      "21:9"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-15).",
        "min": 4,
        "max": 15,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution. 4k/1080p require mode='std'; mode='fast' supports 480p/720p only.",
        "options": [
          "480p",
          "720p",
          "1080p",
          "4k"
        ],
        "default": "720p"
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "'std' = higher quality, supports 480p/720p/1080p/4k; 'fast' = cheaper/faster, supports 480p/720p only.",
        "options": [
          "std",
          "fast"
        ],
        "default": "std"
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "genre",
        "required": "optional",
        "type": "string",
        "description": "Cinematic genre hint.",
        "options": [
          "auto",
          "action",
          "horror",
          "comedy",
          "noir",
          "drama",
          "epic"
        ],
        "default": "auto"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate native audio for the video. Set false for a silent video. Independent of audio_references.",
        "default": true
      }
    ],
    "tags": [
      "reference",
      "identity",
      "consistent",
      "product",
      "multi-sku",
      "e-commerce",
      "audio",
      "audio-reference",
      "video-reference",
      "start-frame",
      "end-frame",
      "4k",
      "high-resolution",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "seedance_2_5",
    "name": "Seedance 2.5",
    "provider_name": "Bytedance",
    "description": "Seedance 2.5 text-to-video, multimodal omni-reference generation, video edit, and video extension",
    "output_type": "video",
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-30).",
        "min": 4,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate audio for the output video.",
        "default": true
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "extension_mode",
        "required": "optional",
        "type": "string",
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise.",
        "options": [
          "backward",
          "forward"
        ],
        "nullable": true
      },
      {
        "name": "draft",
        "required": "optional",
        "type": "bool",
        "description": "Generate a 480p draft that can be finalized within seven days.",
        "default": false
      },
      {
        "name": "draft_job_id",
        "required": "optional",
        "type": "string",
        "description": "Completed draft job to finalize at 1080p.",
        "nullable": true
      }
    ],
    "tags": [
      "text-to-video",
      "reference",
      "identity",
      "audio-reference",
      "video-reference",
      "video-edit",
      "video-extension",
      "480p",
      "720p",
      "1080p"
    ],
    "supports_unlim": null
  },
  {
    "id": "cinematic_studio_video_4_0",
    "name": "Cinema Studio 4.0",
    "provider_name": "Higgsfield",
    "description": "Cinema-grade video generation with automatic prompt direction and camera, lighting, pacing, genre, era, and color controls",
    "output_type": "video",
    "aspect_ratios": [
      "auto",
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image",
          "image_references",
          "video_references",
          "audio_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 't2v' for prompt-only generation, 'omni_reference' for image, video, or audio references, 'video_edit' to edit one reference video (billed by that video's duration; 'duration' and 'aspect_ratio' are ignored), or 'video_extension' to extend a reference video ('aspect_ratio' is ignored — the output follows the extended video).",
        "options": [
          "t2v",
          "omni_reference",
          "video_edit",
          "video_extension"
        ],
        "default": "t2v"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (4-30).",
        "min": 4,
        "max": 30,
        "default": 5
      },
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "generate_audio",
        "required": "optional",
        "type": "bool",
        "description": "Generate audio for the output video.",
        "default": true
      },
      {
        "name": "bitrate_mode",
        "required": "optional",
        "type": "string",
        "description": "'standard' = normal output bitrate; 'high' = higher bitrate output.",
        "options": [
          "standard",
          "high"
        ],
        "default": "standard"
      },
      {
        "name": "extension_mode",
        "required": "optional",
        "type": "string",
        "description": "Extension direction; required for mode 'video_extension' and not allowed otherwise.",
        "options": [
          "backward",
          "forward"
        ],
        "nullable": true
      },
      {
        "name": "era_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the film era.",
        "nullable": true
      },
      {
        "name": "camera_model_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the camera body.",
        "nullable": true
      },
      {
        "name": "camera_lens_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the lens.",
        "nullable": true
      },
      {
        "name": "camera_aperture_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the aperture.",
        "nullable": true
      },
      {
        "name": "pacing_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting montage pacing.",
        "nullable": true
      },
      {
        "name": "genre_id",
        "required": "optional",
        "type": "string",
        "description": "Cinema Studio 4.0 creative-control id selecting the film genre.",
        "nullable": true
      },
      {
        "name": "light",
        "required": "optional",
        "type": "string",
        "description": "Lighting source: 'preset' for a Cinema Studio scheme, 'user' for the caller's saved lighting preset, or 'custom' for a placed rig.",
        "options": [
          "preset",
          "custom",
          "user"
        ],
        "nullable": true
      },
      {
        "name": "light_id",
        "required": "optional",
        "type": "string",
        "description": "Lighting id. Use a Cinema Studio control id with light='preset', a saved lighting-preset id with light='user', or 'custom' for a placed rig.",
        "nullable": true
      },
      {
        "name": "light_custom",
        "required": "optional",
        "type": "string_array",
        "description": "Ordered custom lighting rig. The first source is the key light.",
        "nullable": true
      },
      {
        "name": "color_palette",
        "required": "optional",
        "type": "string",
        "description": "Color palette selection with type 'preset' or 'user' and its id.",
        "nullable": true
      }
    ],
    "tags": [
      "cinematic",
      "director",
      "text-to-video",
      "reference",
      "audio-reference",
      "video-reference",
      "video-edit",
      "video-extension",
      "480p",
      "720p"
    ],
    "supports_unlim": null
  },
  {
    "id": "reframe",
    "name": "Reframe",
    "provider_name": "",
    "description": "",
    "output_type": "video",
    "aspect_ratios": [
      "21:9",
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "video_references",
          "start_image",
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      },
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration of the source video in seconds (used for pricing).",
        "nullable": true
      }
    ],
    "tags": [],
    "supports_unlim": null
  },
  {
    "id": "topaz_image",
    "name": "Topaz",
    "provider_name": "",
    "description": "",
    "output_type": "image",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "output_width",
        "required": "required",
        "type": "number",
        "description": "Target output width in pixels.",
        "min": 1
      },
      {
        "name": "output_height",
        "required": "required",
        "type": "number",
        "description": "Target output height in pixels.",
        "min": 1
      },
      {
        "name": "face_enhancement",
        "required": "optional",
        "type": "bool",
        "description": "Enable dedicated face enhancement.",
        "default": false
      },
      {
        "name": "face_enhancement_creativity",
        "required": "optional",
        "type": "number",
        "description": "Face enhancement creativity (0-1). Applies when face_enhancement is enabled.",
        "min": 0,
        "max": 1,
        "default": 0
      },
      {
        "name": "face_enhancement_strength",
        "required": "optional",
        "type": "number",
        "description": "Face enhancement strength (0-1). Applies when face_enhancement is enabled.",
        "min": 0,
        "max": 1,
        "default": 0
      },
      {
        "name": "variant",
        "required": "optional",
        "type": "string",
        "description": "Topaz enhancement model.",
        "options": [
          "Standard V2",
          "Low Resolution V2",
          "CGI",
          "High Fidelity V2",
          "Text Refine"
        ],
        "default": "Standard V2"
      },
      {
        "name": "sharpen",
        "required": "optional",
        "type": "number",
        "description": "Sharpening amount (0-1).",
        "min": 0,
        "max": 1,
        "default": 0
      },
      {
        "name": "denoise",
        "required": "optional",
        "type": "number",
        "description": "Denoising amount (0-1).",
        "min": 0,
        "max": 1,
        "default": 0
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Destination folder id.",
        "nullable": true
      }
    ],
    "tags": [],
    "supports_unlim": null
  },
  {
    "id": "video_upscale",
    "name": "Video Upscale",
    "provider_name": "",
    "description": "",
    "output_type": "video",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "input_video"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration of the source video in seconds. Optional; derived from the video metadata when omitted.",
        "min": 0,
        "nullable": true
      },
      {
        "name": "folder_id",
        "required": "optional",
        "type": "string",
        "description": "Optional folder to place the generated output in.",
        "nullable": true
      }
    ],
    "tags": [],
    "supports_unlim": null
  },
  {
    "id": "kling3_0",
    "name": "Kling v3.0",
    "provider_name": "Kling",
    "description": "Multi-shot, audio sync, motion transfer",
    "output_type": "video",
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15).",
        "min": 3,
        "max": 15,
        "default": 5
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Generation mode: 'std' (standard), 'pro' (higher quality), or '4k' (4K resolution).",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std"
      },
      {
        "name": "sound",
        "required": "optional",
        "type": "string",
        "description": "Generate audio. Use 'off' for silent video and lower credits.",
        "options": [
          "on",
          "off"
        ],
        "default": "on"
      }
    ],
    "tags": [
      "multi-shot",
      "audio",
      "motion-transfer",
      "cinematic",
      "advanced",
      "unlim"
    ],
    "supports_unlim": true
  },
  {
    "id": "kling_o3_image_reference",
    "name": "Kling 3.0 Omni",
    "provider_name": "Kling",
    "description": "Generate video from text and up to seven reference images",
    "output_type": "video",
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15).",
        "min": 3,
        "max": 15,
        "default": 5
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Output quality: Standard, Pro, or 4K.",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std"
      },
      {
        "name": "sound",
        "required": "optional",
        "type": "string",
        "description": "Generate audio or a silent video.",
        "options": [
          "on",
          "off"
        ],
        "default": "on"
      },
      {
        "name": "multi_shots",
        "required": "optional",
        "type": "bool",
        "description": "Generate a sequence of multiple shots.",
        "default": false
      },
      {
        "name": "multi_prompt",
        "required": "optional",
        "type": "string_array",
        "description": "Ordered shot prompts and durations; required when multi_shots is true."
      }
    ],
    "tags": [
      "multi-shot",
      "audio",
      "4k"
    ],
    "supports_unlim": null
  },
  {
    "id": "kling_o3_flf",
    "name": "Kling 3.0 Omni (Frames)",
    "provider_name": "Kling",
    "description": "Generate video from text or a first frame and optional last frame",
    "output_type": "video",
    "aspect_ratios": [
      "16:9",
      "9:16",
      "1:1"
    ],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "start_image",
          "end_image"
        ]
      }
    ],
    "parameters": [
      {
        "name": "duration",
        "required": "optional",
        "type": "number",
        "description": "Duration in seconds (3-15).",
        "min": 3,
        "max": 15,
        "default": 5
      },
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Output quality: Standard, Pro, or 4K.",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "std"
      },
      {
        "name": "sound",
        "required": "optional",
        "type": "string",
        "description": "Generate audio or a silent video.",
        "options": [
          "on",
          "off"
        ],
        "default": "on"
      },
      {
        "name": "multi_shots",
        "required": "optional",
        "type": "bool",
        "description": "Generate a sequence of multiple shots.",
        "default": false
      },
      {
        "name": "multi_prompt",
        "required": "optional",
        "type": "string_array",
        "description": "Ordered shot prompts and durations; required when multi_shots is true."
      }
    ],
    "tags": [
      "multi-shot",
      "audio",
      "4k"
    ],
    "supports_unlim": null
  },
  {
    "id": "kling_video_edit",
    "name": "Kling 3.0 Omni Edit",
    "provider_name": "Kling",
    "description": "Edit a source video with text instructions and optional reference images",
    "output_type": "video",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "video_references",
          "image_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "mode",
        "required": "optional",
        "type": "string",
        "description": "Output quality: Standard, Pro, or 4K.",
        "options": [
          "std",
          "pro",
          "4k"
        ],
        "default": "pro"
      }
    ],
    "tags": [
      "video-edit",
      "reference",
      "4k"
    ],
    "supports_unlim": null
  },
  {
    "id": "hf_mult_motion_control",
    "name": "Genjutsu",
    "provider_name": "Higgsfield",
    "description": "Transfer motion from a reference video to subjects in reference images",
    "output_type": "video",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "video_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      }
    ],
    "tags": [
      "motion-control",
      "image-to-video",
      "video-reference",
      "480p",
      "720p",
      "1080p"
    ],
    "supports_unlim": null
  },
  {
    "id": "hf_mult_replace_object",
    "name": "Genjutsu",
    "provider_name": "Higgsfield",
    "description": "Replace objects in a source video using reference images",
    "output_type": "video",
    "aspect_ratios": [],
    "medias": [
      {
        "name": "medias",
        "type": "image",
        "roles": [
          "image_references",
          "video_references"
        ]
      }
    ],
    "parameters": [
      {
        "name": "resolution",
        "required": "optional",
        "type": "string",
        "description": "Output resolution: 480p, 720p, or 1080p.",
        "options": [
          "480p",
          "720p",
          "1080p"
        ],
        "default": "720p"
      }
    ],
    "tags": [
      "video-edit",
      "object-replacement",
      "reference",
      "480p",
      "720p",
      "1080p"
    ],
    "supports_unlim": null
  }
]
```

### B.2 Consumer catalog overview (all 100 ids in the MCP dump: id, name, provider, output type, media roles, aspect ratios)

| id | name | provider | type | media | aspect ratios |
|---|---|---|---|---|---|
| `soul_2` | Higgsfield Soul 2.0 | Higgsfield | image | medias:image max=1 roles=image | 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3 |
| `soul_cinematic` | Soul Cinema | Higgsfield | image | medias:image max=1 roles=image | 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9 |
| `gpt_image_2` | GPT Image 2 | OpenAI | image | medias:image max=n roles=image | 1:1, 4:3, 3:4, 16:9, 21:9, 9:16, 3:2, 2:3 |
| `cinematic_studio_2_5` | Cinema Studio Image 2.5 | Higgsfield | image | medias:image max=n roles=image | 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 16:9, 9:16, 21:9 |
| `marketing_studio_image` | Marketing Studio Image | Higgsfield | image | medias:image max=n roles=image | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `ms_image` | DTC Ads | Higgsfield | image | medias:image max=14 roles=image | 1:1, 3:2, 2:3, 16:9, 9:16, 4:3, 3:4, 21:9, 27:16, 16:27, 9:8, 8:9, 4:9, 9:4, auto |
| `image_auto` | Auto | Higgsfield | image | medias:image max=n roles=image | 1:1, 4:3, 3:4, 16:9, 9:16 |
| `autosprite` | AutoSprite Animation | Higgsfield | image | medias:image max=1 roles=image |  |
| `soul_cast` | Soul Cast | Higgsfield | image |  | 16:9 |
| `soul_location` | Soul Location | Higgsfield | image |  | 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9, 9:21 |
| `cinematic_studio_3_0` | Cinema Studio Video 3.0 | Higgsfield | video | medias:image max=n roles=image/start_image/end_image | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `cinematic_studio_video` | Cinema Studio Video | Higgsfield | video | medias:image max=n roles=image/start_image/end_image | 1:1, 4:3, 3:4, 16:9, 9:16 |
| `cinematic_studio_video_v2` | Cinema Studio Video | Higgsfield | video | medias:image max=n roles=image/start_image/end_image | 1:1, 4:3, 3:4, 16:9, 9:16 |
| `marketing_studio_video` | Marketing Studio | Higgsfield | video | avatars:image max=n roles=; medias:image max=n roles=image/start_image/end_image | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `higgsfield_preset` | Higgsfield Preset | Higgsfield | video | medias:image max=1 roles=image | 16:9, 9:16, 1:1 |
| `sam_3_3d` | SAM 3 3D Objects | Meta | 3d | medias:image max=1 roles=image |  |
| `image_to_3d` | Image to 3D | Meshy | 3d | medias:image max=1 roles=image |  |
| `multi_image_to_3d` | Multi-Image to 3D | Meshy | 3d | medias:image max=4 roles=image |  |
| `3d_rigging` | 3D Rigging | Meshy | 3d |  |  |
| `soul_v2` | Higgsfield Soul 2.0 | Higgsfield | image | medias:image max=1 roles=image | 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3 |
| `meshy_image_to_3d` | Image to 3D | Meshy | 3d | medias:image max=1 roles=image |  |
| `meshy_multi_image_to_3d` | Multi-Image to 3D | Meshy | 3d | medias:image max=4 roles=image |  |
| `meshy_rigging` | 3D Rigging | Meshy | 3d |  |  |
| `z_image` | Z Image | Tongyi-MAI | image |  | 1:1, 4:3, 3:4, 16:9, 9:16 |
| `nano_banana` | Nano Banana | Google | image | medias:image max=n roles=image_references | 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `nano_banana_pro` | Nano Banana Pro | Google | image | medias:image max=n roles=image_references | 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `nano_banana_2_shots` | Nano Banana Pro |  | image | medias:image max=n roles=image_references | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `nano_banana_2` | Nano Banana 2 | Google | image | medias:image max=n roles=image_references/mask | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `nano_banana_2_1` | Nano Banana 2.1 | Google | image | medias:image max=n roles=image_references/mask/video_references | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9, 4:1, 1:4, 8:1, 1:8 |
| `nano_banana_2_lite` | Nano Banana 2 Lite | Google | image | medias:image max=n roles=image_references/mask | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `seedream_v4_5` | Seedream 4.5 | Bytedance | image | medias:image max=n roles=image_references | 1:1, 4:3, 16:9, 3:2, 21:9, 3:4, 9:16, 2:3 |
| `flux_2` | FLUX.2 | Black Forest Labs | image | medias:image max=n roles=image_references | 1:1, 4:3, 3:4, 16:9, 9:16 |
| `flux_2_pro_outpaint` | FLUX.2 Pro Outpaint | Black Forest Labs | image | medias:image max=n roles=image_references |  |
| `flux_3_image` | FLUX 3 Image | Black Forest Labs | image | medias:image max=n roles=image_references | auto, 21:9, 2:1, 16:9, 3:2, 7:5, 4:3, 5:4, 1:1, 4:5, 3:4, 5:7, 2:3, 9:16, 1:2 |
| `flux_3_video` | FLUX 3 Video | Black Forest Labs | video | medias:image max=n roles=start_image/end_image/image_references/video_references | auto, 21:9, 2:1, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `flux_3_video_edit` | FLUX 3 Video Edit | Black Forest Labs | video | medias:image max=n roles=video_references |  |
| `flux_kontext` | Flux Kontext | Black Forest Labs | image | medias:image max=n roles=image_references | 1:1, 4:3, 3:4, 16:9, 9:16 |
| `kling_omni_image` | Kling O1 Image | Kling | image | medias:image max=n roles=image_references | 1:1, auto, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 21:9 |
| `openai_hazel` | OpenAI Hazel | OpenAI | image | medias:image max=n roles=image_references | 1:1, 3:2, 2:3, auto |
| `gpt_image_2_5` | GPT Image 2.5 | OpenAI | image | medias:image max=n roles=image_references | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, 27:16, 16:27, 9:8, 8:9, 4:5, 5:4 |
| `soul_cinema_studio` | soul_cinema_studio |  | image | medias:image max=n roles=image_references | 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 21:9 |
| `seedream_v5_lite` | Seedream 5.0 Lite | Bytedance | image | medias:image max=n roles=image_references | 1:1, 4:3, 3:4, 16:9, 9:16, 21:9 |
| `seedream_5_0_flash` | Seedream 5.0 Flash | Bytedance | image | medias:image max=n roles=image_references | auto, 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9 |
| `seedream_v5_pro` | Seedream 5.0 Pro | Bytedance | image | medias:image max=n roles=image_references | 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9 |
| `3d_jutsu_angles` | 3D Jutsu Angles | Bytedance | image | medias:image max=n roles=image_references | 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9 |
| `grok_image` | Grok Image | xAI | image | medias:image max=n roles=image_references | 1:1, auto, 1:2, 2:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16 |
| `grok_image_2_0` | Grok Image 2.0 | xAI | image | medias:image max=n roles=image_references | 1:1, auto, 1:2, 2:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16 |
| `ideogram_4_5` | Ideogram 4.5 | Ideogram | image | medias:image max=n roles=image_references/mask | auto, 1:1, 1:2, 2:1, 2:3, 3:2, 4:5, 5:4, 9:16, 16:9, 5:8, 8:5, 3:4, 4:3, 9:22, 22:9, 9:23, 23:9, 3:8, 8:3, 5:12, 12:5, 1:3, 3:1 |
| `grok_video_v15` | Grok Video 1.5 | xAI | video | medias:image max=n roles=start_image/image_references/audio_references |  |
| `grok_video_v15_lite` | Grok Imagine Video 1.5 Lite | xAI | video | medias:image max=n roles=start_image | auto, 16:9, 9:16, 4:3, 3:4, 1:1, 3:2, 2:3 |
| `recraft_v4_1` | Recraft V4.1 | Recraft | image |  | 1:1, 3:4, 4:3, 4:5, 5:4, 3:2, 2:3, 16:9, 9:16 |
| `seed_audio` | Seed Audio 1.0 | ByteDance | audio | medias:image max=n roles=image_references/audio_references |  |
| `qwen_audio_tts` | Qwen Audio 3.0 TTS Flash | Alibaba Cloud | audio |  |  |
| `elevenlabs_v4` | Eleven v4 | ElevenLabs | audio |  |  |
| `elevenlabs_v4_turbo` | Eleven v4 Turbo | ElevenLabs | audio |  |  |
| `sonilo_music` | Sonilo Music | FAL | audio |  |  |
| `mirelo_text_to_audio` | Mirelo Text to Audio | FAL | audio |  |  |
| `inworld_text_to_speech` | Inworld Text to Speech | FAL | audio |  |  |
| `text2speech_v2` | Text to Speech V2 | Higgsfield | audio |  |  |
| `image_background_remover` | Image Background Remover |  | image | medias:image max=n roles=image_references |  |
| `video_background_remover` | Video Background Remover |  | video | medias:image max=n roles=video_references |  |
| `voice_change` | voice_change |  | video | medias:image max=n roles=input_video |  |
| `dubbing` | dubbing |  | video | medias:image max=n roles=input_video |  |
| `sync_so` | Sync Lipsync 3 |  | video | medias:image max=n roles=input_video/input_audio |  |
| `outpaint` | Outpaint |  | image | medias:image max=n roles=image_references | auto, 1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `minimax_hailuo` | Minimax Hailuo | Hailuo | video | medias:image max=n roles=start_image/end_image |  |
| `minimax_h3` | MiniMax H3 | MiniMax | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `minimax_h3_max` | MiniMax H3 Max | MiniMax | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `wan2_6` | Wan 2.6 Video | Wan | video | medias:image max=n roles=image_references/video_references/audio_references | 16:9, 9:16, 1:1 |
| `seedance1_5` | Seedance 1.5 Pro | Bytedance | video | medias:image max=n roles=start_image/end_image | auto, 16:9, 9:16, 4:3, 3:4, 1:1, 21:9 |
| `seedance_2_0` | Seedance 2.0 | Bytedance | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 16:9, 9:16, 4:3, 3:4, 1:1, 21:9 |
| `seedance_2_0_mini` | Seedance 2.0 Mini | Bytedance | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 16:9, 9:16, 4:3, 3:4, 1:1, 21:9 |
| `seedance_2_5` | Seedance 2.5 | Bytedance | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `ad_multiplier` | Ad Multiplier | Higgsfield | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `ad_multiplier_v2` | Ad Multiplier Recreate | Higgsfield | video | medias:image max=n roles=video_references/image_references |  |
| `cinematic_studio_video_4_0` | Cinema Studio 4.0 | Higgsfield | video | medias:image max=n roles=start_image/end_image/image_references/video_references/audio_references | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `draw_to_video` | Draw To Video |  | video | medias:image max=n roles=video/image_references/ref_image | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `reframe` | Reframe |  | video | medias:image max=n roles=video_references/start_image/image_references | 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `topaz_image` | Topaz |  | image | medias:image max=n roles=image_references |  |
| `topaz_image_generative` | Topaz |  | image | medias:image max=n roles=image_references |  |
| `topaz_hyperion_2_5` | Topaz Hyperion 2.5 | topaz | video | medias:image max=n roles=video_references |  |
| `topaz_video` | Topaz |  | video | medias:image max=n roles=video_references | auto, 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 |
| `bytedance_video_upscale` | Bytedance Video Upscale |  | video | medias:image max=n roles=video_references |  |
| `image_decompose` | Image Decompose |  | image | medias:image max=n roles=image_references |  |
| `bytedance_image_upscale` | Bytedance Image Upscale |  | image | medias:image max=n roles=image_references |  |
| `video_upscale` | Video Upscale |  | video | medias:image max=n roles=input_video |  |
| `video_deflicker` | Video Deflicker |  | video | medias:image max=n roles=input_video |  |
| `clipify` | Clipify | Higgsfield | video |  |  |
| `kling2_6` | Kling 2.6 Video | Kling | video | medias:image max=n roles=start_image | 16:9, 9:16, 1:1 |
| `kling3_0` | Kling v3.0 | Kling | video | medias:image max=n roles=start_image/end_image | 16:9, 9:16, 1:1 |
| `kling3_0_turbo` | Kling 3.0 Turbo | Kling | video | medias:image max=n roles=start_image | 16:9, 9:16, 1:1 |
| `kling_o3_image_reference` | Kling 3.0 Omni | Kling | video | medias:image max=n roles=image_references | 16:9, 9:16, 1:1 |
| `kling_o3_flf` | Kling 3.0 Omni (Frames) | Kling | video | medias:image max=n roles=start_image/end_image | 16:9, 9:16, 1:1 |
| `kling_video_edit` | Kling 3.0 Omni Edit | Kling | video | medias:image max=n roles=video_references/image_references |  |
| `happy_horse_video` | Happy Horse Video | Happy Horse | video | medias:image max=n roles=start_image | 16:9, 9:16, 1:1, 4:3, 3:4 |
| `hf_mult_motion_control` | Genjutsu | Higgsfield | video | medias:image max=n roles=image_references/video_references |  |
| `hf_mult_replace_object` | Genjutsu | Higgsfield | video | medias:image max=n roles=image_references/video_references |  |
| `kling3_0_motion_control` | Kling 3.0 Motion Control |  | video | medias:image max=n roles=image_references/video_references |  |
| `grok_video` | Grok Video | xAI | video | medias:image max=n roles=start_image | 16:9, 9:16, 1:1 |
| `gemini_omni` | Gemini Omni Flash | Google | video | medias:image max=n roles=image_references/video_references | 16:9, 9:16 |

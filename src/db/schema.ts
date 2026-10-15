import { sqliteTable, text, integer, real, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = () => Date.now();

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  brandNotes: text("brand_notes"),
  paletteJson: text("palette_json"),
  defaultChannelsJson: text("default_channels_json").notNull().default("[]"),
  coverAssetId: text("cover_asset_id"),
  archived: integer("archived").notNull().default(0),
  lastOpenedAt: integer("last_opened_at"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    kind: text("kind").notNull(), // image|video|audio|mask|font
    role: text("role").notNull(),
    pathRel: text("path_rel").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    fps: real("fps"),
    hasAudio: integer("has_audio"),
    originalName: text("original_name"),
    sourceJobId: text("source_job_id"),
    parentAssetId: text("parent_asset_id"),
    version: integer("version").notNull().default(1),
    providerUrl: text("provider_url"),
    metaJson: text("meta_json"),
    note: text("note"),
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("assets_project_role").on(t.projectId, t.role), index("assets_sha").on(t.sha256), index("assets_parent").on(t.parentAssetId)],
);

export const assetTags = sqliteTable(
  "asset_tags",
  { assetId: text("asset_id").notNull().references(() => assets.id), tag: text("tag").notNull() },
  (t) => [primaryKey({ columns: [t.assetId, t.tag] })],
);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  sku: text("sku"),
  specJson: text("spec_json").notNull(),
  invariantsJson: text("invariants_json").notNull().default("[]"),
  learnedAvoidsJson: text("learned_avoids_json").notNull().default("[]"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const productRefs = sqliteTable(
  "product_refs",
  {
    productId: text("product_id").notNull().references(() => products.id),
    assetId: text("asset_id").notNull().references(() => assets.id),
    role: text("role").notNull(), // front|three_quarter|profile|back|macro|worn|packaging|plate|sheet|other
    isPrimary: integer("is_primary").notNull().default(0),
    approved: integer("approved").notNull().default(1),
    order: integer("order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.assetId] })],
);

export const talent = sqliteTable("talent", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  specJson: text("spec_json").notNull(),
  identityMode: text("identity_mode").notNull().default("reference_pack"), // reference_pack|soul_id
  soulId: text("soul_id"),
  soulStatus: text("soul_status"), // training|ready|failed
  lockedFeaturesJson: text("locked_features_json").notNull().default('["face","hair","skin tone","nails"]'),
  createdAt: integer("created_at").notNull().$defaultFn(now),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const talentRefs = sqliteTable(
  "talent_refs",
  {
    talentId: text("talent_id").notNull().references(() => talent.id),
    assetId: text("asset_id").notNull().references(() => assets.id),
    role: text("role").notNull(), // front|three_quarter|profile|full_body|expression|hands|ears|neck|sheet
    approved: integer("approved").notNull().default(1),
    order: integer("order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.talentId, t.assetId] })],
);

export const outfits = sqliteTable("outfits", {
  id: text("id").primaryKey(),
  talentId: text("talent_id").notNull().references(() => talent.id),
  name: text("name").notNull(),
  specJson: text("spec_json").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const outfitRefs = sqliteTable(
  "outfit_refs",
  { outfitId: text("outfit_id").notNull().references(() => outfits.id), assetId: text("asset_id").notNull().references(() => assets.id), order: integer("order").notNull().default(0) },
  (t) => [primaryKey({ columns: [t.outfitId, t.assetId] })],
);

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // image|video
  briefJson: text("brief_json").notNull().default("{}"),
  status: text("status").notNull().default("draft"),
  directorRunId: text("director_run_id"),
  storyboardJson: text("storyboard_json"),
  settingsJson: text("settings_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const campaignProducts = sqliteTable(
  "campaign_products",
  { campaignId: text("campaign_id").notNull().references(() => campaigns.id), productId: text("product_id").notNull().references(() => products.id), order: integer("order").notNull().default(0) },
  (t) => [primaryKey({ columns: [t.campaignId, t.productId] })],
);

export const campaignTalent = sqliteTable(
  "campaign_talent",
  { campaignId: text("campaign_id").notNull().references(() => campaigns.id), talentId: text("talent_id").notNull().references(() => talent.id), outfitId: text("outfit_id") },
  (t) => [primaryKey({ columns: [t.campaignId, t.talentId] })],
);

export const campaignRefs = sqliteTable(
  "campaign_refs",
  { campaignId: text("campaign_id").notNull().references(() => campaigns.id), assetId: text("asset_id").notNull().references(() => assets.id), role: text("role").notNull().default("style"), note: text("note") },
  (t) => [primaryKey({ columns: [t.campaignId, t.assetId] })],
);

export const shots = sqliteTable(
  "shots",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull().references(() => campaigns.id),
    order: integer("order").notNull().default(0),
    title: text("title").notNull(),
    specJson: text("spec_json").notNull(),
    approved: integer("approved").notNull().default(0),
    status: text("status").notNull().default("planned"),
    selectedAssetId: text("selected_asset_id"),
    keyframeAssetId: text("keyframe_asset_id"),
    clipAssetId: text("clip_asset_id"),
    compiledPromptJson: text("compiled_prompt_json"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("shots_campaign").on(t.campaignId, t.order)],
);

export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    shotId: text("shot_id").references(() => shots.id),
    jobId: text("job_id").notNull(),
    stage: text("stage").notNull().default("stills"), // stills|keyframes|clips|sheet|talent|edit
    capability: text("capability").notNull(),
    lane: text("lane").notNull(),
    modelId: text("model_id").notNull(),
    paramsJson: text("params_json").notNull(),
    promptText: text("prompt_text").notNull().default(""),
    negativeText: text("negative_text"),
    referenceAssetIdsJson: text("reference_asset_ids_json").notNull().default("[]"),
    seed: integer("seed"),
    providerRequestId: text("provider_request_id"),
    estimateUsd: real("estimate_usd"),
    actualUsd: real("actual_usd"),
    estimateCredits: real("estimate_credits"),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    finishedAt: integer("finished_at"),
  },
  (t) => [index("generations_shot").on(t.shotId), index("generations_job").on(t.jobId)],
);

export const candidates = sqliteTable(
  "candidates",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id").notNull().references(() => generations.id),
    shotId: text("shot_id").references(() => shots.id),
    stage: text("stage").notNull().default("stills"),
    assetId: text("asset_id").notNull().references(() => assets.id),
    index: integer("index").notNull().default(0),
    qaJson: text("qa_json"),
    qaScore: real("qa_score"),
    review: text("review").notNull().default("unreviewed"), // unreviewed|approved|rejected|flagged|maybe
    reviewNote: text("review_note"),
    reviewedAt: integer("reviewed_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("candidates_generation").on(t.generationId), index("candidates_shot").on(t.shotId, t.stage)],
);

export const reviewsLog = sqliteTable("reviews_log", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  action: text("action").notNull(),
  note: text("note"),
  at: integer("at").notNull().$defaultFn(now),
});

export const edits = sqliteTable("edits", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  sourceAssetId: text("source_asset_id").notNull().references(() => assets.id),
  resultAssetId: text("result_asset_id"),
  op: text("op").notNull(),
  paramsJson: text("params_json").notNull().default("{}"),
  maskAssetId: text("mask_asset_id"),
  jobId: text("job_id"),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const timelines = sqliteTable("timelines", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  name: text("name").notNull().default("Main"),
  timelineJson: text("timeline_json").notNull(),
  renderAssetId: text("render_asset_id"),
  previewAssetId: text("preview_asset_id"),
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const exportsTable = sqliteTable("exports", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  channelId: text("channel_id").notNull(),
  sourceAssetId: text("source_asset_id").notNull(),
  assetId: text("asset_id"),
  paramsJson: text("params_json").notNull().default("{}"),
  jobId: text("job_id"),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const presets = sqliteTable("presets", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  dataJson: text("data_json").notNull(),
  builtin: integer("builtin").notNull().default(0),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const claudeRuns = sqliteTable("claude_runs", {
  id: text("id").primaryKey(),
  purpose: text("purpose").notNull(),
  model: text("model").notNull(),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  usageJson: text("usage_json"),
  costUsd: real("cost_usd"),
  status: text("status").notNull().default("ok"),
  error: text("error"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payloadJson: text("payload_json").notNull(),
    idempotencyKey: text("idempotency_key"),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: integer("run_after").notNull().$defaultFn(now),
    lockedBy: text("locked_by"),
    lockedAt: integer("locked_at"),
    parentId: text("parent_id"),
    projectId: text("project_id"),
    campaignId: text("campaign_id"),
    label: text("label"),
    resultJson: text("result_json"),
    error: text("error"),
    cancelRequested: integer("cancel_requested").notNull().default(0),
    progressPct: real("progress_pct"),
    progressMessage: text("progress_message"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
    finishedAt: integer("finished_at"),
  },
  (t) => [index("jobs_poll").on(t.status, t.runAfter, t.priority), uniqueIndex("jobs_idem").on(t.idempotencyKey), index("jobs_project").on(t.projectId), index("jobs_parent").on(t.parentId)],
);

export const jobEvents = sqliteTable(
  "job_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id").notNull(),
    ts: integer("ts").notNull().$defaultFn(now),
    kind: text("kind").notNull(),
    dataJson: text("data_json").notNull().default("{}"),
  },
  (t) => [index("job_events_job").on(t.jobId, t.id)],
);

export const ledger = sqliteTable(
  "ledger",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id"),
    lane: text("lane").notNull(),
    provider: text("provider").notNull(),
    modelId: text("model_id").notNull(),
    estimateUsd: real("estimate_usd"),
    actualUsd: real("actual_usd"),
    credits: real("credits"),
    currency: text("currency").notNull().default("usd"),
    note: text("note"),
    projectId: text("project_id"),
    campaignId: text("campaign_id"),
    at: integer("at").notNull().$defaultFn(now),
  },
  (t) => [index("ledger_at").on(t.at), index("ledger_project").on(t.projectId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const uiState = sqliteTable("ui_state", {
  scope: text("scope").primaryKey(),
  dataJson: text("data_json").notNull(),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export const docRevisions = sqliteTable(
  "doc_revisions",
  {
    id: text("id").primaryKey(),
    docType: text("doc_type").notNull(),
    docId: text("doc_id").notNull(),
    revision: integer("revision").notNull(),
    dataJson: text("data_json").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("doc_revisions_doc").on(t.docType, t.docId, t.revision)],
);

export const uploadCache = sqliteTable("upload_cache", {
  sha256: text("sha256").primaryKey(),
  lane: text("lane").notNull(),
  publicUrl: text("public_url").notNull(),
  remoteId: text("remote_id"),
  uploadedAt: integer("uploaded_at").notNull().$defaultFn(now),
});

export const schemaVersion = sql`1`;

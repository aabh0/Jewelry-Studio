CREATE TABLE `asset_tags` (
	`asset_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`asset_id`, `tag`),
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`kind` text NOT NULL,
	`role` text NOT NULL,
	`path_rel` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`fps` real,
	`has_audio` integer,
	`original_name` text,
	`source_job_id` text,
	`parent_asset_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`provider_url` text,
	`meta_json` text,
	`note` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assets_project_role` ON `assets` (`project_id`,`role`);--> statement-breakpoint
CREATE INDEX `assets_sha` ON `assets` (`sha256`);--> statement-breakpoint
CREATE INDEX `assets_parent` ON `assets` (`parent_asset_id`);--> statement-breakpoint
CREATE TABLE `campaign_products` (
	`campaign_id` text NOT NULL,
	`product_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`campaign_id`, `product_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaign_refs` (
	`campaign_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text DEFAULT 'style' NOT NULL,
	`note` text,
	PRIMARY KEY(`campaign_id`, `asset_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaign_talent` (
	`campaign_id` text NOT NULL,
	`talent_id` text NOT NULL,
	`outfit_id` text,
	PRIMARY KEY(`campaign_id`, `talent_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`talent_id`) REFERENCES `talent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`brief_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`director_run_id` text,
	`storyboard_json` text,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`shot_id` text,
	`stage` text DEFAULT 'stills' NOT NULL,
	`asset_id` text NOT NULL,
	`index` integer DEFAULT 0 NOT NULL,
	`qa_json` text,
	`qa_score` real,
	`review` text DEFAULT 'unreviewed' NOT NULL,
	`review_note` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `candidates_generation` ON `candidates` (`generation_id`);--> statement-breakpoint
CREATE INDEX `candidates_shot` ON `candidates` (`shot_id`,`stage`);--> statement-breakpoint
CREATE TABLE `claude_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`model` text NOT NULL,
	`input_json` text,
	`output_json` text,
	`usage_json` text,
	`cost_usd` real,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `doc_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`doc_type` text NOT NULL,
	`doc_id` text NOT NULL,
	`revision` integer NOT NULL,
	`data_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `doc_revisions_doc` ON `doc_revisions` (`doc_type`,`doc_id`,`revision`);--> statement-breakpoint
CREATE TABLE `edits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_asset_id` text NOT NULL,
	`result_asset_id` text,
	`op` text NOT NULL,
	`params_json` text DEFAULT '{}' NOT NULL,
	`mask_asset_id` text,
	`job_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`source_asset_id` text NOT NULL,
	`asset_id` text,
	`params_json` text DEFAULT '{}' NOT NULL,
	`job_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_id` text,
	`job_id` text NOT NULL,
	`stage` text DEFAULT 'stills' NOT NULL,
	`capability` text NOT NULL,
	`lane` text NOT NULL,
	`model_id` text NOT NULL,
	`params_json` text NOT NULL,
	`prompt_text` text DEFAULT '' NOT NULL,
	`negative_text` text,
	`reference_asset_ids_json` text DEFAULT '[]' NOT NULL,
	`seed` integer,
	`provider_request_id` text,
	`estimate_usd` real,
	`actual_usd` real,
	`estimate_credits` real,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `generations_shot` ON `generations` (`shot_id`);--> statement-breakpoint
CREATE INDEX `generations_job` ON `generations` (`job_id`);--> statement-breakpoint
CREATE TABLE `job_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`ts` integer NOT NULL,
	`kind` text NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_events_job` ON `job_events` (`job_id`,`id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`idempotency_key` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_after` integer NOT NULL,
	`locked_by` text,
	`locked_at` integer,
	`parent_id` text,
	`project_id` text,
	`campaign_id` text,
	`label` text,
	`result_json` text,
	`error` text,
	`cancel_requested` integer DEFAULT 0 NOT NULL,
	`progress_pct` real,
	`progress_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_poll` ON `jobs` (`status`,`run_after`,`priority`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idem` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `jobs_project` ON `jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `jobs_parent` ON `jobs` (`parent_id`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`lane` text NOT NULL,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`estimate_usd` real,
	`actual_usd` real,
	`credits` real,
	`currency` text DEFAULT 'usd' NOT NULL,
	`note` text,
	`project_id` text,
	`campaign_id` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ledger_at` ON `ledger` (`at`);--> statement-breakpoint
CREATE INDEX `ledger_project` ON `ledger` (`project_id`);--> statement-breakpoint
CREATE TABLE `outfit_refs` (
	`outfit_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`outfit_id`, `asset_id`),
	FOREIGN KEY (`outfit_id`) REFERENCES `outfits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `outfits` (
	`id` text PRIMARY KEY NOT NULL,
	`talent_id` text NOT NULL,
	`name` text NOT NULL,
	`spec_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`talent_id`) REFERENCES `talent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `presets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`data_json` text NOT NULL,
	`builtin` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_refs` (
	`product_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`approved` integer DEFAULT 1 NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `asset_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`spec_json` text NOT NULL,
	`invariants_json` text DEFAULT '[]' NOT NULL,
	`learned_avoids_json` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client_name` text,
	`brand_notes` text,
	`palette_json` text,
	`default_channels_json` text DEFAULT '[]' NOT NULL,
	`cover_asset_id` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`last_opened_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews_log` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shots` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`spec_json` text NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`selected_asset_id` text,
	`keyframe_asset_id` text,
	`clip_asset_id` text,
	`compiled_prompt_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shots_campaign` ON `shots` (`campaign_id`,`order`);--> statement-breakpoint
CREATE TABLE `talent` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`spec_json` text NOT NULL,
	`identity_mode` text DEFAULT 'reference_pack' NOT NULL,
	`soul_id` text,
	`soul_status` text,
	`locked_features_json` text DEFAULT '["face","hair","skin tone","nails"]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `talent_refs` (
	`talent_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text NOT NULL,
	`approved` integer DEFAULT 1 NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`talent_id`, `asset_id`),
	FOREIGN KEY (`talent_id`) REFERENCES `talent`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timelines` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text DEFAULT 'Main' NOT NULL,
	`timeline_json` text NOT NULL,
	`render_asset_id` text,
	`preview_asset_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ui_state` (
	`scope` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upload_cache` (
	`sha256` text PRIMARY KEY NOT NULL,
	`lane` text NOT NULL,
	`public_url` text NOT NULL,
	`remote_id` text,
	`uploaded_at` integer NOT NULL
);

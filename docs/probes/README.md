# Live probe results

Run `pnpm doctor --live` with real credentials and paste the output here as `YYYY-MM-DD-<lane>.md`. Each probe records: endpoint/model, request params, response status payload, elapsed time, estimate vs. actual cost, and any schema differences from `docs/research/higgsfield-api.md` Appendix A.

No live probes have been run yet: this build was validated with `MOCK_PROVIDERS=1`. The first live session should probe, in order:
1. `POST /estimate/marketing-studio/image/flare` and one Flare generation with two product references.
2. `POST /files/generate-upload-url` + presigned PUT (confirm `upload_headers` echo).
3. `higgsfield generate create gpt_image_2_5 --wait --json` (CLI lane) and the session-expiry path.
4. One `kling/v3/image-to-video` clip from a keyframe.
5. One Claude director plan with `messages.parse` to confirm the structured-output schema round-trips.

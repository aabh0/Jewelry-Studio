# Jewelry Studio — instructions for Claude Code sessions

- The build spec is `PLAN.md`. It is approved. Follow it milestone by milestone (§22); do not re-open decisions in its first table.
- Reference material lives in `docs/research/` (see `docs/research/README.md`). `docs/research/higgsfield-api.md` Appendix A holds the Cloud API JSON schemas; `docs/research/higgsfield-cli/MODELS.md` holds the consumer CLI flags.
- Record live-probe results in `docs/probes/` and milestone notes in `docs/progress/Mx.md`.
- Hard rules (PLAN.md §0.5): never double-submit paid jobs; estimate + ledger before spend; download outputs immediately; secrets never reach the browser; everything routes through the capability registry; invariants in every product prompt; relative paths; `src/lib/**` has no `next/*` imports; tests per milestone.
- Stack is pinned in PLAN.md §4; do not upgrade majors without noting it in `docs/progress/`.
- Commands: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm test`, `pnpm test:e2e`, `pnpm doctor`, `pnpm db:generate`, `pnpm db:migrate`.
- Keep AI-assistant model names out of commit messages, code comments and docs.

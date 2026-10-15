# Design system — working notes

The binding rules are PLAN.md §28. This folder records how they are implemented so screens stay consistent.

## Where things live
- Tokens: `src/styles/tokens.css` (dark default, light under `[data-theme="light"]`), wired into Tailwind 4 via `@theme` in `src/app/globals.css`.
- Primitives: `src/components/ui/*` — hand-written on `radix-ui` (Button, Input/Select/Textarea/Field, Badge/Chip, Dialog/Drawer, Menu/Popover, Tooltip, Switch/Checkbox/Slider/Tabs/Progress/Skeleton/Kbd, Empty/Error/SectionTitle, Command palette).
- Studio components: `src/components/studio/*` — AssetThumb (reserved aspect box), Dropzone, VideoPlayer (frame stepping), CompareDialog, MaskBrush, LightingEditor, ProductForm, TalentForm, ShotEditor, AssetDrawer (zoom + edit ops + QA + versions + export), widgets (EstimateBadge, CapabilityBadge, JobRow, RunningJobs, ScoreRing), project cards, campaign header/stepper.
- Frame: `src/components/frame/*` — rail + header (AppFrame), ⌘K command palette, ⌘P project switcher, RememberRoute (per-project last route).

## Conventions every screen follows
1. One primary action per screen, gold, top right of the header. Secondary actions are ghost buttons; destructive ones live in an overflow menu behind a confirmation that states the consequence.
2. Paid actions always show the estimate before the click (EstimateBadge from `/compile`, totals in the Generate dialog) and link to the Jobs page after it.
3. Forms autosave through `useAutosave` (500 ms coalesced, flushed on hide/unmount) and the header shows Saved / Saving… / Retrying. Nothing has a Save button except dialogs that create a record.
4. Lists of media reserve their aspect ratio (`AssetThumb`) and load thumbnails from `/api/media/thumb/:id?w=` so nothing jumps.
5. Keyboard: review board map is documented in-app (`?`); every dialog closes on Esc; command palette on ⌘K; project switcher on ⌘P.
6. Per-screen UI state (filters, selected stage, tabs) persists server-side via `useUiState(scope)` so it survives restarts and project switching.
7. Empty states explain the next step and offer it as a button; error states show the message and a retry.
8. Status language: Draft → Shots to approve → Generating → In review → Assembling → Exported. Candidate review states: unreviewed / approved / maybe / flagged / rejected.

## Type scale in use
Display `font-display` (Instrument Serif) at 40/36/32/26/20; UI Inter at 14 body, 13 secondary, 12 meta, 11 chips; tabular numerals on money and durations (`.tabular`).

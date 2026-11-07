# C.R.E.W. Fix Plan

Status: plan only. Owner approval required before any merge, release, or deploy.
Written 2026-11-06 on Wonder. Execute phases on Spark 1.3 contributor.

## Direction

Salvage this repo. Do not rewrite. Build and full check gate already pass. A rewrite throws away the deterministic Python engine, approval enforcement, roster/profile store, Pi harness, tours, manuals, and three real generated apps.

Product name is C.R.E.W. Software under C.R.E.W. Technologies. The four-letter upstream name must disappear from every user-facing surface.

## Proven now vs not

- Proven by direct run: studio builds, 23 studio tests, 12 permission tests, 3 workflow tests, 21 REA tests pass. FreeLLMAPI at `http://127.0.0.1:31415/v1` answers with saved key, 250 models, one chat call succeeded.
- Not proven until owner sees it: a full GUI run from `Start-Crew.cmd`, intake to results, completed live on this machine.
- Model `auto` is a trap. One probe routed to a weak free preview model that never answered. Pin explicit model names per role. Never rely on `auto` for interviewer or planner.

## Owner constraints (do not violate)

1. One-handed use. Mouse-first. Dropdowns, paste buttons, file pickers. Typing allowed, never required. No keyboard-dependent routine steps.
2. Intake is gate zero. If a novice cannot get past intake, the app is broken regardless of tests.
3. Two sign-offs before any production work. Second sign-off needs typed or drawn initials. After that the pipeline self-navigates. Per-stage checkoffs are NOT required; the two confirmations are both up front.
4. Defaults hardcoded so a fresh boot runs: FreeLLMAPI `http://127.0.0.1:31415/v1` primary, Kobold `http://127.0.0.1:5001/v1` optional. Credentials for 31415 already exist in this version; keep them server-side, masked in API responses, never in code, logs, or git-tracked files.
5. Do not test or probe Kobold on 5001. That would stress the owner's graphics card. Only route local usage through 31415.
6. REA is lightweight only. Head start on functionality, never a prerequisite and never a silent success. Failure must name what is missing and offer plain continue-without-it.
7. No new paid providers. No force-push, no merge to main without separate authorization. Never print or commit secrets.
8. Deliverable: program plus Learner's Manual plus User's Manual packed as one zip, droppable anywhere, with install instructions.

## Gaps found in audit

1. Default local profile seeds `baseUrl=31415, model=auto, apiKey=none`. Discovery/interview calls send no Authorization from that profile, so real interview turns can fail or route to a weak model. Root reason the owner experiences "everything is broken" at intake.
2. First-run tour still tells users local points at Kobold 5001 by default. This contradicts the current 31415 default and confuses novice setup.
3. Results view lists files and paths. There is no single downloadable zip bundle.
4. Intake upload accepts one `.md` or `.txt` file. No multi-file, image or drawing intake, no USB folder pick. Intake cannot yet collect mockups or schematics as vision context.
5. The other letters remain in user-facing strings, config names, DB and session paths (`sssf.db`, `sssf.config.yaml`, `.sssf` dirs), packaged app name `crew-platform`, and tour/manual text. Removal must be phased so existing approvals, history, and generated projects do not break.
6. Working tree dirt: `AGENTS.md` rewritten to a generic version that lost owner rules (process hygiene, one-handed input, no new paid providers, per-turn token accounting). Builder cap 200K to 400K uncommitted. Untracked reports `COMPLETION_STATUS.md`, `D5-INTEGRATION-REPORT.md`, `D6-FINAL-REPORT.md`, and one spec.

## Game plan

### Phase 0 — Stabilize and make it owner's again (do first, cheap)
- Restore or merge `AGENTS.md` owner rules from git history plus rewrite as short, explicit constraints.
- Commit or explicitly discard the builder 400K cap change. Keep the four untracked reports out until owner decides.
- Rename user-facing strings only: tooltips, tour text, manuals, help text. Keep internal `.sssf` paths and `sssf.config.yaml` until Phase 5, they are compatibility shims.

### Phase 1 — Unbreak intake (the gate-zero fix)
1. Change seeded defaults in `studio/server/profiles.ts`: keep `DEFAULT_LOCAL_URL=31415`, set Kobold 5001 as the second local preset, replace `model=auto` with pinned names. Interviewer gets the strongest reasoning model the router actually carries. Suggested first pin: interviewer/planner `glm-5.3`, builder/documenter a cheap fast model such as Spark-class on router, reviewer/`deepseek-v4-pro` or GLM. Owner picks exact names from the router model list.
2. Ensure the saved 31415 credential is read server-side and attached to discovery/interview calls without surfacing in frontend or logs. Middleware that masks the key in errors already exists; verify it covers chat errors.
3. Every intake control passes a click-target and dictation test: talk textarea, paste textarea, upload, question free-text, chat composer, spec editor. Native inputs, caret visible, no overlay. Add visible next-action states so Continue never appears dead.
4. Live proof with owner watching: `Start-Crew.cmd`, paste a tiny brief, interview answers, spec read-back, two sign-offs (second with initials), launch a small deterministic job, reach Results with a zip. Only then mark intake fixed.

### Phase 2 — Two sign-offs before production
1. Add to `ReviewApproveView.vue` and the server approval record: sign-off 1 confirms sections (existing section checks), sign-off 2 requires explicit initials input plus a final confirm checkbox stating what will run, estimated cost, and what can and cannot be undone.
2. Server enforces both legs in `ApprovalBook`. A run with only leg 1 is rejected. Any spec or connection edit invalidates both (existing fingerprint logic already does this; bind initials to the fingerprint).
3. Remove per-stage approvals. Once both legs pass the engine self-navigates plan, build, test, review, document and packaging. Interrupt control stays Stop only; Windows Pause is unavailable by documented limitation.

### Phase 3 — Roster, pushback agent, and per-agent defaults
1. Roles already seeded: planner, builder, scout, reviewer, documenter, interviewer, researcher, specialist, validator, scrutiny, rea. Add no new roles. Wire `scrutiny` as the pushback/challenger agent between reviewer and documenter (or between planner and builder if owner prefers earlier challenge). Keep it inside the deterministic workflow so it cannot freelancing.
2. Settings roster tab already saves and applies presets. Add named default rosters: Desk Default (owner's daily 6 agents), Kiosk Default (same minus Scout/REA), and Full (7). Each pins endpoint, model, reasoning level, token cap. Boot loads Desk Default so the machine is ready immediately.
3. Hardcode both endpoints as presets: Local A FreeLLMAPI 31415 (primary), Local B Kobold 5001 (optional, never auto-probed). Cloud profiles stay disabled by default.
4. Raise `DEFAULT_TOKEN_CAP` from 20,000 to 1,000,000 for new projects as D5 intended; confirm whether already landed in `profiles.ts`.

### Phase 4 — REA light path
1. Keep the engine-owned REA CLI adapter (`adws/adw_modules/rea.py`). It already fails loudly, preserves immutable evidence, and parses an approved `crew-rea` block with question, target, scope, `permitted_actions: static-local`.
2. Re-enable the roster entry in `adws/adw_sssf_config/sssf.config.yaml`: `writes: ["specs/"]`, tools needed for handoff only. Current entry has `writes: []` and `tools: []`, so it cannot hand off.
3. UX: optional intake card "Investigate existing software" shown only when the user picks an existing repo or folder. It explains cost in plain words and that inspection is static only. On CLI missing or native engines missing, show the gap and offer "continue without investigation" as a mouse choice.
4. Prefer the lighter REA variant if the official CLI proves heavy in a timed trial. Selection criterion: handoff quality on one real fixture, cold-start time, and disk footprint. Owner picks after one observed run.

### Phase 5 — Deliverable zip and naming cleanup
1. Results view: add one "Download bundle" action. Server assembles the chosen destination folder into `<project-name>-CREW.zip` containing program files, generated User's Manual, generated Learner's Manual, install instructions, and a `LICENSE` or ownership note when available. Copyable path stays for experts; zip is the primary action.
2. Documenter prompt gains a manual-generation step so each build emits both manuals beside the program, not only a diff write-up.
3. Internal renames last, separately reviewed: `sssf.db` to `crew.db`, `sssf.config.yaml` to `crew.config.yaml`, package name, Electron product strings. Migrate with a backup copy and a start-up shim that reads the legacy name once. Absolutely no rename until Phases 1 to 4 are owner-accepted.

### Phase 6 — Onboarding rebuilt for novices
1. Setup onboarding: step bubbles with tails anchored to each Settings field using the existing `tour.ts` Floating UI framework. Fix the stale 5001 text to match real defaults. Two modes: first-run guided setup, and re-launchable from Help at any time (already supported). Add screenshots or short captions per field.
2. Job onboarding: second bubble tour across Home, New Job, Review, Run, Results with plain-language what/why/example on every step. Both tours must remain usable by mouse only and with Windows Voice Typing (Win+H) dictating into fields while bubbles show.
3. Help surface: two onboarding buttons, User's Manual, Learner's Manual, glossary, build identity, recovery note. Manuals stay openable from Help, never only from the file system.

## After C.R.E.W. Software works at the desk

Same intake, sign-off, deterministic pipeline, and zip delivery become the template. Verticals (building-permit helper, reentry and grant writing helper) are new job types and prompts, not new engines. Build them only after the owner uses C.R.E.W. Software daily. Codemagic or other Mac/mobile packaging is a later delivery target, never a blocker for the desk product.

## Risks and non-goals

- No public release, installer publish, or merge to main without owner approval.
- Token caps are reporting thresholds; batches can overshoot. Check cumulative SQLite usage after every agent turn, not only on a timer.
- Voice is Win+H OS dictation. In-app mic needs an external speech service that Electron builds cannot key; do not promise audio transcription in-app.
- Token estimates: Phase 1 and 2 together are the expensive part. Keep tests targeted: `bun run build`, `node scripts/check.mjs`, acceptance paths A, B, C1, F, H, voicetyping. Do not run Kobold probes.

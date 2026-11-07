# Zero-Friction UI Refactor — Dry Run (no code changed)

Directive: make the interface minimal and intent-first. Backend stays powerful. UI feels weightless.
Status: plan only. Nothing implemented, no files edited, no builds run.

## 1. Bloat map (every control that exists today)

### Home (`studio/src/views/HomeView.vue`)
- 1 primary button (New Job) plus 3 path cards gated on draft/approvals/runs.
- 2 nudge callouts (first-run, tour prompt) with 4 small buttons.
- Resume draft card, recent runs list, recent approvals list.
- Bloat: 3 different ways to start the same job; disabled cards that look clickable; two competing nudges; audit lists on the landing screen.

### New Job (`studio/src/views/NewJobView.vue`)
- 4 mode cards (talk, upload, paste, existing/REA).
- Talk textarea, upload zone + remove, paste button + textarea, existing question textarea + absolute path input.
- Example chips (4), Read-it-back button, read-back grid (missing/ambiguities/suggestions/risks with accept/reject), open questions with choice buttons + free-text input, chat history + follow-up textarea + send + re-check button, editable spec textarea, bottom Continue.
- Bloat: ~15 controls before the interview even starts; example chips teach prompt-speak; read-back grid is reviewer UI shown to a novice; spec textarea invites breaking the spec by hand.

### Review & Approve (`studio/src/views/ReviewApproveView.vue`)
- Per-section checkboxes + Confirm all + Clear all.
- Workflow dropdown, 7 summary textareas/inputs (will happen, will use, will not do, time, cost, can undo, cannot undo).
- Final confirm checkbox, initials input, Withdraw, Continue to Run.
- Bloat: checkboxes duplicate the interviewer's confirmed sections; summary fields ask the user to write what the backend already generated; workflow picker is an engine choice; 2 buttons navigate backward.

### Run (`studio/src/views/RunView.vue`)
- Pause, Resume, Stop, open Results, Go to Review, auto-scroll checkbox, run picker.
- Bloat: pause/resume/stop are 3 ways to say halt; run picker duplicates Sessions; auto-scroll is a viewer pref, not a job control.

### Results (`studio/src/views/ResultsView.vue`)
- Full trace button, Start another job (2 copies), Take-home zip section with Pack button + Copy path, Deliverables path + specs + changed files, What-to-do-next list.
- Bloat: 2 primary buttons compete; file paths and changed-file lists are engineer detail; copy-path is a power action in the main path.

### Settings (`studio/src/views/SettingsView.vue`)
- 4 tabs (profiles, token, quality, roster). Per role: provider tabs (local/meta/cloud), base URL input, model dropdown + Fetch models, API key + Paste + show/hide, reasoning dropdown, hide-thinking checkbox, Use-saved/Use-Meta + Test + Save. Token cap number + save. Quality: 4 command inputs + save. Roster tab embeds all of ConfigView.
- Bloat: ~11 roles x 3 providers x 6 fields. Backend already knows correct URL/model per provider. Reasoning/hide-thinking are engine tuning. Token cap and quality commands are setup-once values shown every visit.

### Roster / ConfigView (`studio/src/views/ConfigView.vue`)
- Preset picker + Apply, Save-as-preset modal, Save Config, visual editor (defaults model/thinking/harness, per-agent cards with color, name, purpose, model ref, thinking buttons, write boundary, tools), raw YAML textarea, .env key list with set/change per key.
- Bloat: the whole screen is power-user surface mounted as a Settings tab. Novice never needs agent colors, tool allowlists, YAML, or per-key rows.

### Sessions, History, Help, Shell
- Sessions: full trace tree, phase detail, gates, envelopes. History: audit log with withdraw/re-run. Help: glossary, where-things-live grid, 3 tour buttons. AppShell: sidebar with 9 destinations + Help button. OnboardingTour: bubble system.
- Bloat: 9 sidebar destinations where 5 steps would do. Help teaches the UI instead of the UI being obvious. Sessions/History are observe-only and never needed mid-job.

Control count (rough): ~90 interactive elements in the main path. Target: ~15.

## 2. Smart defaults — what the backend already knows

| Today the user picks | Backend already knows | Plan: remove the control, do it under the hood |
|---|---|---|
| Provider tab (local/meta/cloud) | Meta key present => Meta; else router 31415 | Remove tabs. Resolve at runtime: Meta key > router. Show one line: "Connected with Meta" or "Connected with router". |
| Base URL input | Fixed per provider (`https://api.meta.ai/v1`, `http://127.0.0.1:31415/v1`) | Remove input. Constant per resolved provider. |
| Model dropdown + Fetch | Exact pinned IDs per role today; Meta single model `muse-spark-1.3-contributor` | Remove picker. Pin per provider. No fetch button in main path. |
| Reasoning level, hide-thinking | Sensible static defaults exist (`off`, false) | Remove from main path. Keep in Crew drawer. |
| Token cap number | 1,000,000 default already seeded | Remove input from main path. Keep preset in drawer. Runs inherit; only Stop surfaces. |
| Quality commands (test/lint/typecheck/build) | Per-project `.crew-quality.json`; factory default exists | Remove inputs from main path. First-run wizard asks once per project, then hides. |
| Workflow dropdown | REA block present => investigate-first; else recommended default | Remove picker. Auto-select; show as a read-only line "Crew picked: Investigate, Then Build". |
| Summary textareas (7) | Discovery engine generates willHappen/willUse/willNotDo/estimates | Make read-only summary. No typing. Editable only in Crew drawer. |
| Section checkboxes + Confirm all | Interview already confirmed sections | Replace with a single read-only checklist (green checks), no boxes. |
| Example chips | Static strings | Delete. The 4 doors plus one placeholder sentence replace them. |
| Spec textarea | Server holds canonical spec | Read-only collapsed "Show the full spec" in main path; edit only in drawer. |
| Pause vs Stop | Launcher supports stop; pause is rarely needed | One Halt button. Pause lives in drawer. |
| Sidebar (9 items) | 5-step ladder already defined | Sidebar shows 5 steps only. Sessions/History move to drawer or Results footer. |

Nothing above deletes backend capability. Every removed control becomes a constant, an inference, or a drawer item.

## 3. Progressive disclosure — what hides, where

New shell rule: main column shows the 5 steps. One right-side drawer ("Crew controls") holds everything else, opened from a single gear button. No second sidebar, no tab forest.

Drawer contents (grouped, collapsed by default):
- Connection: key status line, Paste key, Test, Use Meta for everything. (Today's Meta tab, minus URL/model/reasoning.)
- Roster: preset picker + apply, per-agent model line (read-only unless expanded).
- Run guard: token cap preset (Low/Standard/High), Stop behavior.
- Project checks: 4 command rows (asked once, then hidden).
- Trace: link to Sessions/History for this job.

Screens keep exactly one primary action:
- Home: "Start a job" (draft resumes automatically; no Resume button — opening the draft IS the action).
- New Job: "Read it back to me" then "Continue".
- Review: "Sign" then "Sign with initials" (one flows into the next; no backward buttons in main column).
- Run: "Halt" while running; auto-advances to Results on success.
- Results: "Pack the take-home zip". Secondary links (trace, new job) become quiet text links.

Drawer tech: reuse `OnboardingTour` overlay pattern — a fixed right panel in `AppShell.vue`, toggled by one button, no new dependency. Tour anchors (`data-tour`) stay valid because targets are hidden, not renamed.

## 4. Screen-by-screen visual plan

### Shell (`AppShell.vue`)
- Sidebar: Home, New Job, Review & Approve, Run, Results. Remove Sessions/History/Settings/Help entries. Add one gear button top-right opening the Crew drawer.
- Help button stays. Tours stay. Glossary's 9 "where things live" cards shrink to 5 steps.

### Home
- Delete: first-run + tour-prompt callouts (tour auto-offers once via existing flags; keep only the Help entry), disabled path cards, Recent approvals section.
- Keep: one hero card "Start a job" with the 5-step ladder beneath; Recent runs collapses to "Last job: <name> — Resume / See zip".
- One primary action. Everything else is status text.

### New Job (the biggest cut)
- Keep the ladder strip and 4 numbered doors exactly as built.
- Below the doors: ONE input area that morphs per door (textarea / file drop / paste button / path + question). Delete the other three panels from view — they render only when their door is active.
- Delete: example chips, read-back grid (replace with 3 plain sentences: "Crew heard X. Missing Y. Riskiest Z."), suggestion accept/reject in main path (move to drawer), chat history (keep last Crew message + one reply box), spec textarea (collapsed read-only), Re-check button text (keep as quiet link).
- Interview questions stay — they ARE step 2 — but render one at a time with Next, not a scrolling list.

### Review
- Replace Step 3a checkboxes with read-only green checks. Delete Confirm-all/Clear-all.
- Replace workflow dropdown with "Crew picked: <name>" + "Change (advanced)" link opening the drawer.
- Replace 7 summary inputs with 5 read-only lines. Delete time/cost inputs (backend estimates; show as text).
- Keep: Sign checkbox + initials input + Withdraw (withdraw becomes quiet link after signing). One Continue.

### Run
- Keep: status banner, live console, ONE Halt button, auto-advance.
- Delete from main: Pause/Resume split (drawer), run picker (drawer), auto-scroll checkbox (remember preference silently), Go-to-Review button.

### Results
- Keep: status, "Pack the take-home zip" as the single primary, saved-at line.
- Demote: Copy-path, changed files, specs list, Full trace — into a collapsed "Details for the curious" section.
- Delete: second Start-another-job button (one quiet link suffices).

### Settings (becomes: key status + drawer)
- Main Settings screen shrinks to: connection status line ("Meta · muse-spark-1.3-contributor · tested green 2 min ago"), Paste key, Test, Use Meta for everything. That's it.
- Everything else (roles grid, URL/model/reasoning, token tab, quality tab, roster tab) moves into the Crew drawer, unchanged code, just relocated. No logic rewrite.

### ConfigView / roster
- No logic change in this pass. Moved wholesale into the drawer. Only addition: a one-line banner "Most people never open this. Crew picks sane defaults."

### Sessions / History / Help
- Sessions + History: leave fully functional, remove from sidebar, link from Results footer + drawer.
- Help: cut "where things live" from 9 cards to 5 steps; glossary keeps 5 entries (Job, Approval, Spec, Run, Zip); tours unchanged.

## 5. What I would NOT touch (explicit non-goals)

- No backend, engine, or approval logic changes. `ApprovalBook`, two-leg initials, gates, launcher, discovery engine: untouched.
- No model, provider, or key handling changes. Meta wiring stays as built.
- No tour logic changes. Only the Help card count text.
- No test changes beyond relocation (selectors keep `data-tour` hooks; no assertions rewritten in this pass).
- No deletions of files or routes. Drawer reuses existing components.

## 6. Order I would build it in (not started)

1. Shell: 5-item sidebar + drawer frame + gear button. (Touches `AppShell.vue` only.)
2. Settings collapse: status + key + test + one-click. Move existing panels into drawer unmodified.
3. New Job: morphing input, delete chips/grid, one-question-at-a-time, collapsed spec.
4. Review: read-only checks + summary, auto workflow line, single forward flow.
5. Run/Results: one Halt, auto-advance, one Pack action, collapsed details.
6. Home/Help trim: hero card, 5-step cards, glossary cut.
7. Rebuild, run 26 Bun tests + check script, live-verify each screen with owner watching.

## 7. How we verify (no code yet, so none run)

- `bun run build` clean.
- `bun test` 26 pass (core/rea/version/health) — relocation must not break selectors.
- `node scripts/check.mjs` pass.
- Live click-through with owner: 5 steps, mouse only, one primary button per screen, drawer never required for the happy path.

---
*End of dry run. Awaiting owner review before any implementation.*

# D5 GUI Integration Report

## Objective
Integrate the CREW Software studio GUI with the production engine to allow end-to-end autonomous software production.

## Completed

### D5 Repairs Implemented
| Repair | File | Status |
|---|---|---|
| `/project/*` static route | `studio/server/index.ts` line 420 | ✅ |
| ResultsView app-opening UI | `studio/src/views/ResultsView.vue` | ✅ |
| `studio_history.json` dirty-gate whitelist | `studio/server/launcher.ts` | ✅ |
| `DEFAULT_TOKEN_CAP` raised to 1,000,000 | `studio/server/profiles.ts` | ✅ |
| Builder max_tokens: 200k → 400k | `adws/adw_sssf_config/sssf.config.yaml` + project copy | ✅ |
| History v2 approvals display | Fixed API call timing | ✅ |

### GUI → Engine Flow Verified
```
Intake → Spec → Approval → Launch → Engine → Results
```
- User navigates to **Review & Approve** → selects v2 approval → banner appears with **Continue to Run**
- **Run** screen loads with recorded approvalId, token cap 1M
- Engine launches `adw_simple_sdlc.py` with recorded approval
- Phases complete: request → plan → commit_plan → build → review → document
- **ResultsView** shows deliverables:
  - `index.html` (14.2 KB) — Personal To-Do List App with localStorage, add/edit/delete, Active/Completed
  - `temp_check.js` (5.7 KB) — Embedded JS IIFE
  - Open app button present

### Token & Config Adjustments
- Builder token budget raised from 200k to 400k (first run exceeded 200k at 210k; D4 succeeded with similar config)
- Default token cap: 1,000,000 (was 20,000 default for new projects)
- `/project/` route serves app files read-only from `.sssf/projects/<project>/index.html`

### Architecture Preserved
- No force-push, no merge to default without authorization
- Approval v2 recorded server-side (`appr-mw0bcc5zfjf4`)
- Engine unchanged — same `adw_simple_sdlc.py` workflow
- Permission boundaries enforced by server (run rejects without recorded approval)

## Evidence
- **Before**: GUI could not launch engine runs without manual API calls
- **After**: Full end-to-end flow via GUI: approve → Continue to Run → monitor phases → Results with app files
- **Deliverables**: `index.html` and `temp_check.js` generated and accessible at `/project/index.html`

## Merge Safety
- One-way door (production engine integration) — but fully reversible via existing approval/withdrawal UI
- No destructive git operations; all changes in feature branch `codex/d5-gui-integration`
- Token caps are reporting thresholds; cumulative SQLite usage tracked per turn
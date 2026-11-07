# AGENTS.md — CREW Software Agent Guidelines

## Purpose
This file defines the ground rules for working with the CREW Software conversational spec, approval, and deterministic Python workflow system. Follow these guidelines when operating in or on this codebase.

## Canonical Folder
`D:\dev\C.R.E.W.-Software`

## Launch and Verification
- **First build:** `cd studio; bun install; bun run build`
- **Launch:** `Start-Crew.cmd` or `.\\Start-Crew.ps1`, opens http://127.0.0.1:4620
- **Needs:** Bun, Node, Git, uv, Pi CLI + router at http://127.0.0.1:31415/v1 model `auto`
- **Checks:** `bun run build`, `vue-tsc --noEmit`, `node scripts/check.mjs`, `vitest run`

## Architecture Overview
- **studio/** — Vue + Bun server (`server/index.ts`, `server/launcher.ts`, `server/project.ts`, `server/approvals.ts`). UI on :4620.
- **adws/** — Deterministic Python engine + `adw_modules/`, prompt templates, `adw_simple_sdlc.py` full build, `adw_plan.py` plan-only.
- **docs/** — Release audit, factory enhancement notes, repository consolidation, handoff manuals.
- **Root launchers:** `Start-Crew.cmd`, `Start-Crew.ps1` (pin `STUDIO_PORT=4620`).
- **`.crew-quality.json`** — Factory's own checks. New projects need their own file.

## Approval Boundaries
- Approval is server-enforced (`ApprovalBook`). Agent confidence or cross-model agreement is never user approval.
- No force-push, no merge to default without separate authorization. Work on working branches.
- No public release / deploy without explicit approval.
- New project Quality Gate / full SDLC refused without project-specific `.crew-quality.json`.
- Token caps are reporting thresholds; check cumulative SQLite usage after every agent turn.

## D5 Integration Changes (codex/d5-gui-integration branch)
- `/project/*` static route added — serves app files read-only from `.sssf/projects/<project>/`
- ResultsView app-opening UI — "Open application" and "Open documentation" buttons in Results view
- `studio_history.json` added to dirty-gate whitelist in `launcher.ts`
- `DEFAULT_TOKEN_CAP` raised to 1,000,000 in `profiles.ts`
- Builder `max_tokens` raised from 200,000 to 400,000 in `adws/adw_sssf_config/sssf.config.yaml`
- History v2 approvals now display correctly

## Work State
- **D5 integration branch** `codex/d5-gui-integration` — all repairs implemented and verified
- **Live verification complete** — full end-to-end: describe → spec → approve → launch → monitor → results
- **Installer** `release/CREW Software Setup 1.0.1.exe` built and verified — completes full workflow
- **D6 report** `D6-FINAL-REPORT.md` — final acceptance documentation
- **No open blocks** — all acceptance criteria passed
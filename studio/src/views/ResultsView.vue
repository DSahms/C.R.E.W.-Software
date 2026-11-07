<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArrowRight, CheckCircle2, Clock, Copy, ExternalLink, FileText, FolderOpen,
  ListChecks, PlayCircle, RotateCcw, XCircle, Zap,
} from "lucide-vue-next";
import ScreenHeader from "@/components/ScreenHeader.vue";
import {
  buildProjectBundle, fetchSession, getActiveRuns, getApproval, getProjectDeliverables,
  getRunState, getWorkflows,
} from "@/lib/api";
import { fmtCost, fmtDuration, fmtTokens, ts } from "@/lib/format";
import { go, nav } from "@/lib/nav";
import type {
  AdwWorkflowInfo, ApprovalRecordV2, LiveRunState, ProjectDeliverables,
  SessionDetail,
} from "@shared/types.ts";

const run = ref<LiveRunState | null>(null);
const session = ref<SessionDetail | null>(null);
const approval = ref<ApprovalRecordV2 | null>(null);
const workflows = ref<AdwWorkflowInfo[]>([]);
const deliverables = ref<ProjectDeliverables | null>(null);
const copiedPath = ref(false);
const loading = ref(false);
const bundling = ref(false);
const bundleError = ref<string | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    workflows.value = await getWorkflows();
    if (nav.value.runId) {
      try { run.value = await getRunState(nav.value.runId); } catch {}
    } else {
      const runs = await getActiveRuns();
      const latestDone = runs.find(r => r.status === "success" || r.status === "fail" || r.status === "stopped");
      if (latestDone) run.value = latestDone;
      else if (runs.length) run.value = runs[0];
    }
    if (run.value?.approvalId) {
      try { approval.value = await getApproval(run.value.approvalId); } catch {}
    }
    if (run.value?.adwId) {
      try { session.value = await fetchSession(run.value.adwId); } catch {}
    }
    try { deliverables.value = await getProjectDeliverables(); } catch {}
  } finally { loading.value = false; }
});

const fmtBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` :
  bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;

async function copyProjectPath() {
  if (!deliverables.value) return;
  try {
    await navigator.clipboard.writeText(deliverables.value.projectPath);
    copiedPath.value = true;
    setTimeout(() => { copiedPath.value = false; }, 2000);
  } catch { /* the path is visible and selectable if the clipboard is blocked */ }
}

async function downloadBundle() {
  bundling.value = true;
  bundleError.value = null;
  try {
    deliverables.value = await buildProjectBundle();
  } catch (e: any) {
    bundleError.value = e?.message ?? "Could not pack the bundle.";
  } finally {
    bundling.value = false;
  }
}

const runMs = computed(() => {
  if (!run.value?.endedAt) return NaN;
  return ts(run.value.endedAt) - ts(run.value.startedAt);
});

const phasesCount = computed(() => session.value?.phases?.length ?? 0);
const passedGates = computed(() => session.value?.gate_results?.filter(g => g.passed).length ?? 0);
const totalGates = computed(() => session.value?.gate_results?.length ?? 0);
</script>

<template>
  <div>
    <ScreenHeader screen="results" />

    <div v-if="loading" class="dim">Loading…</div>
    <div v-else-if="!run" class="callout">
      No run yet. Start one from <button class="btn btn-ghost btn-xs" @click="go('run')">Run</button>.
    </div>
    <template v-else>

      <!-- Take-home zip: the whole point of this screen. -->
      <div v-if="deliverables?.bundlePath" class="hero-card" style="margin-bottom: 14px;">
        <div class="section-label">Your finished bundle</div>
        <div class="bundle-row">
          <button class="btn btn-primary btn-lg" @click="downloadBundle" :disabled="bundling">
            <FolderOpen :size="18" />
            {{ bundling ? "Packing…" : deliverables.bundleName ? `Download ${deliverables.bundleName}` : "Pack the zip" }}
          </button>
        </div>
        <div v-if="bundleError" class="callout warn" style="margin-top: 10px;">{{ bundleError }}</div>
        <p class="dim" style="margin: 8px 0 0; font-size: 13px;">
          Program, spec, both manuals, install notes — one zip, saved on this machine.
          <button v-if="deliverables.bundlePath" class="btn btn-ghost btn-xs" style="margin-left: 6px;" @click="copyProjectPath">{{ copiedPath ? "Copied!" : "Copy path" }}</button>
        </p>
      </div>

      <!-- Status line: one quiet line, not a banner. -->
      <div class="status-line" :class="run.status">
        <component :is="run.status === 'success' ? CheckCircle2 : run.status === 'fail' ? XCircle : RotateCcw" :size="16" />
        <span class="status-name">{{ run.status === 'success' ? 'Done' : run.status === 'fail' ? 'Failed' : run.status === 'stopped' ? 'Stopped' : 'Running' }}</span>
        <span class="dim" style="font-size: 12.5px;">
          {{ run.workflowName }}
          <span v-if="run.stopReason === 'token-cap'">— stopped at the token cap</span>
          <span v-else-if="run.stopReason === 'user-stop'">— stopped by you</span>
          <span v-if="Number.isFinite(runMs)"> — {{ fmtDuration(runMs) }}</span>
        </span>
      </div>

      <!-- Quick stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Exit code</div>
          <div class="stat-value">{{ run.exitCode ?? "—" }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Phases</div>
          <div class="stat-value">{{ phasesCount }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Gates passed</div>
          <div class="stat-value">{{ passedGates }} / {{ totalGates }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tokens used</div>
          <div class="stat-value">{{ fmtTokens(run.tokenUsage ?? null) }} <span class="dim" style="font-size: 12px;">/ {{ fmtTokens(run.tokenCap ?? null) }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cost</div>
          <div class="stat-value">Check router</div>
          <div class="dim">Router billing is not supplied to Crew.</div>
        </div>
      </div>

      <!-- Specs and changed files live in a collapsible; the zip is the headline. -->
      <details v-if="deliverables" class="section-card" style="margin-top: 14px;">
        <summary class="section-label" style="cursor: pointer;">What's inside the zip</summary>
        <div class="deliverable-path" style="margin-top: 10px;">
          <FolderOpen :size="16" />
          <span class="mono">{{ deliverables.projectPath }}</span>
          <button class="btn btn-ghost btn-xs" @click="copyProjectPath">
            <Copy :size="12" /> {{ copiedPath ? "Copied" : "Copy path" }}
          </button>
        </div>

        <div v-if="deliverables.specs.length" class="deliverable-list">
          <div v-for="file in deliverables.specs" :key="file.path" class="deliverable-file">
            <FileText :size="14" />
            <span class="deliverable-name">{{ file.name }}</span>
            <span class="dim">{{ fmtBytes(file.sizeBytes) }}</span>
            <span class="dim mono deliverable-full" :title="file.path">{{ file.path }}</span>
          </div>
        </div>
        <div v-else class="dim" style="font-size: 13px; margin-top: 8px;">
          No plan or approved specification files yet. Run Plan Only or approve a job to create one.
        </div>

        <div v-if="deliverables.changedFiles.length" style="margin-top: 10px;">
          <div class="section-label" style="margin-bottom: 4px;">Changed files</div>
          <div class="changed-list mono">
            <div v-for="file in deliverables.changedFiles" :key="file">{{ file }}</div>
          </div>
        </div>
        <div class="dim" style="font-size: 12px; margin-top: 8px;">
          Open the project folder in your file manager to use these files. Crew does not upload them anywhere.
        </div>
      </details>

      <!-- What to do next: one quiet line, one button. -->
      <div class="section-card" style="margin-top: 14px;">
        <div class="section-label">What to do next</div>
        <p class="dim" style="margin: 0 0 10px; font-size: 13px;">
          <span v-if="run.status === 'success'">The job finished cleanly — take the zip above.</span>
          <span v-else-if="run.status === 'fail'">The job failed — check the live console on Run, then start a smaller or clearer job.</span>
          <span v-else-if="run.stopReason === 'token-cap'">Hit the token cap — raise it in Settings or approve a smaller spec.</span>
          <span v-else>Still running — watch it on Run.</span>
          <button v-if="run.adwId" class="btn btn-ghost btn-xs" style="margin-left: 8px;" @click="go('sessions', { adwId: run.adwId })">
            <ExternalLink :size="12" /> Full trace
          </button>
        </p>
        <button class="btn btn-primary" @click="go('new-job')">
          Start another job <ArrowRight :size="14" />
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.status-line {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--panel); border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm); font-size: 13.5px;
  margin-bottom: 14px;
}
.status-line.success { border-left: 3px solid var(--green); }
.status-line.fail { border-left: 3px solid var(--red); }
.status-line.stopped { border-left: 3px solid var(--amber); }
.status-name { font-weight: 700; }
.bundle-row { margin-top: 10px; }

.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; }
.stat-label { font-size: 11.5px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.04em; }
.stat-value { font-size: 18px; font-weight: 700; margin-top: 2px; }

.deliverable-path { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; margin-bottom: 10px; }
.deliverable-list { display: flex; flex-direction: column; gap: 4px; }
.deliverable-file { display: grid; grid-template-columns: 16px auto auto 1fr; align-items: center; gap: 8px; font-size: 13px; padding: 5px 8px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); }
.deliverable-name { font-weight: 600; }
.deliverable-full { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; }
.changed-list { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--dim); max-height: 160px; overflow: auto; }
.phases-list { display: flex; flex-direction: column; gap: 4px; }
.phase-row { display: grid; grid-template-columns: 24px 1fr auto auto; align-items: center; gap: 10px; padding: 6px 10px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); font-size: 13px; }
.phase-row.success { border-left: 3px solid var(--green); }
.phase-row.fail { border-left: 3px solid var(--red); }
.phase-row.running { border-left: 3px solid var(--amber); }
.phase-seq { color: var(--faint); font-family: var(--mono); font-size: 12px; }
.phase-name { font-weight: 600; }

.next-list { padding-left: 18px; margin: 0; }
.next-list li { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; font-size: 13px; color: var(--dim); line-height: 1.55; }

@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
</style>

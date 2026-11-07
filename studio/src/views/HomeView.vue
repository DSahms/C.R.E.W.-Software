<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ArrowRight, CheckCircle2, Clock, Compass, FileText, PlayCircle,
  ListChecks, Settings as SettingsIcon, Sparkles, Zap,
} from "lucide-vue-next";
import ScreenHeader from "@/components/ScreenHeader.vue";
import { go } from "@/lib/nav";
import { getActiveRuns, getProjectInfo, listApprovals } from "@/lib/api";
import { getDiscoverySession } from "@/lib/api";
import { formatTimeAgo } from "@/lib/format";
import type {
  ApprovalBookSummary, LiveRunState, TargetProject,
  DiscoverySessionState,
} from "@shared/types.ts";
import { hasFinishedFirstRun, startTour, hasFinishedTour } from "@/lib/tour";

const project = ref<TargetProject | null>(null);
const recentRuns = ref<LiveRunState[]>([]);
const recentApprovals = ref<ApprovalBookSummary[]>([]);
const draft = ref<DiscoverySessionState | null>(null);
const showFirstRun = ref(false);
const showTourPrompt = ref(false);

onMounted(async () => {
  try {
    const [proj, runs, aps, sess] = await Promise.all([
      getProjectInfo(), getActiveRuns(), listApprovals(), getDiscoverySession(),
    ]);
    project.value = proj;
    recentRuns.value = runs.slice(0, 3);
    recentApprovals.value = aps.slice(0, 3);
    draft.value = sess;
  } catch (err) {
    console.error("Home load failed:", err);
  }

  if (!hasFinishedFirstRun()) {
    showFirstRun.value = true;
  } else if (!hasFinishedTour()) {
    showTourPrompt.value = true;
  }
});

function draftHasContent(d?: DiscoverySessionState | null): boolean {
  if (!d) return false;
  return Boolean(d.rawInput?.trim()) || (d.specMarkdown?.length > 80 && !d.specMarkdown.startsWith("# Specification: New Feature"));
}
</script>

<template>
  <div>
    <ScreenHeader screen="home" />

    <!-- One hero: the single primary action. Draft resumes automatically. -->
    <div class="hero-card" style="margin-bottom: 18px;">
      <button class="btn btn-primary btn-lg" data-tour="home-new-job" @click="go('new-job')">
        <Compass :size="18" />
        {{ draftHasContent(draft) ? "Continue your job" : "Start a job" }}
        <ArrowRight :size="16" />
      </button>
      <p class="dim" style="margin: 8px 0 0; font-size: 13px;">
        {{ draftHasContent(draft) ? "Your draft is waiting where you left it." : "Describe it, answer a few questions, check, sign twice, take the zip." }}
        <button class="btn btn-ghost btn-xs" style="margin-left: 6px;" @click="startTour('job')">See how it works</button>
      </p>
    </div>

    <!-- Main path: the 5-step ladder. -->
    <div class="home-grid">
      <button class="path-card" @click="go('new-job')" data-tour="home-new-job">
        <Compass :size="22" />
        <div class="path-card-name">1. Describe + 2. Answer</div>
        <div class="path-card-desc">Talk, dump, paste, or point — then answer the numbered questions.</div>
      </button>
      <button class="path-card" :disabled="!draftHasContent(draft)" @click="go('review-approve')">
        <ListChecks :size="22" />
        <div class="path-card-name">3. Check + 4. Sign twice</div>
        <div class="path-card-desc">Confirm each section, then sign and add initials.</div>
      </button>
      <button class="path-card" :disabled="recentApprovals.length === 0" @click="go('run')">
        <PlayCircle :size="22" />
        <div class="path-card-name">5. Run</div>
        <div class="path-card-desc">Watch the job live. One halt button. Guarded.</div>
      </button>
      <button class="path-card" :disabled="recentRuns.length === 0" @click="go('results')">
        <CheckCircle2 :size="22" />
        <div class="path-card-name">5. Take-home zip</div>
        <div class="path-card-desc">One zip — program, spec, manuals, install notes.</div>
      </button>
    </div>

    <!-- Two columns: drafts + recent -->
    <div class="home-cols">
      <div class="section-card">
        <div class="section-label">Resume where you left off</div>
        <div v-if="draftHasContent(draft)" class="draft-card">
          <FileText :size="18" />
          <div style="flex:1; min-width:0;">
            <div class="draft-title">{{ draft?.title || "Untitled draft" }}</div>
            <div class="draft-meta">Saved automatically. You can pick up where you left off.</div>
          </div>
          <button class="btn btn-secondary btn-sm" @click="go('new-job')">
            Resume
            <ArrowRight :size="14" />
          </button>
        </div>
        <div v-else class="empty-state">
          No draft yet. Click <strong>Start a job</strong> above — drafts save themselves.
        </div>
      </div>

      <div class="section-card">
        <div class="section-label">Recent runs</div>
        <div v-if="recentRuns.length">
          <div v-for="r in recentRuns" :key="r.runId" class="run-row" @click="go(r.status === 'running' ? 'run' : 'results', { runId: r.runId, adwId: r.adwId })">
            <Zap :size="14" />
            <div style="flex:1; min-width:0;">
              <div class="run-row-name">{{ r.workflowName }}</div>
              <div class="run-row-meta">
                <span class="badge" :class="r.status === 'running' ? 'badge-amber' : r.status === 'success' ? 'badge-green' : 'badge-red'">{{ r.status }}</span>
                <span v-if="r.adwId" class="badge">{{ r.adwId }}</span>
                <span class="dim"><Clock :size="11" /> {{ formatTimeAgo(r.startedAt) }}</span>
              </div>
            </div>
            <ArrowRight :size="14" />
          </div>
        </div>
        <div v-else class="empty-state">
          No runs yet. They appear here as soon as a job starts.
        </div>
      </div>
    </div>

    <!-- Recent approvals -->
    <div v-if="recentApprovals.length" class="section-card" style="margin-top: 16px;">
      <div class="section-label">Recent approvals</div>
      <div v-for="a in recentApprovals" :key="a.id" class="run-row" @click="go('review-approve', { approvalId: a.id })">
        <CheckCircle2 :size="14" />
        <div style="flex:1; min-width:0;">
          <div class="run-row-name">{{ a.specTitle }} (v{{ a.specVersion }})</div>
          <div class="run-row-meta">
            <span class="badge badge-green">approved</span>
            <span class="dim">by {{ a.approvedBy }}</span>
            <span class="dim"><Clock :size="11" /> {{ formatTimeAgo(a.approvedAt) }}</span>
          </div>
        </div>
        <ArrowRight :size="14" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
.path-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  text-align: left;
  color: var(--text);
  font-family: var(--sans);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.path-card:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--surface-hover);
  transform: translateY(-1px);
}
.path-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.path-card-name { font-weight: 600; font-size: 14px; }
.path-card-desc { font-size: 12.5px; color: var(--dim); line-height: 1.5; }

.home-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.draft-card, .run-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  cursor: pointer;
}
.draft-card:hover, .run-row:hover {
  border-color: var(--border);
  background: var(--panel-2);
}
.draft-title { font-weight: 600; font-size: 13.5px; }
.draft-meta, .run-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--dim);
  margin-top: 2px;
  flex-wrap: wrap;
}
.run-row-name { font-weight: 600; font-size: 13.5px; }
.empty-state {
  padding: 16px 12px;
  font-size: 13px;
  color: var(--dim);
  text-align: center;
}

@media (max-width: 980px) {
  .home-grid { grid-template-columns: repeat(2, 1fr); }
  .home-cols { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .home-grid { grid-template-columns: 1fr; }
}
</style>

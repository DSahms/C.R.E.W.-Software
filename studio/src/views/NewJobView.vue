<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  ArrowRight, Clipboard, FileUp, FileText, History,
  MessageSquare, Save, Sparkles, Upload,
} from "lucide-vue-next";
import ScreenHeader from "@/components/ScreenHeader.vue";
import type {
  DiscoverySessionState, DiscoveryQuestionItem,
} from "@shared/types.ts";
import {
  analyzeDescription, answerQuestion, getDiscoverySession,
  rejectSuggestion, acceptSuggestion, resetDiscoverySession,
  sendChatMessage, updateSpecMarkdown,
  getProjectInfo,
} from "@/lib/api";
import { go } from "@/lib/nav";

const session = ref<DiscoverySessionState | null>(null);
const loading = ref(false);
const analyzing = ref(false);
const chatInput = ref("");
const listening = ref(false);
const VoiceRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let voice: any = null;
function toggleVoice() {
  if (listening.value) { voice?.stop(); return; }
  if (!VoiceRecognition) { alert("This browser doesn't support voice input. You can paste or upload your dictated text."); return; }
  voice = new VoiceRecognition();
  voice.lang = "en-US";
  voice.interimResults = false;
  voice.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    if (session.value?.rawInput) chatInput.value += `${chatInput.value ? " " : ""}${text}`;
    else { mode.value = "talk"; talkText.value += `${talkText.value ? " " : ""}${text}`; }
    saveDraft();
  };
  voice.onend = () => { listening.value = false; };
  voice.onerror = (event: any) => {
    listening.value = false;
    const code = event?.error ?? "unknown";
    // Chromium's Web Speech API needs an external speech service. Electron
    // builds have no service key, so recognition fails with "network" even
    // with a working microphone. Say exactly that instead of blaming the mic.
    if (code === "network" || code === "service-not-allowed") {
      alert("Voice recognition needs an external speech service, which isn't available in the desktop app (error: " + code + "). Paste or Upload your text instead — it goes through the same interview.");
    } else if (code === "not-allowed" || code === "permission-denied") {
      alert("Microphone access was blocked. Allow microphone use for this app, then try again — or Paste/Upload your text.");
    } else {
      alert("Voice input couldn't start (" + code + "). Use Paste or Upload instead.");
    }
  };
  listening.value = true;
  voice.start();
}
onUnmounted(() => { voice?.stop(); if (saveTimer) clearTimeout(saveTimer); saveDraft(); });

// 4 intake modes: talk, upload, paste, plus existing (point at software for REA)
const mode = ref<"talk" | "upload" | "paste" | "existing">("talk");
const talkText = ref("");
const pasteText = ref("");
const uploadedFileName = ref<string>("");
const uploadedFileText = ref<string>("");
const uploadInput = ref<HTMLInputElement | null>(null);
const existingTarget = ref("");
const existingQuestion = ref("");

// Examples
const EXAMPLES: string[] = [
  "Add a /health endpoint that returns JSON with the build SHA and current time. No new deps.",
  "Document the existing approval flow in docs/approvals.md. Read-only — no code changes.",
  "Find every place we read .env and list them in a report. Change nothing.",
  "Refactor the studio server's project switch to also reset the approval book.",
];

// Draft autosave (localStorage). Debounced 2s + on blur + on mode change.
let DRAFT_KEY = "";
const draftSavedAt = ref<string | null>(null);
let saveTimer: any = null;

function saveDraft() {
  if (!DRAFT_KEY) return;
  const payload = {
    mode: mode.value,
    talk: talkText.value,
    paste: pasteText.value,
    existingTarget: existingTarget.value,
    existingQuestion: existingQuestion.value,
    uploadedFileName: uploadedFileName.value,
    uploadedFileText: uploadedFileText.value,
    specMarkdown: session.value?.specMarkdown ?? "",
    savedAt: new Date().toISOString(),
  };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); draftSavedAt.value = payload.savedAt; }
  catch { draftSavedAt.value = null; }
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 2000);
}
function loadDraft(): boolean {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (!d || (!d.talk && !d.paste && !d.uploadedFileText && !d.existingTarget)) return false;
    mode.value = d.mode ?? "talk";
    talkText.value = d.talk ?? "";
    pasteText.value = d.paste ?? "";
    existingTarget.value = d.existingTarget ?? "";
    existingQuestion.value = d.existingQuestion ?? "";
    uploadedFileName.value = d.uploadedFileName ?? "";
    uploadedFileText.value = d.uploadedFileText ?? "";
    draftSavedAt.value = d.savedAt;
    return true;
  } catch { return false; }
}

onMounted(async () => {
  loading.value = true;
  try {
    const project = await getProjectInfo();
    DRAFT_KEY = `crew.draft.newjob:${project.path}`;
    if (!localStorage.getItem("crew.draft.legacyProject")) {
      const legacy = localStorage.getItem("crew.draft.newjob");
      if (legacy) localStorage.setItem(DRAFT_KEY, legacy);
      localStorage.setItem("crew.draft.legacyProject", project.path);
    }
    session.value = await getDiscoverySession();
    const hasDraft = loadDraft();
    if (hasDraft && !session.value.rawInput && !session.value.specMarkdown?.startsWith("# Specification: New Feature")) {
      // Resume draft into the session if the session is fresh
      if (session.value.specMarkdown && session.value.specMarkdown.length > 80) {
        // keep server session's spec
      }
    }
  } catch (e) {
    console.error("New Job load failed:", e);
  } finally {
    loading.value = false;
  }
});

// Watch for autosave on text changes
watch([talkText, pasteText, uploadedFileText, uploadedFileName, existingTarget, existingQuestion, mode], () => {
  scheduleSave();
});

const existingInput = computed(() => {
  const bits: string[] = [];
  if (existingQuestion.value.trim()) bits.push(existingQuestion.value.trim());
  if (existingTarget.value.trim()) {
    bits.push(`Investigate the existing software at this absolute local path (static inspection only, change nothing): ${existingTarget.value.trim()}`);
    bits.push('```crew-rea\n{"question": ' + JSON.stringify(existingQuestion.value.trim() || "What does this software do and how is it structured?") + ', "target": ' + JSON.stringify(existingTarget.value.trim()) + ', "scope": "static inspection of only that target", "permitted_actions": "static-local"}\n```');
  }
  return bits.join("\n\n");
});

const currentInput = computed(() => {
  if (mode.value === "talk") return talkText.value;
  if (mode.value === "paste") return pasteText.value;
  if (mode.value === "upload") return uploadedFileText.value;
  if (mode.value === "existing") return existingInput.value;
  return "";
});

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      alert("Clipboard is empty.");
      return;
    }
    pasteText.value = text;
    mode.value = "paste";
    saveDraft();
  } catch (e: any) {
    alert("Couldn't read the clipboard. That didn't work. Here's what to try: copy the text first, then click Paste again.");
  }
}

function handleUploadClick() {
  uploadInput.value?.click();
}

const SUPPORTED_UPLOAD_RE = /\.(md|markdown|txt|text|pdf|doc|docx|rtf|csv|json|yaml|yml|jpg|jpeg|png|gif|webp|bmp|svg|heic|heif|tif|tiff)$/i;

function isImageName(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif|tif|tiff)$/i.test(name);
}

async function handleFileChosen(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!SUPPORTED_UPLOAD_RE.test(file.name)) {
    alert("Attach markdown, text, Word, PDF, or an image (JPG, PNG, GIF, WebP, BMP, SVG, HEIC, TIFF).");
    input.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("That file is over 8 MB. Attach a smaller file or paste the key text instead.");
    input.value = "";
    return;
  }
  // Images attach as visual context; the interview reads text only for now.
  if (isImageName(file.name) || file.type.startsWith("image/")) {
    uploadedFileName.value = file.name;
    uploadedFileText.value = `[image attached: ${file.name} — ${(file.size / 1024).toFixed(0)} KB]\nDescribe what this image shows in the box below, or keep it as visual context for the interview.`;
    mode.value = "upload";
    saveDraft();
    return;
  }
  let text = "";
  try {
    text = await file.text();
  } catch {
    alert("Could not read that file as text. Paste the key text instead.");
    input.value = "";
    return;
  }
  if (!text.trim()) {
    alert("That file has no readable text (scanned PDFs and Word exports often don't). Paste the key text or describe the image instead.");
    input.value = "";
    return;
  }
  uploadedFileName.value = file.name;
  uploadedFileText.value = text.slice(0, 200000);
  mode.value = "upload";
  saveDraft();
}

function clearUpload() {
  uploadedFileName.value = "";
  uploadedFileText.value = "";
  if (uploadInput.value) uploadInput.value.value = "";
}

function fillExample(text: string) {
  talkText.value = text;
  mode.value = "talk";
  saveDraft();
}

async function doAnalyze() {
  if (analyzing.value) return;
  const input = currentInput.value.trim();
  if (!input) {
    alert("Add some text first — talk it through, upload a file, or paste.");
    return;
  }
  analyzing.value = true;
  try {
    session.value = await analyzeDescription(input);
    saveDraft();
  } catch (e: any) {
    alert("That didn't work: " + e.message);
  } finally {
    analyzing.value = false;
  }
}

async function doChatSend() {
  if (!chatInput.value.trim() || analyzing.value) return;
  analyzing.value = true;
  try {
    session.value = await sendChatMessage(chatInput.value);
    chatInput.value = "";
  } catch (e: any) {
    alert("That didn't work: " + e.message);
  } finally { analyzing.value = false; }
}

async function doAnswerQuestion(q: DiscoveryQuestionItem, answer: string) {
  if (!session.value?.analysis) return;
  try {
    session.value = await answerQuestion(q.id, answer);
  } catch (e: any) {
    alert("That didn't work: " + e.message);
  }
}

async function doAcceptSuggestion(id: string) {
  if (!session.value) return;
  try { session.value = await acceptSuggestion(id); } catch (e: any) { alert(e.message); }
}
async function doRejectSuggestion(id: string) {
  if (!session.value) return;
  try { session.value = await rejectSuggestion(id); } catch (e: any) { alert(e.message); }
}

async function doResetSession() {
  if (!confirm("Reset the session? This clears the spec and the analysis. Drafts are kept.")) return;
  try {
    session.value = await resetDiscoverySession();
    talkText.value = "";
    pasteText.value = "";
    uploadedFileName.value = "";
    uploadedFileText.value = "";
  } catch (e: any) { alert(e.message); }
}

async function doEditSpec(md: string) {
  try { session.value = await updateSpecMarkdown(md); scheduleSave(); } catch (e: any) { alert(e.message); }
}

function continueToReview() {
  if (!session.value?.ready) { alert("Let's finish the interview first. Your interviewer will summarize the brief when it's ready."); return; }
  saveDraft();
  go("review-approve", { specPath: undefined });
}

const hasSpec = computed(() => Boolean(session.value?.ready));

const openQuestionsLeft = computed(() => session.value?.analysis?.openQuestions?.filter(q => !q.answered).length ?? 0);

const fmtTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
</script>

<template>
  <div>
    <ScreenHeader screen="new-job" />
    <!-- 5-step ladder: 1 Describe (here), 2 Answer (interview), 3 Check (review), 4 Sign twice, 5 Run + zip. -->
    <ol class="ladder" aria-label="The 5 steps from idea to finished bundle">
      <li class="ladder-step current" aria-current="step"><strong>1 · Describe</strong><span>— you are here. Pick a way to tell us below.</span></li>
      <li class="ladder-step"><strong>2 · Answer</strong><span>— the interviewer asks short numbered questions.</span></li>
      <li class="ladder-step"><strong>3 · Check</strong><span>— read the spec back in Review.</span></li>
      <li class="ladder-step"><strong>4 · Sign twice</strong><span>— first sign, then initials. Both stay on this machine.</span></li>
      <li class="ladder-step"><strong>5 · Run + zip</strong><span>— Crew builds it; Results packs one zip to take home.</span></li>
    </ol>
    <div class="section-card" style="margin-bottom: 14px">
      <button class="btn btn-secondary" :disabled="!VoiceRecognition" @click="toggleVoice">{{ listening ? "Stop listening" : "Use microphone" }}</button>
      <span class="dim"> {{ VoiceRecognition ? "Review your dictated words before sending. Your browser may use an external speech service. Win+H dictation also works right into the box below." : "Voice input is unavailable in this browser — press Win+H to dictate into the box, or use Paste and Upload." }}</span>
    </div>

    <!-- Draft chip. Kept in the layout even when empty: inserting it on blur
         used to push the analyze button down between mousedown and mouseup,
         swallowing the first click. -->
    <div
      class="draft-chip"
      :class="{ empty: !draftSavedAt }"
      :aria-hidden="!draftSavedAt"
      aria-live="polite"
    >
      <Save :size="12" />
      <span v-if="draftSavedAt">Draft saved at {{ fmtTime(draftSavedAt) }}</span>
      <span v-else>Draft not saved yet</span>
    </div>

    <!-- 4 numbered front doors: the owner asked for a visible 1-2-3 within step 1. -->
    <div class="mode-grid" role="tablist" aria-label="Intake mode">
      <button class="mode-card" :class="{ active: mode === 'talk' }" @click="mode = 'talk'" data-tour="new-job-talk" role="tab">
        <MessageSquare :size="18" />
        <div class="mode-name">1 · Talk it through</div>
        <div class="mode-desc">Describe what you want in plain words. Dictate with Win+H or type. No format required.</div>
      </button>
      <button class="mode-card" :class="{ active: mode === 'upload' }" @click="handleUploadClick" data-tour="new-job-upload" role="tab">
        <FileUp :size="18" />
        <div class="mode-name">2 · Dump what you have</div>
        <div class="mode-desc">Markdown, text, Word, PDF, or images — drawings, scans, screenshots. Click to pick a file. Everything helps.</div>
      </button>
      <button class="mode-card" :class="{ active: mode === 'paste' }" @click="mode = 'paste'" data-tour="new-job-paste" role="tab">
        <Clipboard :size="18" />
        <div class="mode-name">3 · Paste text</div>
        <div class="mode-desc">Use the Paste button to drop text straight from the clipboard. No typing needed.</div>
      </button>
      <button class="mode-card" :class="{ active: mode === 'existing' }" @click="mode = 'existing'" data-tour="new-job-existing" role="tab">
        <History :size="18" />
        <div class="mode-name">4 · Point at software</div>
        <div class="mode-desc">Name an app or folder. REA inspects it read-only for a head start — or continue without it.</div>
      </button>
    </div>
    <input ref="uploadInput" type="file" accept=".md,.markdown,.txt,.text,.pdf,.doc,.docx,.rtf,.csv,.json,.yaml,.yml,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.heic,.heif,.tif,.tiff" style="display:none" @change="handleFileChosen" />

    <!-- Active mode input -->
    <div class="section-card" style="margin-top: 14px;">
      <!-- TALK -->
      <div v-if="mode === 'talk'">
        <div class="section-label">Describe what you want</div>
        <textarea
          v-model="talkText"
          rows="6"
          placeholder="e.g. Add a /health endpoint that returns JSON with the build SHA and current time. No new dependencies."
          @blur="saveDraft"
        ></textarea>
      </div>

      <!-- UPLOAD -->
      <div v-else-if="mode === 'upload'">
        <div class="section-label">Dump what you have</div>
        <div v-if="!uploadedFileName" class="upload-zone" @click="handleUploadClick">
          <Upload :size="22" />
          <div>Click to attach markdown, text, Word, PDF, or images</div>
          <div class="dim" style="font-size: 12px;">The file stays on your machine. Text is read; images ride along as visual context.</div>
        </div>
        <div v-else class="upload-done">
          <FileText :size="16" />
          <strong>{{ uploadedFileName }}</strong>
          <span class="dim">— {{ uploadedFileText.length.toLocaleString() }} chars</span>
          <button class="btn btn-ghost btn-xs" @click="clearUpload">Remove</button>
        </div>
      </div>

      <!-- EXISTING SOFTWARE (REA front door) -->
      <div v-else-if="mode === 'existing'">
        <div class="section-label">Point at existing software</div>
        <p class="dim" style="margin: 0 0 10px; font-size: 13px;">
          Name the app or folder you want to learn from — for example a network scanner like Fing, or a folder of legacy code.
          REA inspects it read-only (static only, never runs it) and hands the interview a head start.
          At Review you'll pick "Investigate, Then Build". If inspection can't run, you'll get a plain "continue without it" choice.
        </p>
        <div class="section-label">What do you want to learn from it?</div>
        <textarea
          v-model="existingQuestion"
          rows="3"
          placeholder="e.g. How does its network scan work, and what would a minimal clone need?"
          @blur="saveDraft"
        ></textarea>
        <div class="section-label" style="margin-top: 10px;">Absolute local path to the app or folder</div>
        <input
          type="text"
          v-model="existingTarget"
          placeholder="e.g. D:\tools\fing or D:\legacy\scanner"
          @blur="saveDraft"
        />
        <div class="dim" style="font-size: 12px; margin-top: 4px;">Must be a full path on this machine. Relative paths and network drives are rejected.</div>
      </div>

      <!-- PASTE -->
      <div v-else>
        <div class="section-label">Paste text</div>
        <div class="paste-row">
          <button class="btn btn-secondary" @click="pasteFromClipboard" data-tour="new-job-paste-btn">
            <Clipboard :size="14" /> Paste from clipboard
          </button>
          <span class="dim" style="font-size: 12px;">Trims leading/trailing whitespace automatically.</span>
        </div>
        <textarea
          v-model="pasteText"
          rows="6"
          placeholder="Or paste text here manually."
          @blur="saveDraft"
        ></textarea>
      </div>

      <!-- Examples -->
      <div v-if="mode !== 'upload'" class="examples-row">
        <div class="section-label" style="margin-bottom: 6px;">Or start from an example</div>
        <div class="example-chips">
          <button v-for="ex in EXAMPLES" :key="ex" class="example-chip" @click="fillExample(ex)">
            <Sparkles :size="11" /> {{ ex.length > 64 ? ex.slice(0, 64) + "…" : ex }}
          </button>
        </div>
      </div>

      <div style="margin-top: 12px;">
        <button class="btn btn-primary" :disabled="analyzing || !currentInput.trim()" @click="doAnalyze">
          <Sparkles :size="14" />
          {{ analyzing ? "Reading it through…" : "Read it back to me" }}
        </button>
      </div>
    </div>

    <!-- Read-back: parsed sections -->
    <div v-if="session?.analysis" class="section-card" style="margin-top: 14px;">
      <div class="section-label">Read-back — in clear sections</div>
      <p class="dim" style="margin: 0 0 10px; font-size: 13px;">{{ session.analysis.summary }}</p>

      <div class="readback-sections">
        <div class="rb-section">
          <div class="rb-name">Missing requirements ({{ session.analysis.missingRequirements.length }})</div>
          <ul>
            <li v-for="m in session.analysis.missingRequirements" :key="m.id">
              <strong>{{ m.title }}</strong> <span class="badge" :class="'badge-' + (m.severity === 'high' ? 'red' : m.severity === 'medium' ? 'amber' : 'blue')">{{ m.severity }}</span>
              <div class="dim" style="margin-top: 2px; font-size: 12.5px;">{{ m.detail }}</div>
            </li>
          </ul>
        </div>

        <div class="rb-section">
          <div class="rb-name">Ambiguities ({{ session.analysis.ambiguities.length }})</div>
          <ul>
            <li v-for="a in session.analysis.ambiguities" :key="a.id">
              <strong>{{ a.term }}</strong>
              <div class="dim" style="margin-top: 2px; font-size: 12.5px;">{{ a.explanation }}</div>
              <div v-if="a.suggestions" class="suggestion-chips">
                <span v-for="s in a.suggestions" :key="s" class="badge">{{ s }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div class="rb-section">
          <div class="rb-name">Suggestions ({{ session.analysis.suggestions.length }})</div>
          <ul>
            <li v-for="s in session.analysis.suggestions" :key="s.id">
              <strong>{{ s.title }}</strong>
              <div class="dim" style="margin-top: 2px; font-size: 12.5px;">{{ s.description }}</div>
              <div class="suggestion-actions">
                <button v-if="s.status === 'pending'" class="btn btn-success btn-xs" @click="doAcceptSuggestion(s.id)">Accept</button>
                <button v-if="s.status === 'pending'" class="btn btn-ghost btn-xs" @click="doRejectSuggestion(s.id)">Reject</button>
                <span v-else class="badge" :class="s.status === 'accepted' ? 'badge-green' : 'badge-red'">{{ s.status }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div class="rb-section">
          <div class="rb-name">Risks ({{ session.analysis.risks.length }})</div>
          <ul>
            <li v-for="r in session.analysis.risks" :key="r.id">
              <strong>{{ r.title }}</strong> <span class="badge" :class="'badge-' + (r.riskLevel === 'high' ? 'red' : r.riskLevel === 'medium' ? 'amber' : 'blue')">{{ r.riskLevel }}</span>
              <div class="dim" style="margin-top: 2px; font-size: 12.5px;">{{ r.mitigation }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Open questions, one at a time -->
    <div v-if="session?.analysis?.openQuestions?.length" class="section-card" style="margin-top: 14px;">
      <div class="section-label">Open questions — asked one at a time</div>
      <div v-for="q in session.analysis.openQuestions" :key="q.id" class="q-card" :class="{ answered: q.answered }">
        <div class="q-question">{{ q.question }}</div>
        <div v-if="q.answered" class="q-answered">
          <span class="badge badge-green">answered</span> {{ q.answer }}
        </div>
        <div v-else class="q-choices">
          <button v-for="c in q.choices" :key="c" class="btn btn-secondary btn-xs" @click="doAnswerQuestion(q, c)">
            {{ c }}
          </button>
          <input
            type="text"
            placeholder="Or type your own answer (typing is optional)"
            @keyup.enter="doAnswerQuestion(q, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <div v-if="session?.rawInput" class="section-card" style="margin-top: 14px;">
      <div class="section-label">Continue the conversation</div>
      <div aria-live="polite" class="interview-history">
        <p v-for="message in session.chatHistory" :key="message.id"><strong>{{ message.role === 'user' ? 'You' : 'Crew' }}:</strong> {{ message.content }}</p>
      </div>
      <label for="interview-followup">Add a correction, answer, or requirement</label>
      <textarea id="interview-followup" v-model="chatInput" rows="3" :disabled="analyzing"></textarea>
      <button class="btn btn-primary" :disabled="analyzing || !chatInput.trim()" @click="doChatSend">{{ analyzing ? 'Thinking…' : 'Send follow-up' }}</button>
      <button class="btn btn-secondary" :disabled="analyzing" @click="chatInput = 'Re-check the edited specification. Preserve my edits, identify any remaining required questions, and summarize it for review when ready.'; doChatSend()">Re-check edited spec</button>
    </div>

    <!-- Editable spec -->
    <div v-if="session?.rawInput" class="section-card" style="margin-top: 14px;">
      <div class="section-label" style="display: flex; align-items: center; justify-content: space-between;">
        <span>Working spec — edit any section directly</span>
        <span class="dim" style="font-size: 11.5px; text-transform: none; font-weight: 400; letter-spacing: 0;">Auto-saves to draft. Editing after approval creates a new version.</span>
      </div>
      <textarea
        :value="session.specMarkdown"
        @input="doEditSpec(($event.target as HTMLTextAreaElement).value)"
        rows="14"
        class="spec-edit"
      ></textarea>
    </div>

    <!-- Bottom action: the single primary button. Reset lives in the drawer. -->
    <div class="bottom-action">
      <button class="btn btn-primary btn-lg" :disabled="!hasSpec" @click="continueToReview" data-tour="new-job-continue">
        Continue to Review &amp; Approve
        <ArrowRight :size="14" />
      </button>
      <div class="dim" style="font-size: 12.5px;">
        <span v-if="openQuestionsLeft > 0">{{ openQuestionsLeft }} question(s) still open — you can answer them now or in review.</span>
        <span v-else-if="hasSpec">Spec looks ready. Continue to approve.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draft-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: var(--dim);
  background: var(--panel-2); border: 1px solid var(--border-soft);
  padding: 2px 8px; border-radius: 10px;
  margin-bottom: 12px;
}
.draft-chip.empty { visibility: hidden; }
.ladder {
  list-style: none; margin: 0 0 14px; padding: 10px 14px;
  display: flex; flex-wrap: wrap; gap: 6px 14px;
  background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius-sm);
  font-size: 12.5px; color: var(--dim);
}
.ladder-step { display: flex; gap: 4px; align-items: baseline; }
.ladder-step.current { color: var(--text); }
.ladder-step.current strong { color: var(--accent); }
.mode-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
.mode-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  cursor: pointer; color: var(--text); font-family: var(--sans); text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.mode-card:hover { border-color: var(--accent); background: var(--surface-hover); }
.mode-card.active { border-color: var(--accent); background: var(--accent-soft); }
.mode-name { font-weight: 600; font-size: 14px; margin-top: 2px; }
.mode-desc { font-size: 12.5px; color: var(--dim); line-height: 1.5; }

.upload-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 28px; border: 2px dashed var(--border); border-radius: var(--radius);
  color: var(--dim); cursor: pointer; text-align: center;
}
.upload-zone:hover { border-color: var(--accent); color: var(--text); background: var(--panel-2); }
.upload-done { display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--panel-2); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); }
.paste-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }

.examples-row { margin-top: 14px; }
.example-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.example-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; background: var(--panel-2); border: 1px solid var(--border-soft);
  border-radius: 14px; color: var(--dim); font-family: var(--sans); font-size: 12px;
  cursor: pointer; text-align: left; line-height: 1.4;
}
.example-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }

.readback-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rb-section { background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 12px; }
.rb-name { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
.rb-section ul { padding-left: 18px; margin: 0; }
.rb-section li { font-size: 13px; margin-bottom: 6px; }
.suggestion-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.suggestion-actions { display: flex; gap: 4px; margin-top: 6px; }

.q-card { padding: 12px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); margin-bottom: 8px; }
.q-card.answered { opacity: 0.75; }
.q-question { font-weight: 600; font-size: 13.5px; margin-bottom: 8px; }
.q-choices { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.q-choices input { flex: 1; min-width: 200px; }
.q-answered { font-size: 13px; color: var(--dim); }

.spec-edit { font-family: var(--mono); font-size: 13px; line-height: 1.55; }

.bottom-action { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--border-soft); }

@media (max-width: 1020px) {
  .mode-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .mode-grid { grid-template-columns: 1fr; }
  .readback-sections { grid-template-columns: 1fr; }
}
</style>

<script setup lang="ts">
import { parseArgv } from "@shared/command-argv";
import { computed, onMounted, ref } from "vue";
import {
  AlertCircle, CheckCircle2, Clipboard, Eye, EyeOff, Key, ListChecks, Plug,
  RefreshCw, Save,
} from "lucide-vue-next";
import ScreenHeader from "@/components/ScreenHeader.vue";
import {
  fetchModels, getProfiles, getProjectQuality, saveProjectQuality, saveProfile,
  setDefaultTokenCap, testConnection, applyConnectionToAll, useMetaEverywhere,
} from "@/lib/api";
import type {
  ConnectionProfile, ConnectionProfileStore, FetchModelsResponse,
  ProjectQualityState, QualityConfig, TestConnectionResponse,
} from "@shared/types.ts";
import ConfigView from "@/views/ConfigView.vue";

const QUALITY_FIELDS = [
  { key: "test", label: "Test", placeholder: "bun test" },
  { key: "lint", label: "Lint", placeholder: "bun run lint" },
  { key: "typecheck", label: "Typecheck", placeholder: "bunx vue-tsc --noEmit" },
  { key: "build", label: "Build", placeholder: "bun run build" },
] as const;
type QualityKey = typeof QUALITY_FIELDS[number]["key"];

const store = ref<ConnectionProfileStore | null>(null);
const tab = ref<"profiles">("profiles");
const activeRole = ref<string>("interviewer");
const activeProvider = ref<"local" | "cloud" | "meta">("meta");
const advancedTab = ref<"roles" | "token" | "quality" | "roster">("roles");

const fetchModelsResult = ref<Record<string, FetchModelsResponse>>({});
const testResult = ref<Record<string, TestConnectionResponse>>({});
const busy = ref<Record<string, "fetch" | "test" | "save" | null>>({});
const showSecret = ref<Record<string, boolean>>({});
const keyBuffer = ref<Record<string, string>>({});
const modelsDropdown = ref<Record<string, string[]>>({});
const saveOk = ref<Record<string, boolean>>({});
const quality = ref<ProjectQualityState | null>(null);
const qualityDraft = ref<Record<QualityKey, string>>({ test: "", lint: "", typecheck: "", build: "" });
const qualityError = ref<string | null>(null);
const qualitySaved = ref(false);

function fillQuality(state: ProjectQualityState) {
  for (const field of QUALITY_FIELDS) {
    qualityDraft.value[field.key] = state.config?.[field.key]?.length ? JSON.stringify(state.config[field.key]) : "";
  }
}

onMounted(async () => {
  try {
    store.value = await getProfiles();
    // Prefer the Meta interviewer profile when it exists (the happy path);
    // otherwise fall back to the first saved profile.
    const preferred = store.value.profiles.find(p => p.role === "interviewer" && p.provider === "meta")
      ?? store.value.profiles.find(p => p.provider === "meta")
      ?? store.value.profiles[0];
    if (preferred) {
      activeRole.value = preferred.role;
      activeProvider.value = preferred.provider;
    }
  } catch (e) {
    console.error("Settings load failed:", e);
  }
  try {
    quality.value = await getProjectQuality();
    fillQuality(quality.value);
  } catch (e: any) {
    qualityError.value = e.message;
  }
});

const activeProfile = computed<ConnectionProfile | null>(() => {
  if (!store.value) return null;
  return store.value.profiles.find(
    p => p.role === activeRole.value && p.provider === activeProvider.value,
  ) ?? null;
});

const roles = computed(() => {
  if (!store.value) return [];
  const seen = new Set<string>();
  const out: { role: string; label: string; providers: ("local" | "cloud" | "meta")[] }[] = [];
  for (const p of store.value.profiles) {
    if (!seen.has(p.role)) {
      seen.add(p.role);
      const providers = store.value.profiles
        .filter(x => x.role === p.role)
        .map(x => x.provider);
      out.push({ role: p.role, label: p.label.replace(/ \((cloud|meta)\)$/, ""), providers });
    }
  }
  return out;
});

function key(p: ConnectionProfile): string {
  return `${p.role}:${p.provider}`;
}
async function handleApplyAll(p: ConnectionProfile) {
  if (!confirm("Use this saved connection and model for every role? You can change individual roles afterward.")) return;
  try { store.value = await applyConnectionToAll(p.role, p.provider); } catch (error: any) { alert(error.message); }
}

async function handleUseMetaEverywhere(p: ConnectionProfile) {
  busy.value[key(p)] = "save";
  try {
    store.value = await useMetaEverywhere(p.role);
    // The server flipped every role to meta — show the meta panel, not the
    // stale cloud/local one, so the switch is visible instead of silent.
    activeProvider.value = "meta";
    const updated = store.value.profiles.find(x => x.role === activeRole.value && x.provider === "meta");
    if (updated && testResult.value[key(updated)]) testResult.value[key(activeProfile.value ?? updated)] = testResult.value[key(updated)];
  } catch (error: any) { alert(error.message); }
  finally { busy.value[key(p)] = null; }
}

// Setup staircase: one click saves the pasted key, then tests the connection.
// Green result means the job path below it will work.
async function handleSetupAndTest(p: ConnectionProfile) {
  busy.value[key(p)] = "save";
  try {
    const incoming = (keyBuffer.value[key(p)] ?? "").trim();
    if (incoming && incoming !== "••••••••") {
      store.value = await saveProfile({ ...p, apiKey: incoming });
      keyBuffer.value[key(p)] = "";
      showSecret.value[key(p)] = false;
      const saved = store.value?.profiles.find(x => x.role === p.role && x.provider === p.provider);
      if (saved) p = saved;
    }
  } catch (error: any) { alert(error.message); return; }
  finally { busy.value[key(p)] = null; }
  await handleTestConnection(p);
}

const connectionOk = computed(() => {
  if (!activeProfile.value) return false;
  return testResult.value[key(activeProfile.value)]?.ok === true;
});

const connectionLabel = computed(() => {
  if (!activeProfile.value) return "";
  const p = activeProfile.value;
  if (p.provider === "meta") return `Meta · ${p.model}`;
  if (p.provider === "local") return `local router · ${p.model}`;
  return `cloud · ${p.model}`;
});

function maskedValue(p: ConnectionProfile): string {
  if (!p.apiKey || p.apiKey === "none") return "";
  if (showSecret.value[key(p)]) return p.apiKey;
  if (p.apiKey.length > 10) return p.apiKey.slice(0, 4) + "••••••••" + p.apiKey.slice(-4);
  return "••••••••";
}

function isBusy(p: ConnectionProfile | null, action: "fetch" | "test" | "save"): boolean {
  if (!p) return false;
  return busy.value[key(p)] === action;
}

function spinClass(p: ConnectionProfile | null): string {
  return isBusy(p, "fetch") ? "spin" : "";
}

async function pasteKey(p: ConnectionProfile) {
  try {
    const text = (await navigator.clipboard.readText()).replace(/\s+/g, "").trim();
    if (!text) return;
    keyBuffer.value[key(p)] = text;
    showSecret.value[key(p)] = true;
  } catch {
    alert("Couldn't read the clipboard. That didn't work. Here's what to try: copy the key first, then click Paste.");
  }
}

async function handleFetchModels(p: ConnectionProfile) {
  busy.value[key(p)] = "fetch";
  try {
    const res = await fetchModels(p.baseUrl, keyBuffer.value[key(p)] || p.apiKey, p);
    fetchModelsResult.value[key(p)] = res;
    if (res.models?.length) {
      modelsDropdown.value[key(p)] = res.models;
    }
  } finally {
    busy.value[key(p)] = null;
  }
}

async function handleTestConnection(p: ConnectionProfile) {
  busy.value[key(p)] = "test";
  try {
    // Never send the masked placeholder: an empty buffer means "use the saved
    // key server-side". Sending •••••••• would fail auth every time.
    const typed = (keyBuffer.value[key(p)] ?? "").trim();
    const res = await testConnection(
      p.baseUrl,
      p.model,
      typed || (typed === "" && !p.apiKey.startsWith("•") ? p.apiKey : ""),
      p,
    );
    testResult.value[key(p)] = res;
  } finally {
    busy.value[key(p)] = null;
  }
}

async function handleSave(p: ConnectionProfile) {
  busy.value[key(p)] = "save";
  try {
    const incoming = keyBuffer.value[key(p)];
    const updated: ConnectionProfile = {
      ...p,
      apiKey: incoming && incoming !== "••••••••" ? incoming : p.apiKey,
    };
    store.value = await saveProfile(updated);
    keyBuffer.value[key(p)] = "";
    showSecret.value[key(p)] = false;
    saveOk.value[key(p)] = true;
    setTimeout(() => { saveOk.value[key(p)] = false; }, 2000);
  } finally {
    busy.value[key(p)] = null;
  }
}

async function handleSaveCap() {
  if (!store.value) return;
  try {
    store.value = await setDefaultTokenCap(store.value.defaultTokenCap);
  } catch (e: any) { alert(e.message); }
}

async function handleSaveQuality() {
  try {
    const payload: QualityConfig = {};
    for (const field of QUALITY_FIELDS) {
      const argv = parseArgv(qualityDraft.value[field.key]);
      if (argv.length) (payload as Record<string, string[]>)[field.key] = argv;
    }
    if (!Object.keys(payload).length) {
      throw new Error("Add at least one real check (test, lint, typecheck, or build).");
    }
    quality.value = await saveProjectQuality(payload);
    fillQuality(quality.value);
    qualitySaved.value = true;
    setTimeout(() => { qualitySaved.value = false; }, 2500);
  } catch (e: any) {
    alert(e.message);
  }
}

const REASONING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
</script>

<template>
  <div>
    <ScreenHeader screen="settings" />

    <div class="settings-tabs">
      <button class="tab-btn" :class="{ active: tab === 'profiles' }" @click="tab = 'profiles'">Setup</button>
    </div>

    <!-- SETUP: status + key + test + one click. Advanced wiring below. -->
    <div v-if="tab === 'profiles' && store && activeProfile">
      <div class="section-card" style="max-width: 600px; margin-bottom: 14px;" data-tour="settings-connection">
        <div class="section-label">Your connection</div>
        <p class="dim" style="margin: 0 0 12px; font-size: 13px;">
          <span v-if="connectionOk" style="color: var(--green);">Connected — {{ connectionLabel }}.</span>
          <span v-else>Paste your key, then press Test. Green means you're set.</span>
        </p>
        <div class="field-row">
          <input
            :type="showSecret[key(activeProfile)] ? 'text' : 'password'"
            :value="keyBuffer[key(activeProfile)] ?? maskedValue(activeProfile)"
            @input="keyBuffer[key(activeProfile)] = ($event.target as HTMLInputElement).value"
            :placeholder="activeProfile.provider === 'meta' ? 'paste your Meta key' : 'paste your key'"
          />
          <button class="btn btn-ghost btn-xs" @click="pasteKey(activeProfile)" title="Paste and trim">
            <Clipboard :size="13" /> Paste
          </button>
          <button class="btn btn-ghost btn-xs" @click="showSecret[key(activeProfile)] = !showSecret[key(activeProfile)]" :title="showSecret[key(activeProfile)] ? 'Hide' : 'Show'">
            <Eye v-if="!showSecret[key(activeProfile)]" :size="13" />
            <EyeOff v-else :size="13" />
          </button>
        </div>
        <div class="action-row">
          <button class="btn btn-primary btn-lg" :disabled="isBusy(activeProfile, 'save') || isBusy(activeProfile, 'test')" @click="handleSetupAndTest(activeProfile)" data-tour="settings-save">
            <Plug :size="16" /> {{ testResult[key(activeProfile)]?.ok ? "Connected — test again" : "Test connection" }}
          </button>
          <CheckCircle2 v-if="testResult[key(activeProfile)]?.ok" :size="18" style="color: var(--green);" />
        </div>
        <div v-if="testResult[key(activeProfile)]" class="test-result" :class="{ ok: testResult[key(activeProfile)]!.ok, err: !testResult[key(activeProfile)]!.ok }">
          <component :is="testResult[key(activeProfile)]!.ok ? CheckCircle2 : AlertCircle" :size="14" />
          <div>
            <div style="font-weight: 600;">{{ testResult[key(activeProfile)]!.ok ? "Connected" : "Couldn't connect" }}</div>
            <div class="dim" style="font-size: 12.5px;">{{ testResult[key(activeProfile)]!.message }}</div>
          </div>
        </div>
        <div v-if="activeProfile.provider === 'meta'" style="margin-top: 12px;">
          <button class="btn btn-primary" :disabled="isBusy(activeProfile, 'save')" @click="handleUseMetaEverywhere(activeProfile)">
            <Save :size="14" /> Use Meta for everything
          </button>
          <div class="dim" style="font-size: 12px; margin-top: 6px;">
            One click after the test goes green: all roles switch to this connection. No preset to name or apply.
          </div>
        </div>
      </div>

      <details class="section-card" style="max-width: 720px;">
        <summary class="section-label" style="cursor: pointer;">Advanced: per-role wiring</summary>
        <p class="dim" style="font-size: 12.5px;">Each role can point at its own provider and model. Most people never need this — the connection above covers it.</p>
        <div class="settings-tabs" style="margin-top: 10px;">
          <button class="tab-btn" :class="{ active: advancedTab === 'roles' }" @click="advancedTab = 'roles'">Roles</button>
          <button class="tab-btn" :class="{ active: advancedTab === 'token' }" @click="advancedTab = 'token'">Token guard</button>
          <button class="tab-btn" :class="{ active: advancedTab === 'quality' }" @click="advancedTab = 'quality'">Project checks</button>
          <button class="tab-btn" :class="{ active: advancedTab === 'roster' }" @click="advancedTab = 'roster'">Roster &amp; API keys</button>
        </div>
        <div v-if="advancedTab === 'roles'" class="profile-cols" style="margin-top: 12px;">
          <div class="section-card role-list">
            <div class="section-label">Roles</div>
            <button
              v-for="r in roles"
              :key="r.role"
              class="role-row"
              :class="{ active: activeRole === r.role }"
              @click="activeRole = r.role"
            >
              <Key :size="14" />
              <span>{{ r.label }}</span>
              <span class="badge" v-if="r.providers.includes('local')">local</span>
              <span class="badge" v-if="r.providers.includes('meta')">meta</span>
              <span
                class="badge"
                v-if="r.providers.includes('cloud')"
                :class="store.profiles.find(p => p.role === r.role && p.provider === 'cloud')?.disabled ? 'badge-red' : ''"
              >cloud</span>
            </button>
          </div>

          <div class="section-card profile-detail">
            <div class="provider-tabs">
              <button class="tab-btn" :class="{ active: activeProvider === 'local' }" @click="activeProvider = 'local'">Local (31415 router)</button>
              <button
                class="tab-btn"
                :class="{ active: activeProvider === 'meta' }"
                :disabled="!roles.find(r => r.role === activeRole)?.providers.includes('meta')"
                @click="activeProvider = 'meta'"
              >Meta (cheap)</button>
              <button
                class="tab-btn"
                :class="{ active: activeProvider === 'cloud' }"
                :disabled="!roles.find(r => r.role === activeRole)?.providers.includes('cloud')"
                @click="activeProvider = 'cloud'"
              >Cloud (Venice)</button>
            </div>

            <div v-if="activeProfile.provider === 'cloud' && activeProfile.disabled" class="callout warn" style="margin-bottom: 10px;">
              Cloud is disabled until a <code>VENICE_API_KEY</code> is set in <code>.env</code>.
            </div>
            <div v-if="activeProfile.provider === 'meta'" class="callout" style="margin-bottom: 10px;">
              Meta uses your cheap non-expiring key (<code>META_API_KEY</code> in <code>.env</code>, or paste below).
              Base URL is <code>https://api.meta.ai/v1</code>, model <code>muse-spark-1.3-contributor</code> is preselected.
            </div>

            <div class="field">
              <label class="field-label">Base URL</label>
              <input type="text" v-model="activeProfile.baseUrl" placeholder="http://127.0.0.1:31415/v1" />
            </div>

            <div class="field">
              <label class="field-label">Model</label>
              <div class="field-row">
                <select v-model="activeProfile.model" aria-label="Model">
                  <option v-for="m in [...new Set(['auto', activeProfile.model, ...(modelsDropdown[key(activeProfile)] ?? [])])]" :key="m" :value="m">{{ m }}</option>
                </select>
                <button class="btn btn-secondary btn-sm" :disabled="isBusy(activeProfile, 'fetch')" @click="handleFetchModels(activeProfile)">
                  <RefreshCw :size="13" :class="spinClass(activeProfile)" /> Fetch models
                </button>
              </div>
              <div v-if="fetchModelsResult[key(activeProfile)]?.error" class="dim" style="color: var(--red); font-size: 12px; margin-top: 4px;">
                {{ fetchModelsResult[key(activeProfile)]!.error }}
              </div>
              <div v-else-if="fetchModelsResult[key(activeProfile)]?.models?.length" class="dim" style="font-size: 12px; margin-top: 4px;">
                Found {{ fetchModelsResult[key(activeProfile)]!.models.length }} models. Pick from the dropdown.
              </div>
            </div>

            <div class="field-grid">
              <div class="field">
                <label class="field-label">Reasoning level</label>
                <select v-model="activeProfile.reasoningLevel">
                  <option v-for="lvl in REASONING_LEVELS" :key="lvl" :value="lvl">{{ lvl }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Hide "thinking" text</label>
                <label class="check-row">
                  <input type="checkbox" v-model="activeProfile.hideThinking" />
                  <span class="dim" style="font-size: 12.5px;">Hide chain-of-thought text in console output.</span>
                </label>
              </div>
            </div>

            <div v-if="activeProfile.provider !== 'meta'" class="callout warn" style="margin-bottom: 10px;">
              This role is on {{ activeProfile.provider === "cloud" ? "Cloud (Venice)" : "the local router" }}, not Meta. Your Meta key is saved — one click moves every role to it.
            </div>

            <div class="action-row">
              <button class="btn btn-primary" :disabled="isBusy(activeProfile, 'save')" @click="handleUseMetaEverywhere(activeProfile)">
                <Save :size="14" /> Switch all roles to Meta
              </button>
              <button v-if="activeProfile.provider !== 'meta'" class="btn btn-secondary" @click="handleApplyAll(activeProfile)">Use saved connection for all roles</button>
              <button class="btn btn-secondary" :disabled="isBusy(activeProfile, 'save')" @click="handleSave(activeProfile)">
                <Save :size="14" /> Save profile
              </button>
              <CheckCircle2 v-if="saveOk[key(activeProfile)]" :size="16" style="color: var(--green);" />
            </div>
          </div>
        </div>

        <div v-if="advancedTab === 'token' && store" style="margin-top: 12px;">
          <div class="section-card" style="max-width: 500px;">
            <div class="section-label">Default token cap</div>
            <p class="dim" style="font-size: 13px; margin: 0 0 10px;">
              Every new run starts with this cap. When usage reaches the cap, the run stops with a calm plain-language message. Default low so a runaway job can't drain your wallet.
            </p>
            <div class="field-row">
              <input type="number" v-model.number="store.defaultTokenCap" min="1" step="1000" />
              <button class="btn btn-primary" @click="handleSaveCap"><Save :size="14" /> Save</button>
            </div>
            <div class="dim" style="font-size: 12px; margin-top: 6px;">
              Current: {{ store.defaultTokenCap.toLocaleString() }} tokens. Choose a positive whole number; reporting may overshoot by a turn.
            </div>
          </div>
        </div>

        <div v-if="advancedTab === 'quality'" style="margin-top: 12px;">
          <div class="section-card" style="max-width: 720px;">
            <div class="section-label" style="display: flex; align-items: center; gap: 6px;">
              <ListChecks :size="15" /> Project checks
            </div>
            <p class="dim" style="font-size: 13px; margin: 0 0 10px;">
              Quality Gate and the build pipelines run these commands instead of asking an agent to guess. Add the real commands for this project; a passing placeholder is worse than a missing check.
            </p>
            <div v-if="quality" class="mono dim" style="font-size: 11.5px; margin-bottom: 8px;">{{ quality.path }}</div>
            <div v-if="qualityError" class="test-result err">
              <AlertCircle :size="15" />
              <div>{{ qualityError }}</div>
            </div>
            <div v-else-if="quality?.exists && quality.config && Object.keys(quality.config).length" class="test-result ok">
              <CheckCircle2 :size="15" />
              <div>Checks configured: {{ Object.keys(quality.config).join(", ") }}</div>
            </div>
            <div v-else class="test-result err">
              <AlertCircle :size="15" />
              <div>No checks configured yet. Quality Gate and full builds are blocked until you add at least one.</div>
            </div>
            <div v-if="quality?.error" class="test-result err" style="margin-top: 8px;">
              <AlertCircle :size="15" />
              <div>{{ quality.error }}</div>
            </div>

            <div v-for="field in QUALITY_FIELDS" :key="field.key" class="field" style="margin-top: 12px;">
              <label class="field-label" :for="`quality-${field.key}`">{{ field.label }} command</label>
              <input
                :id="`quality-${field.key}`"
                v-model="qualityDraft[field.key]"
                :placeholder="field.placeholder"
                spellcheck="false"
              />
              <div class="dim" style="font-size: 11.5px; margin-top: 3px;">Paste a command (quote paths with spaces) or keep the saved argument list. Backslashes are preserved.</div>
            </div>

            <div class="action-row">
              <button class="btn btn-primary" @click="handleSaveQuality"><Save :size="14" /> Save checks</button>
              <span v-if="qualitySaved" class="badge badge-green">Saved</span>
            </div>
          </div>
        </div>

        <div v-if="advancedTab === 'roster'" style="margin-top: 12px;">
          <ConfigView />
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.settings-tabs { display: flex; gap: 4px; padding: 3px; background: var(--panel-2); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); width: fit-content; margin-bottom: 14px; }

.profile-cols { display: grid; grid-template-columns: 240px 1fr; gap: 14px; }
.role-list { display: flex; flex-direction: column; gap: 4px; }
.role-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; background: var(--panel); border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm); cursor: pointer; color: var(--text);
  font-family: var(--sans); font-size: 13px; text-align: left;
}
.role-row:hover { background: var(--panel-2); }
.role-row.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.role-row .badge { margin-left: auto; font-size: 10.5px; }

.profile-detail { min-height: 400px; }
.provider-tabs { display: flex; gap: 4px; padding: 3px; background: var(--panel-2); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); width: fit-content; margin-bottom: 14px; }

.field { margin-bottom: 12px; }
.field-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--dim); margin-bottom: 4px; }
.field-row { display: flex; gap: 6px; align-items: center; }
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.check-row { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.action-row { display: flex; gap: 8px; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-soft); }

.test-result { display: flex; gap: 8px; padding: 10px 12px; border-radius: var(--radius-sm); margin-top: 12px; }
.test-result.ok { background: color-mix(in srgb, var(--green) 10%, transparent); border: 1px solid color-mix(in srgb, var(--green) 30%, transparent); }
.test-result.err { background: color-mix(in srgb, var(--red) 10%, transparent); border: 1px solid color-mix(in srgb, var(--red) 30%, transparent); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

@media (max-width: 768px) { .profile-cols { grid-template-columns: 1fr; } .field-grid { grid-template-columns: 1fr; } }
</style>

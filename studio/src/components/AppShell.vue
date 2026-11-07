<script setup lang="ts">
import {
  Compass, FolderGit2, GitBranch, Home,
  ListChecks, PauseCircle, PlayCircle, Settings as SettingsIcon,
  Wrench, Sun, Moon, HelpCircle, Sliders,
} from "lucide-vue-next";
import { ref } from "vue";
import { nav, go, type ScreenId } from "@/lib/nav";
import { theme, toggleTheme } from "@/lib/theme";
import type { TargetProject } from "@shared/types.ts";

const props = defineProps<{
  project: TargetProject | null;
}>();

const emit = defineEmits<{
  (e: "switch-project"): void;
  (e: "stamp-factory"): void;
  (e: "open-help"): void;
}>();

/** Five steps only in the sidebar. Sessions/History live in Results footers;
 * Settings/Help live in the top bar. One chain of command per screen. */
const GROUPS: { label: string; items: { id: ScreenId; label: string; icon: any; tour?: string }[] }[] = [
  {
    label: "Steps",
    items: [
      { id: "home", label: "Home", icon: Home, tour: "nav-home" },
      { id: "new-job", label: "New Job", icon: Compass, tour: "nav-new-job" },
      { id: "review-approve", label: "Review & Approve", icon: ListChecks, tour: "nav-review" },
      { id: "run", label: "Run", icon: PlayCircle, tour: "nav-run" },
      { id: "results", label: "Results", icon: PauseCircle, tour: "nav-results" },
    ],
  },
];

function isActive(id: ScreenId): boolean {
  return nav.value.screen === id;
}

/** Crew drawer: power tools behind one button. Main column stays 5 steps. */
const drawerOpen = ref(false);
function goDrawer(screen: ScreenId) {
  drawerOpen.value = false;
  go(screen);
}
</script>

<template>
  <div class="app-shell">
    <!-- TOP BAR -->
    <header class="app-topbar">
      <div class="topbar-left">
        <div class="brand-group">
          <svg class="brand-logo" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="6" width="17" height="5" rx="2.5" fill="var(--accent)" />
            <rect x="8" y="13.5" width="20" height="5" rx="2.5" fill="var(--sage)" />
            <rect x="4" y="21" width="13" height="5" rx="2.5" fill="var(--amber)" />
          </svg>
          <div class="brand-text">
            <span class="brand-name">C.R.E.W.</span>
            <span class="brand-tag">Software</span>
          </div>
        </div>

        <button
          v-if="project"
          class="project-pill"
          @click="emit('switch-project')"
          title="Switch target repository"
        >
          <FolderGit2 :size="14" />
          <span class="pill-name">{{ project.name }}</span>
          <span v-if="project.gitBranch" class="badge">
            <GitBranch :size="11" />
            {{ project.gitBranch }}
          </span>
          <span
            class="badge"
            :class="project.isStamped ? 'badge-green' : 'badge-amber'"
          >
            {{ project.isStamped ? "Stamped" : "Not stamped" }}
          </span>
        </button>

        <button
          v-if="project && !project.isStamped"
          class="btn btn-primary btn-xs"
          @click="emit('stamp-factory')"
        >
          <Wrench :size="13" />
          Stamp factory here
        </button>
      </div>

      <div class="topbar-right">
        <button
          class="tour-help-btn"
          data-tour="nav-setup"
          @click="go('settings')"
          title="Setup — one staircase: paste key, test, use for everything"
        >
          <SettingsIcon :size="14" />
          Setup
        </button>
        <button
          class="tour-help-btn"
          title="Crew controls — roster, runs, history"
          @click="drawerOpen = !drawerOpen"
        >
          <Sliders :size="14" />
          Controls
        </button>
        <button
          class="tour-help-btn"
          data-tour="help-btn"
          @click="emit('open-help')"
          title="Help — restart the tour"
        >
          <HelpCircle :size="14" />
          Help
        </button>
        <button
          class="tour-help-btn"
          @click="toggleTheme"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
        >
          <Sun v-if="theme === 'dark'" :size="14" />
          <Moon v-else :size="14" />
          {{ theme === "dark" ? "Light" : "Dark" }}
        </button>
      </div>
    </header>

    <!-- SIDEBAR -->
    <aside class="app-sidebar">
      <nav v-for="group in GROUPS" :key="group.label" class="sidebar-group" :aria-label="group.label">
        <div class="sidebar-group-label">{{ group.label }}</div>
        <button
          v-for="item in group.items"
          :key="item.id"
          class="sidebar-item"
          :class="{ active: isActive(item.id) }"
          :data-tour="item.tour"
          @click="go(item.id)"
        >
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <!-- MAIN -->
    <main class="app-main">
      <slot />
    </main>

    <!-- CREW DRAWER — everything power-related, behind one button -->
    <div v-if="drawerOpen" class="drawer-scrim" @click="drawerOpen = false" />
    <aside v-if="drawerOpen" class="crew-drawer" aria-label="Crew controls">
      <div class="drawer-head">
        <strong>Crew controls</strong>
        <button class="btn btn-ghost btn-xs" @click="drawerOpen = false">Close</button>
      </div>
      <p class="dim" style="font-size: 12.5px; margin: 0 0 10px;">
        The 5 steps never need this. Open only to tune, inspect, or audit.
      </p>
      <button class="drawer-item" @click="goDrawer('sessions')">Sessions — full trace of every run</button>
      <button class="drawer-item" @click="goDrawer('history')">History — approval audit log</button>
      <button class="drawer-item" @click="goDrawer('settings')">Settings — full panels (roster, caps, checks)</button>
      <button class="drawer-item" @click="goDrawer('help')">Help — tours, glossary, manuals</button>
    </aside>
  </div>
</template>

<style scoped>
.drawer-scrim {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); z-index: 60;
}
.crew-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: 300px; z-index: 61;
  background: var(--panel); border-left: 1px solid var(--border);
  padding: 16px; display: flex; flex-direction: column; gap: 8px;
}
.drawer-head { display: flex; align-items: center; justify-content: space-between; }
.drawer-item {
  text-align: left; padding: 10px 12px; font-size: 13px;
  background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius-sm);
  cursor: pointer; color: var(--text); font-family: var(--sans);
}
.drawer-item:hover { border-color: var(--accent); }
</style>

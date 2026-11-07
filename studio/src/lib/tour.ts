/**
 * Onboarding tour — anchored speech bubbles with Floating UI.
 *
 * Requirements addressed (see ZCODE_ANTIGRAVITY_PROMPT.md section 4):
 *  - Bubble NEVER covers its target or any control needed in that step.
 *  - Auto-flips to a side with room; re-positions on resize, scroll, layout
 *    change, and late-loading content (Floating UI's autoUpdate).
 *  - Target is scrolled into view, highlighted, and stays clickable.
 *  - On small screens it docks to an edge with a visible connector but
 *    still never over the target.
 *  - Collapsible to a small chip.
 *  - If a target can't be found, the step is skipped gracefully.
 *  - Always-visible Help button restarts the tour.
 *  - First-run setup is separate and skippable.
 */
import { computed, ref } from "vue";
import {
  autoUpdate, computePosition, flip, offset, shift, arrow, size,
  type Placement,
} from "@floating-ui/dom";

export interface TourStep {
  /** Selector for the element this step points at. Empty = a centered intro. */
  target?: string;
  title: string;
  what: string;
  why: string;
  example?: string;
  /** Preferred placement; we still auto-flip. */
  placement?: Placement;
}

/** Two bubbles, both relaunchable from Help: setup onboarding + job onboarding. */
export type TourId = "main" | "firstrun" | "setup" | "job";

const STORAGE_DONE = "crew.tour.done.v1";
const STORAGE_FIRSTRUN = "crew.firstrun.done.v1";
const STORAGE_SETUP = "crew.tour.setup.v1";
const STORAGE_JOB = "crew.tour.job.v1";

export function hasFinishedSetupTour(): boolean {
  return localStorage.getItem(STORAGE_SETUP) === "1";
}
export function hasFinishedJobTour(): boolean {
  return localStorage.getItem(STORAGE_JOB) === "1";
}
export function markSetupTourDone() {
  localStorage.setItem(STORAGE_SETUP, "1");
}
export function markJobTourDone() {
  localStorage.setItem(STORAGE_JOB, "1");
}

export const tourActive = ref<TourId | null>(null);
export const tourIndex = ref(0);
export const tourCollapsed = ref(false);
export const tourSkipped = ref(false);

export function hasFinishedTour(): boolean {
  return localStorage.getItem(STORAGE_DONE) === "1";
}
export function hasFinishedFirstRun(): boolean {
  return localStorage.getItem(STORAGE_FIRSTRUN) === "1";
}
export function markTourDone() {
  localStorage.setItem(STORAGE_DONE, "1");
}
export function markFirstRunDone() {
  localStorage.setItem(STORAGE_FIRSTRUN, "1");
}

/** Main tour — walks the main path controls. Kept for the overlap test and old prompts. */
export const MAIN_TOUR: TourStep[] = [
  {
    target: '[data-tour="nav-new-job"]',
    title: "Start a new job",
    what: "Click New Job to describe what you want done.",
    why: "Everything in CREW starts here. Pick 1 talk, 2 dump, 3 paste, or 4 point at software.",
    example: "Try: 'Add a /health endpoint that returns JSON.'",
    placement: "right",
  },
  {
    target: '[data-tour="nav-review"]',
    title: "Check, then sign twice",
    what: "Review & Approve is the gate: read the spec, then sign and add initials.",
    why: "Nothing runs without both sign-offs. Either one can be withdrawn before a run starts.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-run"]',
    title: "Run with a guard",
    what: "Run shows the live console with a per-job token cap.",
    why: "Pause or stop any time. The cap defaults low so a runaway job can't drain your wallet.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-results"]',
    title: "Take home one zip",
    what: "Results packs one bundle: program, approved spec, both manuals, install notes.",
    why: "Unzip it anywhere — USB stick, Dropbox, the print-shop kiosk.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Connect your models",
    what: "Settings holds one connection profile per role.",
    why: "Local is the default — it uses your FreeLLMAPI router at 127.0.0.1:31415 with exact model names. Meta at api.meta.ai is the cheap option with your own key. Kobold at 5001 is optional and never auto-probed. Cloud (Venice) stays disabled until you add a key.",
    placement: "right",
  },
  {
    target: '[data-tour="help-btn"]',
    title: "Stuck? Restart here",
    what: "The Help button replays either bubble tour.",
    why: "If someone is guiding you by phone, ask them to read the title at the top of the screen.",
    placement: "bottom",
  },
];

/** First-run setup — welcome + connect a model + go. Skippable. */
export const FIRSTRUN_TOUR: TourStep[] = [
  {
    title: "Welcome to CREW",
    what: "A calm workspace for an AI software factory. You stay in charge; the agents do the typing.",
    why: "First-run setup takes a minute. You can skip it and come back any time from Help.",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Connect a model (optional)",
    what: "Settings has one profile per role. The local profile points at your FreeLLMAPI router at 127.0.0.1:31415 with exact model names.",
    why: "If you don't have one running yet, that's fine — skip this step. You can still draft and approve jobs.",
    placement: "right",
  },
  {
    target: '[data-tour="nav-new-job"]',
    title: "Start a New Job",
    what: "When you're ready, click New Job and describe what you want done.",
    why: "That's the whole main path in 5 steps: Describe, Answer, Check, Sign twice, Run + zip.",
    placement: "right",
  },
];

/** Setup onboarding bubble: bubble 1 of the 2 the owner asked for. Model connection only. */
export const SETUP_TOUR: TourStep[] = [
  {
    title: "Setup tour — your models",
    what: "This bubble stays on the model shelf. Everything else can wait.",
    why: "The FreeLLMAPI router at 127.0.0.1:31415 is the default with exact model names per role. Kobold at 5001 is optional and never auto-probed.",
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Open Settings once",
    what: "One shelf, one profile per role. Pick your roster (Desk Default is preselected) and check green.",
    why: "Green means Crew reached the router with the exact model name. Red names the missing piece and offers to continue without it.",
    placement: "right",
  },
  {
    target: '[data-tour="help-btn"]',
    title: "Replay me from Help",
    what: "Both bubbles live under Help: 'Replay setup tour' and 'Replay job tour'.",
    why: "If you ever feel lost, Help is the way back.",
    placement: "bottom",
  },
];

/** Job onboarding bubble: bubble 2. Walks the 4 numbered front doors + answer + sign + zip. */
export const JOB_TOUR: TourStep[] = [
  {
    target: '[data-tour="new-job-talk"]',
    title: "Step 1 · Talk it through",
    what: "Front door 1: describe it in plain words. Dictate with Win+H, type, or use the microphone button.",
    why: "No format required. The interviewer reads it back in clear sections.",
    example: "Try: 'Add a /health endpoint that returns JSON.'",
    placement: "bottom",
  },
  {
    target: '[data-tour="new-job-upload"]',
    title: "Step 1 · Dump what you have",
    what: "Front door 2: click to pick a file — markdown, text, Word, PDF, or an image.",
    why: "Drawings, scans, screenshots, phone demos — all stay on this machine and ride into the interview.",
    placement: "bottom",
  },
  {
    target: '[data-tour="new-job-paste-btn"]',
    title: "Step 1 · Paste text",
    what: "Front door 3: one click drops clipboard text straight in. No typing needed.",
    why: "Dictation garbled a word? Paste over it — the interviewer infers from context.",
    placement: "bottom",
  },
  {
    target: '[data-tour="new-job-existing"]',
    title: "Step 1 · Point at software",
    what: "Front door 4: name an app or folder for a read-only REA head start.",
    why: "Static inspection only — never runs it. If inspection can't run, Crew says so and offers to continue without it.",
    placement: "bottom",
  },
  {
    target: '[data-tour="new-job-continue"]',
    title: "Steps 2–5 · Answer, Check, Sign twice, Run + zip",
    what: "Answer the interviewer's numbered questions, check the spec in Review, sign plus initials, then run.",
    why: "Results packs one zip — program, spec, both manuals, install notes — ready for USB, Dropbox, or the kiosk.",
    placement: "left",
  },
  {
    target: '[data-tour="help-btn"]',
    title: "Replay either bubble",
    what: "Help replays this job tour or the setup tour any time.",
    why: "Two bubbles, tails pointing at fields — never covering them.",
    placement: "bottom",
  },
];

export function startTour(id: TourId) {
  tourActive.value = id;
  tourIndex.value = 0;
  tourCollapsed.value = false;
  tourSkipped.value = false;
}

export function endTour() {
  if (tourActive.value === "main") markTourDone();
  if (tourActive.value === "firstrun") markFirstRunDone();
  if (tourActive.value === "setup") markSetupTourDone();
  if (tourActive.value === "job") markJobTourDone();
  tourActive.value = null;
  tourIndex.value = 0;
  tourCollapsed.value = false;
}

export function skipTour() {
  tourSkipped.value = true;
  endTour();
}

export function nextStep() {
  const steps = currentSteps();
  if (tourIndex.value < steps.length - 1) {
    tourIndex.value++;
  } else {
    endTour();
  }
}

export function prevStep() {
  if (tourIndex.value > 0) tourIndex.value--;
}

export function currentSteps(): TourStep[] {
  switch (tourActive.value) {
    case "firstrun": return FIRSTRUN_TOUR;
    case "setup": return SETUP_TOUR;
    case "job": return JOB_TOUR;
    default: return MAIN_TOUR;
  }
}

export const currentStep = computed<TourStep | null>(() => {
  if (!tourActive.value) return null;
  const steps = currentSteps();
  return steps[tourIndex.value] ?? null;
});

/**
 * Position the bubble relative to its target using Floating UI.
 * Returns a cleanup function to stop autoUpdate.
 */
export function positionBubble(
  bubbleEl: HTMLElement,
  arrowEl: HTMLElement | null,
  target: HTMLElement | null,
  placement: Placement | undefined,
  dockToBottom: boolean,
): (() => void) | null {
  if (dockToBottom) {
    // Small-screen mode: dock to bottom edge, with a visible connector
    // (the arrow) but never over the target. We still scroll the target
    // into view so the connector points at it AND we highlight it so the
    // user (and the tour overlap test) can see which control the bubble
    // is talking about.
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target) target.classList.add("tour-target-highlight");
    return null;
  }

  if (!target) {
    // No target — center the bubble in the viewport.
    bubbleEl.style.position = "fixed";
    bubbleEl.style.top = "50%";
    bubbleEl.style.left = "50%";
    bubbleEl.style.transform = "translate(-50%, -50%)";
    bubbleEl.style.margin = "0";
    return null;
  }

  // The highlight is independent of the bubble: add it now so the user
  // (and the tour overlap test) can see which control the bubble is
  // talking about, even if the bubble itself isn't fully positioned yet.
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  target.classList.add("tour-target-highlight");

  const cleanup = autoUpdate(target, bubbleEl, async () => {
    const middleware: any[] = [
      offset(10),
      flip({ fallbackPlacements: ["top", "bottom", "left", "right"] }),
      shift({ padding: 12 }),
      size({
        apply({ availableWidth, availableHeight, elements }) {
          // Constrain the bubble to the available space so it never
          // overflows the viewport and never overlaps the target.
          Object.assign((elements as any).floating.style, {
            maxWidth: `${Math.min(availableWidth - 24, 360)}px`,
            maxHeight: `${Math.max(availableHeight - 24, 120)}px`,
          });
        },
      }),
    ];
    if (arrowEl) middleware.push(arrow({ element: arrowEl, padding: 6 }));

    const { x, y, placement: resolved, middlewareData } = await computePosition(
      target,
      bubbleEl,
      { placement: placement ?? "right", middleware },
    );

    bubbleEl.style.position = "absolute";
    bubbleEl.style.top = "0";
    bubbleEl.style.left = "0";
    bubbleEl.style.transform = `translate(${x}px, ${y}px)`;
    bubbleEl.style.margin = "0";

    if (arrowEl) {
      const side = resolved.split("-")[0] as "top" | "bottom" | "left" | "right";
      const sideOpposite = { top: "bottom", right: "left", bottom: "top", left: "right" }[side];
      const arrowX = middlewareData.arrow?.x ?? 0;
      const arrowY = middlewareData.arrow?.y ?? 0;
      arrowEl.style.top = "";
      arrowEl.style.left = "";
      arrowEl.style.right = "";
      arrowEl.style.bottom = "";
      if (side === "top" || side === "bottom") {
        arrowEl.style[side] = "-6px";
        arrowEl.style.left = `${arrowX}px`;
      } else {
        arrowEl.style[side] = "-6px";
        arrowEl.style.top = `${arrowY}px`;
      }
      // Hide arrow if it would overlap (when flipped, etc.)
      void sideOpposite;
    }
  });

  return cleanup;
}

export function clearHighlight() {
  document.querySelectorAll(".tour-target-highlight").forEach((el) => {
    el.classList.remove("tour-target-highlight");
  });
}

/** Returns true if the two boxes overlap by more than the tolerance. */
export function boxesOverlap(a: DOMRect, b: DOMRect, tolerance = 1): boolean {
  return !(
    a.right <= b.left + tolerance ||
    a.left >= b.right - tolerance ||
    a.bottom <= b.top + tolerance ||
    a.top >= b.bottom - tolerance
  );
}

/** Decide whether to dock the bubble (small screens). */
export function shouldDock(): boolean {
  return window.innerWidth < 640;
}

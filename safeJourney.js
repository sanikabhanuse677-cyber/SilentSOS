// ============================================================
// SilentSOS — js/safeJourney.js  (Guardian Journey Mode)
//
// Fixes applied (no Firebase changes — Firebase integration
// is a separate phase):
//   · #helpBtn now triggers SOS via autoSOS localStorage flag
//   · #endBtn now shows the completion modal
//   · Countdown uses HH:MM:SS when duration ≥ 1 hour
//   · Completion popup replaced with proper dark-theme modal
//   · "I'm Safe" uses toast instead of browser alert()
//   · Extend journey offers 15 / 30 / 60 min choice
//   · "Custom" duration shows a custom minutes input
//   · Live clock updates every second alongside countdown
//
// New in this pass (still frontend-only — no Firebase writes):
//   · Journey state is mirrored into localStorage so the
//     Dashboard page can show "Current Active Journey" and
//     dynamic status without needing the journeys/ collection
//     yet. Keys used: ss_journeyState, ss_activity.
//   · Dynamic status banner: 🟢 Monitoring / 🟡 Awaiting
//     User Response / 🔴 Emergency Triggered / ⚪ Completed
// ============================================================

// ── State ────────────────────────────────────────────────────
let countdownInterval    = null;
let totalSecsRemaining   = 0;
let journeyStartingSeconds = 0; // used for warning colour thresholds
let journeyDestination   = "";
let journeyTravelMode    = "";
let journeyStartTimeIso  = null;

// ── DOM refs ─────────────────────────────────────────────────
const journeyForm      = document.getElementById("journeyForm");
const journeyDashboard = document.getElementById("journeyDashboard");
const completionModal  = document.getElementById("completionModal");
const extendModal      = document.getElementById("extendModal");
const countdownEl      = document.getElementById("countdown");
const startTimeEl      = document.getElementById("journeyStartTime");
const currentTimeEl    = document.getElementById("currentTime");
const durationSelect   = document.getElementById("duration");
const customGroup      = document.getElementById("customDurationGroup");
const statusDotEl      = document.getElementById("statusDot");
const journeyStatusEl  = document.getElementById("journeyStatus");

// ── Frontend-only persistence (localStorage) ──────────────────
// NOTE: This is purely local UI state so the Dashboard can reflect
// "Current Active Journey" today. Real persistence to the
// `journeys` collection in Firebase is a separate, later phase.

const JOURNEY_STATE_KEY = "ss_journeyState";
const ACTIVITY_LOG_KEY  = "ss_activity";
const MAX_ACTIVITY_ITEMS = 8;

function saveJourneyState(status) {
  const state = {
    destination:  journeyDestination,
    travelMode:   journeyTravelMode,
    startTime:    journeyStartTimeIso,
    secondsLeft:  totalSecsRemaining,
    status,                       // "monitoring" | "awaiting" | "emergency" | "completed"
    updatedAt:    new Date().toISOString()
  };
  localStorage.setItem(JOURNEY_STATE_KEY, JSON.stringify(state));
}

function clearJourneyState() {
  localStorage.removeItem(JOURNEY_STATE_KEY);
}

function logActivity(icon, text) {
  let log = [];
  try {
    log = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || "[]");
  } catch { log = []; }
  log.unshift({ icon, text, time: new Date().toISOString() });
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(log.slice(0, MAX_ACTIVITY_ITEMS)));
}

// ── Status banner (Phase 4 — dynamic journey status) ──────────
const STATUS_MAP = {
  monitoring: { icon: "🟢", label: "Monitoring Active",        dotClass: "" },
  awaiting:   { icon: "🟡", label: "Awaiting User Response",   dotClass: "" },
  emergency:  { icon: "🔴", label: "Emergency Triggered",      dotClass: "emergency" },
  completed:  { icon: "⚪", label: "Journey Completed",        dotClass: "" }
};

function setJourneyStatus(status) {
  const info = STATUS_MAP[status] || STATUS_MAP.monitoring;
  if (journeyStatusEl) journeyStatusEl.textContent = `${info.icon} ${info.label}`;
  if (statusDotEl) {
    statusDotEl.classList.remove("emergency");
    if (info.dotClass) statusDotEl.classList.add(info.dotClass);
  }
  saveJourneyState(status);
}

// ── Utility ──────────────────────────────────────────────────

/** Show a non-blocking toast message (no browser alert). */
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

/**
 * Format seconds into HH:MM:SS (when ≥ 1 hour) or MM:SS.
 * Phase 3 requirement: HH:MM:SS for longer journeys.
 */
function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0
    ? `${String(h).padStart(2, "0")}:${mm}:${ss}`
    : `${mm}:${ss}`;
}

/** Map a duration select option to total seconds. */
function durationToSeconds(value) {
  const map = {
    "15 Minutes":  15 * 60,
    "30 Minutes":  30 * 60,
    "45 Minutes":  45 * 60,
    "1 Hour":      60 * 60,
    "2 Hours":    120 * 60,
  };
  return map[value] ?? 30 * 60;
}

/** Return current time as HH:MM string. */
function nowString() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Clock ─────────────────────────────────────────────────────
// Updated every second inside the countdown interval tick.
function updateClock() {
  if (currentTimeEl) currentTimeEl.textContent = nowString();
}

// ── Countdown ────────────────────────────────────────────────

/**
 * Start (or restart) the countdown from the given number of seconds.
 * Clears any existing interval first to avoid stacking.
 */
function startCountdown(seconds) {
  clearInterval(countdownInterval);

  totalSecsRemaining     = seconds;
  journeyStartingSeconds = seconds;
  renderCountdown();

  countdownInterval = setInterval(() => {
    totalSecsRemaining--;
    updateClock();
    renderCountdown();

    if (totalSecsRemaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      if (countdownEl) {
        countdownEl.textContent = "00:00";
        countdownEl.className   = "";
      }
      setJourneyStatus("awaiting");
      showCompletionModal();
    }
  }, 1000);
}

/** Update the countdown display text and warning colours. */
function renderCountdown() {
  if (!countdownEl) return;
  countdownEl.textContent = formatDuration(totalSecsRemaining);

  // Colour transitions: green → yellow (≤5 min) → red + pulse (≤1 min)
  countdownEl.classList.remove("warning", "critical");
  if      (totalSecsRemaining <= 60)  countdownEl.classList.add("critical");
  else if (totalSecsRemaining <= 300) countdownEl.classList.add("warning");
}

// ── Modals ───────────────────────────────────────────────────

function showCompletionModal() {
  if (completionModal) completionModal.style.display = "flex";
}
function hideCompletionModal() {
  if (completionModal) completionModal.style.display = "none";
}
function showExtendModal() {
  hideCompletionModal();
  if (extendModal) extendModal.style.display = "flex";
}
function hideExtendModal() {
  if (extendModal) extendModal.style.display = "none";
}

// ── Form: duration select — show/hide custom input ───────────
durationSelect.addEventListener("change", function () {
  if (customGroup) {
    customGroup.style.display = this.value === "Custom" ? "block" : "none";
  }
});

// ── Form submit — start journey ───────────────────────────────
journeyForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const destination = document.getElementById("destination").value.trim();
  const travelMode  = document.getElementById("travelMode").value;
  const durValue    = durationSelect.value;
  const description = (document.getElementById("description")?.value || "").trim();

  // Resolve total seconds (handle Custom option)
  let seconds;
  if (durValue === "Custom") {
    const customMinEl = document.getElementById("customMinutes");
    const customMin   = parseInt(customMinEl?.value || "30", 10);
    seconds = (!isNaN(customMin) && customMin >= 1) ? customMin * 60 : 30 * 60;
  } else {
    seconds = durationToSeconds(durValue);
  }

  // Populate journey dashboard info
  if (document.getElementById("displayDestination"))
    document.getElementById("displayDestination").textContent = destination || "—";
  if (document.getElementById("displayMode"))
    document.getElementById("displayMode").textContent = travelMode || "—";

  // Set start time and initialise live clock
  if (startTimeEl) startTimeEl.textContent = nowString();
  updateClock();

  // Track state for persistence (localStorage only — no Firebase)
  journeyDestination  = destination;
  journeyTravelMode   = travelMode;
  journeyStartTimeIso = new Date().toISOString();

  // Transition: hide form, reveal dashboard
  journeyForm.style.display      = "none";
  journeyDashboard.style.display = "block";

  // Kick off countdown
  startCountdown(seconds);
  setJourneyStatus("monitoring");
  logActivity("🛡", `Journey started to "${destination || "destination"}" (${travelMode || "—"})`);
  showToast("🛡 Starting Protected Journey…");
});

// ── In-journey: Need Help button ─────────────────────────────
// Sets the autoSOS flag so index.html triggers SOS on load.
document.getElementById("helpBtn").addEventListener("click", () => {
  clearInterval(countdownInterval);
  countdownInterval = null;

  setJourneyStatus("emergency");
  logActivity("🚨", `Need Help pressed during journey to "${journeyDestination || "destination"}"`);
  showToast("🚨 Activating Emergency SOS…");

  // Signal the home page to auto-trigger SOS
  localStorage.setItem("autoSOS", "true");
  window.location.href = "index.html";
});

// ── In-journey: End Journey button ───────────────────────────
// Stops timer and shows the completion modal immediately.
document.getElementById("endBtn").addEventListener("click", () => {
  clearInterval(countdownInterval);
  countdownInterval = null;
  setJourneyStatus("awaiting");
  showCompletionModal();
});

// ── Completion modal: I'm Safe ────────────────────────────────
document.getElementById("safeBtn").addEventListener("click", () => {
  hideCompletionModal();
  setJourneyStatus("completed");
  logActivity("✅", `Journey to "${journeyDestination || "destination"}" completed safely`);
  showToast("Great! Journey completed safely 🛡");
  // Clear the active-journey state (journey is over) but keep the
  // activity log entry above for the Dashboard/history to reference.
  clearJourneyState();
  // Brief delay so the user sees the toast before page resets
  setTimeout(() => location.reload(), 1400);
});

// ── Completion modal: Need Help ───────────────────────────────
document.getElementById("helpBtnPopup").addEventListener("click", () => {
  hideCompletionModal();
  setJourneyStatus("emergency");
  logActivity("🚨", `Need Help pressed after journey to "${journeyDestination || "destination"}" timed out`);
  showToast("🚨 Activating Emergency SOS…");
  localStorage.setItem("autoSOS", "true");
  window.location.href = "index.html";
});

// ── Completion modal: Extend Journey ─────────────────────────
document.getElementById("extendBtn").addEventListener("click", () => {
  showExtendModal();
});

// ── Extend modal: time options (15 / 30 / 60 min) ────────────
document.querySelectorAll(".extend-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    const minutes = parseInt(btn.dataset.minutes, 10);
    if (isNaN(minutes) || minutes <= 0) return;

    hideExtendModal();
    startCountdown(minutes * 60);
    setJourneyStatus("monitoring");
    logActivity("⏰", `Journey extended by ${minutes} minutes`);
    showToast(`Journey extended by ${minutes} minutes ⏰`);
  });
});

// ── Extend modal: Cancel — go back to completion modal ────────
document.getElementById("cancelExtend").addEventListener("click", () => {
  hideExtendModal();
  showCompletionModal();
});
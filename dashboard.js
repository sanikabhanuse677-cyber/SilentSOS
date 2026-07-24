// ============================================================
// SilentSOS — js/dashboard.js  (Responder dashboard)
// Phase 9: replaced global window.doUpdate + inline onclick
//          with event delegation on the alerts list container.
//          All Firebase code is unchanged.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Firebase config (DO NOT MODIFY) ─────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD_bfjw-Vb7iR3Qsbxc2dpSfbei85stvWA",
  authDomain: "silentsos-hackathon.firebaseapp.com",
  databaseURL: "https://silentsos-hackathon-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "silentsos-hackathon",
  storageBucket: "silentsos-hackathon.firebasestorage.app",
  messagingSenderId: "593930441942",
  appId: "1:593930441942:web:63615da20dc0493e3ce577",
  measurementId: "G-C4QZNZYMZK"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
console.log("[Dashboard] Firebase initialised");

// ── DOM refs ─────────────────────────────────────────────────
const alertsList     = document.getElementById("alerts-list");
const liveCount      = document.getElementById("live-count");
const emergencyCard  = document.getElementById("emergencyStatusCard");
const emergencyValue = document.getElementById("emergencyStatusValue");
const emergencySub   = document.getElementById("emergencyStatusSub");
const journeyCard    = document.getElementById("journeyStatusCard");
const journeyValue   = document.getElementById("journeyStatusValue");
const journeySub     = document.getElementById("journeyStatusSub");
const activityFeed   = document.getElementById("activityFeed");
const resetBtn       = document.getElementById("resetDashboardBtn");
const resetModal     = document.getElementById("resetModal");

// ── Local (frontend-only) journey/activity state ──────────────
// These keys are written by safeJourney.js. Reading them here is
// read-only — this file never writes journey state, only clears
// it on an explicit Reset Dashboard confirmation. No Firebase
// data is touched by any of this.
const JOURNEY_STATE_KEY = "ss_journeyState";
const ACTIVITY_LOG_KEY  = "ss_activity";

const JOURNEY_STATUS_LABEL = {
  monitoring: "🟢 Monitoring",
  awaiting:   "🟡 Awaiting Response",
  emergency:  "🔴 Emergency Triggered",
  completed:  "⚪ Completed"
};

function readJourneyState() {
  try {
    return JSON.parse(localStorage.getItem(JOURNEY_STATE_KEY) || "null");
  } catch { return null; }
}

function readActivityLog() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || "[]");
  } catch { return []; }
}

function relativeTime(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Render: Journey status card ───────────────────────────────
function renderJourneyCard() {
  const state = readJourneyState();
  journeyCard.classList.remove("is-idle", "is-journey", "is-emergency");

  if (!state) {
    journeyCard.classList.add("is-idle");
    journeyValue.textContent = "🛡 No Active Journey";
    journeySub.textContent   = "Start one from Safe Journey";
    return;
  }

  journeyCard.classList.add(state.status === "emergency" ? "is-emergency" : "is-journey");
  journeyValue.textContent = JOURNEY_STATUS_LABEL[state.status] || state.status;
  journeySub.textContent   = state.destination
    ? `To "${state.destination}" · started ${relativeTime(state.startTime)}`
    : "Journey in progress";
}

// ── Render: Recent activity feed ──────────────────────────────
function renderActivityFeed() {
  const log = readActivityLog();
  if (!log.length) {
    activityFeed.innerHTML = `
      <div class="empty">
        <span class="empty-icon">🕐</span>
        <div class="empty-title">No recent activity</div>
        <div class="empty-desc">SOS alerts and journey events will show up here.</div>
      </div>`;
    return;
  }
  activityFeed.innerHTML = log.map(item => `
    <div class="activity-item fade-in">
      <span class="activity-icon">${item.icon || "•"}</span>
      <div>
        <div class="activity-text">${item.text}</div>
        <div class="activity-time">${relativeTime(item.time)}</div>
      </div>
    </div>
  `).join("");
}

// ── Reset Dashboard ─────────────────────────────────────────────
// Frontend-only: clears the locally-tracked journey state and
// activity log. Firebase alert data is never touched here.
function openResetModal()  { resetModal.style.display = "flex"; }
function closeResetModal() { resetModal.style.display = "none"; }

resetBtn.addEventListener("click", openResetModal);
document.getElementById("cancelResetBtn").addEventListener("click", closeResetModal);
document.getElementById("confirmResetBtn").addEventListener("click", () => {
  localStorage.removeItem(JOURNEY_STATE_KEY);
  localStorage.removeItem(ACTIVITY_LOG_KEY);
  renderJourneyCard();
  renderActivityFeed();
  closeResetModal();
  showToast("Dashboard reset ✓");
});

// ── Utility ──────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function badgeHtml(status) {
  const map = {
    active:       ["badge-active",       "Active"],
    acknowledged: ["badge-acknowledged", "Acknowledged"],
    dispatched:   ["badge-dispatched",   "Dispatched"],
    resolved:     ["badge-resolved",     "Resolved"]
  };
  const [cls, label] = map[status] || ["", status];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ── Firebase: update alert status ────────────────────────────

async function updateStatus(alertId, newStatus) {
  console.log("[Dashboard] Updating", alertId, "→", newStatus);
  try {
    await update(ref(db, `alerts/${alertId}`), { status: newStatus });
    showToast(`Alert marked: ${newStatus}`);
  } catch (err) {
    console.error("[Dashboard] Update failed:", err);
    showToast("Update failed — check Firebase config");
  }
}

// ── Build alert card HTML ────────────────────────────────────
// Uses data attributes instead of inline onclick for clean
// event delegation (no window global needed).

function buildCard(alertId, data) {
  const testBadge = data.test
    ? `<span class="status-badge badge-test">TEST</span>`
    : "";
  const mapUrl   = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;
  const embedUrl = `https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=15&output=embed`;

  // Action button advances through status pipeline
  const actionButtons = {
    active:       `<button class="btn btn-secondary btn-sm" data-action="update" data-alert-id="${alertId}" data-new-status="acknowledged">Acknowledge</button>`,
    acknowledged: `<button class="btn btn-secondary btn-sm" data-action="update" data-alert-id="${alertId}" data-new-status="dispatched">Dispatch Help</button>`,
    dispatched:   `<button class="btn btn-primary   btn-sm" data-action="update" data-alert-id="${alertId}" data-new-status="resolved">Mark Resolved</button>`,
    resolved:     ``
  };

  return `
<div class="card alert-card fade-in" id="card-${alertId}" data-status="${data.status}">
  <div class="alert-header">
    <div>
      <div class="alert-id">${alertId}</div>
    </div>
    <div class="badge-row">
      ${testBadge}
      ${badgeHtml(data.status)}
    </div>
  </div>

  <div class="alert-meta">
    <div>📍 <strong>${Number(data.latitude).toFixed(5)}, ${Number(data.longitude).toFixed(5)}</strong></div>
    <div>🕐 <strong>${formatTime(data.timestamp)}</strong></div>
  </div>

  <iframe
    src="${embedUrl}"
    style="width:100%;height:180px;border:none;border-radius:8px;margin-bottom:.75rem;"
    allowfullscreen
    loading="lazy"
    title="Alert location map"
  ></iframe>

  <div class="alert-actions">
    <a class="btn btn-ghost btn-sm" href="${mapUrl}" target="_blank" rel="noopener">🗺 Open Map</a>
    ${actionButtons[data.status] || ""}
  </div>
</div>`;
}

// ── Event delegation — handles all status-update clicks ──────
// Replaces the old window.doUpdate global + inline onclick approach.
alertsList.addEventListener("click", e => {
  const btn = e.target.closest("[data-action='update']");
  if (!btn) return;
  const { alertId, newStatus } = btn.dataset;
  if (alertId && newStatus) updateStatus(alertId, newStatus);
});

// ── Render: Emergency status card ─────────────────────────────
function renderEmergencyCard(sortedAlerts) {
  emergencyCard.classList.remove("is-idle", "is-emergency");

  const unresolved = sortedAlerts.filter(([, d]) => d.status !== "resolved");
  if (unresolved.length === 0) {
    emergencyCard.classList.add("is-idle");
    emergencyValue.textContent = "🟢 No Active Emergency";
    emergencySub.textContent   = "All clear — no unresolved alerts";
    return;
  }

  emergencyCard.classList.add("is-emergency");
  const [, latest] = unresolved[0];
  const statusLabel = {
    active: "🔴 Active — awaiting response",
    acknowledged: "🟠 Acknowledged",
    dispatched: "🚓 Help dispatched"
  }[latest.status] || latest.status;
  emergencyValue.textContent = statusLabel;
  emergencySub.textContent   = `${unresolved.length} unresolved alert${unresolved.length > 1 ? "s" : ""}`;
}

// ── Firebase: listen to all alerts (live) ────────────────────
onValue(ref(db, "alerts"), snapshot => {
  const all = snapshot.val();
  console.log("[Dashboard] Alerts snapshot received");

  if (!all) {
    alertsList.innerHTML = `
      <div class="empty">
        <span class="empty-icon">📡</span>
        <div class="empty-title">No alerts yet</div>
        <div class="empty-desc">Trigger an SOS from the Home page to see it appear here.</div>
      </div>`;
    if (liveCount) liveCount.textContent = "0 active";
    renderEmergencyCard([]);
    return;
  }

  // Sort newest first
  const sorted = Object.entries(all).sort((a, b) => {
    const ta = new Date(a[1].timestamp || 0).getTime();
    const tb = new Date(b[1].timestamp || 0).getTime();
    return tb - ta;
  });

  const activeCount = sorted.filter(([, d]) => d.status === "active").length;
  if (liveCount) liveCount.textContent = `${activeCount} active`;

  alertsList.innerHTML = sorted
    .map(([id, data]) => buildCard(id, data))
    .join("");

  renderEmergencyCard(sorted);
});

// ── Initial render of local (non-Firebase) dashboard state ────
renderJourneyCard();
renderActivityFeed();

// Keep the journey card fresh if another tab/page updates it
window.addEventListener("storage", e => {
  if (e.key === JOURNEY_STATE_KEY) renderJourneyCard();
  if (e.key === ACTIVITY_LOG_KEY)  renderActivityFeed();
});

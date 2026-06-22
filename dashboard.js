// ============================================================
// SilentSOS — dashboard.js
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Firebase config ─────────────────────────────────────────
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

// ── DOM ──────────────────────────────────────────────────────
const alertsList = document.getElementById("alerts-list");
const liveCount  = document.getElementById("live-count");

// ── Utilities ────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
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

// ── Update alert status ──────────────────────────────────────
async function updateStatus(alertId, newStatus) {
  console.log("[Dashboard] Updating", alertId, "→", newStatus);
  try {
    await update(ref(db, `alerts/${alertId}`), { status: newStatus });
    showToast(`Alert ${newStatus}`);
  } catch (err) {
    console.error("[Dashboard] Update failed:", err);
    showToast("Update failed — check Firebase config");
  }
}

// ── Build alert card HTML ────────────────────────────────────
function buildCard(alertId, data) {
  const testBadge = data.test ? `<span class="status-badge badge-test">TEST</span>` : "";
  const mapUrl    = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;
  const embedUrl  = `https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=15&output=embed`;

  const buttons = {
    active:       `<button class="btn btn-secondary" onclick="doUpdate('${alertId}','acknowledged')">Acknowledge</button>`,
    acknowledged: `<button class="btn btn-secondary" onclick="doUpdate('${alertId}','dispatched')">Dispatch</button>`,
    dispatched:   `<button class="btn btn-primary"   onclick="doUpdate('${alertId}','resolved')">Resolve</button>`,
    resolved:     ``
  };

  return `
<div class="card alert-card fade-in" id="card-${alertId}" data-status="${data.status}">
  <div class="alert-header">
    <div>
      <div class="alert-id">${alertId}</div>
    </div>
    <div style="display:flex;gap:.35rem;align-items:center;flex-wrap:wrap">
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
    style="width:100%;height:180px;border:none;border-radius:8px;margin-bottom:.75rem"
    allowfullscreen loading="lazy"
  ></iframe>
  <div class="alert-actions">
    <a class="btn btn-ghost" href="${mapUrl}" target="_blank">🗺 Open Map</a>
    ${buttons[data.status] || ""}
  </div>
</div>`;
}

// ── Global for inline onclick ────────────────────────────────
window.doUpdate = updateStatus;

// ── Listen to all alerts ─────────────────────────────────────
onValue(ref(db, "alerts"), snapshot => {
  const all = snapshot.val();
  console.log("[Dashboard] Alerts snapshot received");

  if (!all) {
    alertsList.innerHTML = `<div class="empty">No alerts yet. Trigger an SOS to see it here.</div>`;
    if (liveCount) liveCount.textContent = "0 active";
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
});
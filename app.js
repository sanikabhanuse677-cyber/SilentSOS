// ============================================================
// SilentSOS — app.js  (index.html logic)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Firebase config ─────────────────────────────────────────
// 🔧 Replace these values with your own Firebase project config
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
console.log("[SilentSOS] Firebase initialised");

// ── State ────────────────────────────────────────────────────
let currentAlertId   = null;
let locationWatcher  = null;
let locationInterval = null;

// ── DOM refs ─────────────────────────────────────────────────
const sosBtn       = document.getElementById("sos-btn");
const testBtn      = document.getElementById("test-btn");
const statusBar    = document.getElementById("status-bar");
const actionRow    = document.getElementById("action-row");
const smsBtn       = document.getElementById("sms-btn");
const shareBtn     = document.getElementById("share-btn");
const mapSection   = document.getElementById("map-section");
const mapFrame     = document.getElementById("map-frame");

// ── Utility ──────────────────────────────────────────────────
function setStatus(msg, cls = "") {
  statusBar.textContent = msg;
  statusBar.className   = cls;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function buildMessage(lat, lng, alertId) {
  return `🚨 EMERGENCY SOS 🚨\nI need help immediately.\n📍 Location: https://maps.google.com/?q=${lat},${lng}\n🆔 Alert ID: ${alertId}\nPlease respond ASAP.`;
}

function showMap(lat, lng) {
  mapFrame.src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  mapSection.classList.add("visible");
}

// ── Get GPS ──────────────────────────────────────────────────
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ── Save alert to Firebase ───────────────────────────────────
async function saveAlert(lat, lng, isTest) {
  const alertId   = `alert_${Date.now()}`;
  const alertData = {
    latitude:  lat,
    longitude: lng,
    status:    "active",
    timestamp: new Date().toISOString(),
    test:      isTest
  };
  console.log("[SilentSOS] Saving alert:", alertId, alertData);
  await set(ref(db, `alerts/${alertId}`), alertData);
  return alertId;
}

// ── Start live location updates ──────────────────────────────
function startLocationUpdates(alertId) {
  console.log("[SilentSOS] Starting location updates for", alertId);
  locationInterval = setInterval(async () => {
    try {
      const { lat, lng } = await getLocation();
      await update(ref(db, `alerts/${alertId}`), { latitude: lat, longitude: lng });
      console.log("[SilentSOS] Location updated:", lat, lng);
    } catch (e) {
      console.warn("[SilentSOS] Location update failed:", e.message);
    }
  }, 5000);
}

// ── Listen to alert status ───────────────────────────────────
function listenToAlert(alertId) {
  console.log("[SilentSOS] Listening to alert:", alertId);
  const alertRef = ref(db, `alerts/${alertId}`);
  onValue(alertRef, snapshot => {
    const data = snapshot.val();
    if (!data) return;
    console.log("[SilentSOS] Alert update:", data);

    const statusMap = {
      active:       { msg: "🔴 Waiting for help…",           cls: "active" },
      acknowledged: { msg: "✅ Someone is responding",        cls: "acknowledged" },
      dispatched:   { msg: "🚓 Help is on the way",          cls: "dispatched" },
      resolved:     { msg: "✅ Situation resolved",           cls: "resolved" }
    };
    const s = statusMap[data.status] || { msg: data.status, cls: "" };
    setStatus(s.msg, s.cls);

    if (data.status === "resolved") {
      clearInterval(locationInterval);
      locationInterval = null;
      sosBtn.disabled   = false;
      sosBtn.innerHTML  = `<span>ACTIVATE</span><span class="label">SOS</span>`;
    }
  });
}

// ── Trigger SOS ──────────────────────────────────────────────
async function triggerSOS(isTest = false) {
  sosBtn.disabled  = true;
  testBtn.disabled = true;
  actionRow.hidden = true;
  setStatus("📡 Getting your location…");
  console.log("[SilentSOS] SOS triggered. Test:", isTest);

  let lat, lng;
  try {
    ({ lat, lng } = await getLocation());
    console.log("[SilentSOS] Location:", lat, lng);
  } catch (err) {
    console.error("[SilentSOS] Geolocation error:", err.message);
    setStatus("⚠️ Location access denied. Enable GPS and try again.");
    sosBtn.disabled  = false;
    testBtn.disabled = false;
    showToast("Could not get location — check GPS permissions.");
    return;
  }

  setStatus("📤 Sending alert…");
  try {
    currentAlertId = await saveAlert(lat, lng, isTest);
localStorage.setItem("currentAlertId", currentAlertId);

document
  .getElementById("active-alert-card")
  .style.display = "block";

console.log("[SilentSOS] Alert saved:", currentAlertId);
  } catch (err) {
    console.error("[SilentSOS] Firebase error:", err.message);
    setStatus("⚠️ Could not reach server. Check your connection.");
    sosBtn.disabled  = false;
    testBtn.disabled = false;
    showToast("Firebase error — check your config.");
    return;
  }

  // Show SOS pulsing ring
  document.querySelector(".sos-ring").classList.add("armed");

  // Show map
  showMap(lat, lng);
  localStorage.setItem("lastLat", lat);
localStorage.setItem("lastLng", lng);

  // Build message
  const message = buildMessage(lat, lng, currentAlertId);
  const encoded = encodeURIComponent(message);

  // Wire SMS button
  smsBtn.href = `sms:?body=${encoded}`;

  // Wire Share button
  if (navigator.share) {
    shareBtn.style.display = "";
    shareBtn.onclick = () => {
      navigator.share({ title: "SilentSOS Alert", text: message })
        .catch(e => console.warn("[SilentSOS] Share cancelled:", e));
    };
  } else {
    shareBtn.style.display = "none";
  }

  actionRow.hidden = false;

  if (isTest) {
    setStatus("🧪 Test alert sent — Firebase updated", "active");
    showToast("Test alert sent ✓");
  } else {
    setStatus("🔴 Waiting for help…", "active");
  }

  // Start real-time updates
  listenToAlert(currentAlertId);
  startLocationUpdates(currentAlertId);

  // Disable test btn while alert is live
  testBtn.disabled = true;
}

// ── Event listeners ──────────────────────────────────────────
sosBtn.addEventListener("click", () => triggerSOS(false));
testBtn.addEventListener("click", () => triggerSOS(true));

window.addEventListener("load", () => {

  const savedAlertId =
    localStorage.getItem("currentAlertId");

  if(savedAlertId){

    document
      .getElementById("active-alert-card")
      .style.display = "block";

    document
      .getElementById("alert-status-home")
      .textContent =
      "Status: Checking...";
  }
});

window.addEventListener("load", () => {

  const savedAlertId =
    localStorage.getItem("currentAlertId");

  if(!savedAlertId) return;

  const alertRef =
    ref(db, `alerts/${savedAlertId}`);

  onValue(alertRef, snap => {

    const data = snap.val();

    if(!data) return;
    const contactSection =
  document.getElementById(
    "emergency-contact-buttons"
  );

  if(contactSection){

    if(data.status === "resolved"){
      contactSection.style.display = "none";
    } else {
      contactSection.style.display = "block";
    }

}

    document
      .getElementById("active-alert-card")
      .style.display = "block";

      const messages = {
      active: "🔴 Waiting for help",
      acknowledged: "🟠 Someone is responding",
      dispatched: "🚓 Help is on the way",
      resolved: "✅ Situation resolved"
      };


    document
      .getElementById("alert-status-home")
      .textContent =
       messages[data.status] || data.status;

      document
       .getElementById("alert-time-home")
       .textContent =
      `Sent: ${new Date(data.timestamp).toLocaleString()}`;

    if(data.status === "resolved"){

  localStorage.removeItem("currentAlertId");
  localStorage.removeItem("lastLat");
  localStorage.removeItem("lastLng");

  document
    .getElementById("active-alert-card")
    .style.display = "none";

  document
    .getElementById("emergency-contact-buttons")
    .innerHTML = "";
}

  });

});
onValue(ref(db, "contacts"), snap => {

  const contacts = snap.val();

  if(!contacts) return;

  const container =
    document.getElementById(
      "emergency-contact-buttons"
    );

  if(!container) return;

  container.innerHTML = "";

  Object.values(contacts).forEach(contact => {

    container.innerHTML += `
      <a
        href="tel:${contact.phone}"
        class="btn btn-primary"
        style="display:block;margin:8px 0;"
      >
        📞 ${contact.name}
      </a>
    `;
  });

});
window.addEventListener("load", () => {

  const lat = localStorage.getItem("lastLat");
  const lng = localStorage.getItem("lastLng");

  if(lat && lng){
    showMap(lat, lng);
  }

});

import { db, ref, set } from "./firebase.js";

const button = document.getElementById("sosButton");

button.addEventListener("click", () => {
  console.log("SOS CLICKED");

  navigator.geolocation.getCurrentPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    set(ref(db, "alerts/" + Date.now()), {
      latitude: lat,
      longitude: lng
    });

    alert("SOS Sent!");
  });
});
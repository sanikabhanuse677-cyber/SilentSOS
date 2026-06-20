// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export so app.js can use it
export { db, ref, set };
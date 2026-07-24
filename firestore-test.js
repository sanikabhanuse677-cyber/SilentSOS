import { db } from "./firebase.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function testFirestore() {
  try {
    const docRef = await addDoc(collection(db, "test"), {
      message: "Hello Firestore!",
      createdAt: new Date().toISOString()
    });

    console.log("✅ Firestore Connected!");
    console.log("Document ID:", docRef.id);

    alert("Firestore Connected Successfully!");
  } catch (error) {
    console.error("❌ Firestore Error:", error);
    alert("Firestore Connection Failed");
  }
}

testFirestore();
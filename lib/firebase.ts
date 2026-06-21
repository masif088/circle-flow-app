import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Use emulator if configured
if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
  // Prevent re-connecting if already connected (important for Next.js hot reloads)
  if (!(auth as unknown as { _emulatorConfig?: unknown })._emulatorConfig) {
    try {
      connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
      console.log("Connected to Firebase Auth emulator");
    } catch (error) {
      console.warn("Failed to connect to Firebase Auth emulator:", error);
    }
  }

  // Prevent re-connecting firestore if already connected (avoiding "Firestore has already been started" error)
  const dbShim = db as unknown as { _settingsFrozen?: boolean };
  if (!dbShim._settingsFrozen) {
    try {
      connectFirestoreEmulator(db, "localhost", 8080);
      console.log("Connected to Firestore emulator");
    } catch (error) {
      console.warn("Failed to connect to Firestore emulator:", error);
    }
  }

  // Storage emulator connection
  const storageShim = storage as unknown as { _emulatorConfig?: unknown };
  if (!storageShim._emulatorConfig) {
    try {
      connectStorageEmulator(storage, "localhost", 9199);
      console.log("Connected to Firebase Storage emulator");
    } catch (error) {
      console.warn("Failed to connect to Firebase Storage emulator:", error);
    }
  }
}

export { app, auth, db, storage, firebaseConfig };

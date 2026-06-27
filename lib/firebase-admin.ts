import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const isEmulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
    
    if (isEmulator) {
      process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
      process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
    }

    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "circle-flow-3795f",
    });
    
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };

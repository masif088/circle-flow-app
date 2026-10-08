import { getApps, initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const isEmulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

if (isEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
}

const adminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

const app = getApps().length === 0
  ? initializeApp(
      adminPrivateKey
        ? {
            credential: cert({
              projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
              clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: adminPrivateKey,
            }),
          }
        : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "circle-flow-3795f" }
    )
  : getApp();

const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

export { adminDb, adminAuth };

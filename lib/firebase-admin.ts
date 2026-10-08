import { getApps, initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const isEmulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  if (isEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
  }

  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_B64
    ? Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY_B64, "base64").toString("utf-8")
    : process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  // Strip surrounding quotes yang mungkin ikut tersimpan di env UI
  const privateKey = rawKey?.replace(/^"+|"+$/g, "").replace(/\\n/g, "\n");
  return initializeApp(
    privateKey
      ? {
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey,
          }),
        }
      : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "circle-flow-3795f" }
  );
}

export function getAdminDb() { return getFirestore(getAdminApp()); }
export function getAdminAuth() { return getAuth(getAdminApp()); }

// Backward-compat aliases (hanya pakai di server runtime, bukan build time)
export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get: (_, prop) => (getFirestore(getAdminApp()) as any)[prop],
});
export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get: (_, prop) => (getAuth(getAdminApp()) as any)[prop],
});

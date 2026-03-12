/**
 * Firebase Admin SDK — server-side only.
 *
 * Required environment variable:
 *   FIREBASE_SERVICE_ACCOUNT  – The full JSON of the service-account key,
 *                               stringified.  Generate it in Firebase Console →
 *                               Project Settings → Service accounts → Generate new
 *                               private key, then set the variable in your
 *                               deployment environment (e.g. Vercel env settings).
 *
 * When the variable is absent (e.g. during `next build` on CI), all exports are
 * null and callers must guard with null-checks before using them.
 */

import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let _messaging: Messaging | null = null;
let _adminDb: Firestore | null = null;

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (rawServiceAccount) {
  try {
    const serviceAccount = JSON.parse(rawServiceAccount);
    adminApp = getApps().length === 0
      ? initializeApp({ credential: cert(serviceAccount) })
      : getApps()[0];
    _messaging = getMessaging(adminApp);
    _adminDb   = getFirestore(adminApp);
  } catch (e) {
    console.error(
      "[Firebase Admin] Failed to initialize: check FIREBASE_SERVICE_ACCOUNT format.",
      e
    );
  }
} else {
  // Only warn at runtime (server start), not during `next build`
  if (process.env.NODE_ENV === "development" || process.env.NEXT_PHASE !== "phase-production-build") {
    console.warn(
      "[Firebase Admin] FIREBASE_SERVICE_ACCOUNT is not set. " +
      "Push notifications and server-side Firestore access will not work. " +
      "See lib/firebaseAdmin.ts for setup instructions."
    );
  }
}

export const adminMessaging: Messaging | null = _messaging;
export const adminDb: Firestore | null = _adminDb;

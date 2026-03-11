import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "",
};

if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.projectId
) {
  console.warn(
    "[Firebase] Miljövariabler saknas. " +
    "Kopiera .env.example till .env.local och fyll i dina Firebase-uppgifter. " +
    "Skapa ett projekt på https://console.firebase.google.com/"
  );
}

/*
 * Placeholder fallback values are used when env-vars are absent (e.g. during
 * `next build` on CI / Vercel without env vars configured) so that the module
 * can be evaluated without throwing.  All actual API calls will fail gracefully
 * in that case — the app requires real credentials at runtime.
 *
 * Firebase API key must pass basic format validation, so we use a placeholder
 * that looks like a real key (starts with "AIzaSy").
 */
const app = getApps().length === 0
  ? initializeApp({
      ...firebaseConfig,
      apiKey:     firebaseConfig.apiKey     || "AIzaSyPlaceholderKeyForBuildOnly0000",
      authDomain: firebaseConfig.authDomain || "placeholder.firebaseapp.com",
      projectId:  firebaseConfig.projectId  || "placeholder-project",
    })
  : getApps()[0];

export const auth = getAuth(app);
export const db   = getFirestore(app);

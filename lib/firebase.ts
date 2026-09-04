import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.appId &&
  firebaseConfig.authDomain &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.projectId,
);

/**
 * Firebase is optional at build time so the existing JWT auth flow can run
 * without a Firebase project configured. `firebaseApp` is initialized once
 * and can be consumed by Firebase Auth, Storage, or other SDK modules later.
 */
export const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    throw new Error(
      "Firebase chưa được cấu hình. Hãy bổ sung các biến NEXT_PUBLIC_FIREBASE_*.",
    );
  }
  return firebaseApp;
}

// Client-safe Firebase initialization. Avoid initializing on the server or when env is missing.
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getAnalytics, type Analytics } from 'firebase/analytics'
import { getFirestore, type Firestore } from 'firebase/firestore'
// import { getStorage } from 'firebase/storage' // Commented out - requires Blaze plan

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const

const isBrowser = typeof window !== 'undefined'
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
// const storage = getStorage(app) // Commented out - requires Blaze plan upgrade

// Initialize in browser OR Node.js if config is present
if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  auth = getAuth(app)
  db = getFirestore(app)
}

// Initialize Analytics only in browser and when app exists
let analytics: Analytics | undefined
if (isBrowser && app && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app)
  } catch {
    // Ignore analytics errors in non-browser environments
  }
}
export { app, auth, db, analytics, isFirebaseConfigured }
// export { storage } // Commented out - Storage requires Blaze plan upgrade

// Helper to obtain a non-undefined Firestore instance (throws if missing)
export function requireDb(): Firestore {
  if (!db) {
    throw new Error('Firebase Firestore is not configured. Ensure NEXT_PUBLIC_FIREBASE_* env vars are set.')
  }
  return db
}

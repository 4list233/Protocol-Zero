import { getApps, initializeApp, cert, applicationDefault, type AppOptions } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

let firebaseAdminInitialized = false

function buildCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
  }

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  }

  return applicationDefault()
}

function ensureFirebaseAdminApp() {
  if (firebaseAdminInitialized && getApps().length > 0) {
    return getApps()[0]
  }

  const options: AppOptions = {
    credential: buildCredential(),
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT,
  }

  const app = getApps().length === 0 ? initializeApp(options) : getApps()[0]
  firebaseAdminInitialized = true
  return app
}

export function getFirebaseAdminAuth() {
  const app = ensureFirebaseAdminApp()
  return getAuth(app)
}


// Usage: npx tsx scripts/upload-products.ts
// This script uploads all products from lib/products.ts to Firestore

import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore'
import { products } from '../lib/products'

// Load env vars from .env.local
import 'dotenv/config'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)

async function uploadProducts() {
  function cleanProduct(product: any) {
    // Remove undefined fields
    const cleaned: any = {}
    for (const key in product) {
      if (product[key] !== undefined) cleaned[key] = product[key]
    }
    // Map to Firestore schema
    cleaned.price = product.price_cad
    cleaned.name = product.title
    cleaned.description = product.variant
    cleaned.inStock = true
    delete cleaned.price_cad
    delete cleaned.title
    delete cleaned.variant
    return cleaned
  }

  for (const product of products) {
    const ref = doc(collection(db, 'products'), product.id)
    await setDoc(ref, cleanProduct(product))
    console.log(`Uploaded: ${product.id}`)
  }
  console.log('All products uploaded!')
}

uploadProducts().catch((err) => {
  console.error('Error uploading products:', err)
  process.exit(1)
})

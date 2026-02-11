/**
 * Set Firebase Admin Custom Claims
 *
 * Run this once to set yourself as admin:
 *   node scripts/set-admin-claim.js forestli009@gmail.com
 *
 * Prerequisites:
 *   1. Download your Firebase Admin SDK service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *   2. Save it as: shop/firebase-admin-key.json (add to .gitignore!)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, '..', 'firebase-admin-key.json');

// Check if service account file exists
try {
  readFileSync(serviceAccountPath);
} catch {
  console.error('❌ firebase-admin-key.json not found!');
  console.error('');
  console.error('To get this file:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save the file as: shop/firebase-admin-key.json');
  console.error('4. Add firebase-admin-key.json to .gitignore');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

async function setAdminClaim(email) {
  try {
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log(`Found user: ${user.uid} (${user.email})`);

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Set admin claim for ${email}`);
    console.log('');
    console.log('The user needs to sign out and sign back in for the claim to take effect.');

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ User not found: ${email}`);
      console.error('Make sure the user has signed in at least once.');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-admin-claim.js <email>');
  console.error('Example: node scripts/set-admin-claim.js forestli009@gmail.com');
  process.exit(1);
}

setAdminClaim(email);

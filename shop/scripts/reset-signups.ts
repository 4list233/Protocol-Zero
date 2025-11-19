// Script to reset all signup data in Firestore
// Run with: npx tsx scripts/reset-signups.ts

import { deleteAllSignups } from '../lib/signups'

async function main() {
  console.log('🗑️  Resetting all signup data...')
  
  try {
    await deleteAllSignups()
    console.log('✅ All signups have been deleted!')
  } catch (error) {
    console.error('❌ Error deleting signups:', error)
    process.exit(1)
  }
}

main()

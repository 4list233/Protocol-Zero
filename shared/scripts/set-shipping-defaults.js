#!/usr/bin/env node
/**
 * Set default shipping cost (70 CNY) for all variants
 * 
 * Usage: node set-shipping-defaults.js [--dry-run]
 */

const https = require('https')

const SHIPPING_CNY_DEFAULT = 70
const VARIANTS_OBJECT = 'object_7'
const SHIPPING_FIELD = 'field_151'  // Shipping CNY field

class KnackClient {
  constructor() {
    this.applicationId = process.env.KNACK_APPLICATION_ID
    this.apiKey = process.env.KNACK_REST_API_KEY
    
    if (!this.applicationId || !this.apiKey) {
      throw new Error('Missing Knack credentials')
    }
  }
  
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.knack.com',
        port: 443,
        path: `/v1${path}`,
        method,
        headers: {
          'X-Knack-Application-Id': this.applicationId,
          'X-Knack-REST-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        }
      }
      
      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (res.statusCode >= 400) {
              reject(new Error(`Knack API error ${res.statusCode}: ${JSON.stringify(json)}`))
            } else {
              resolve(json)
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`))
          }
        })
      })
      
      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }
  
  async getRecords(objectKey) {
    const path = `/objects/${objectKey}/records?rows_per_page=1000`
    const response = await this.request('GET', path)
    return response.records || []
  }
  
  async updateRecord(objectKey, recordId, data) {
    const path = `/objects/${objectKey}/records/${recordId}`
    return this.request('PUT', path, data)
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  
  console.log('='.repeat(60))
  console.log('SET SHIPPING DEFAULTS')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`)
  console.log(`Setting Shipping CNY = ¥${SHIPPING_CNY_DEFAULT} for all variants`)
  console.log('')
  
  const knack = new KnackClient()
  
  // Fetch all variants
  console.log('Fetching variants...')
  const variants = await knack.getRecords(VARIANTS_OBJECT)
  console.log(`Found ${variants.length} variants`)
  
  // Count how many already have shipping set
  let alreadySet = 0
  let needsUpdate = 0
  
  for (const variant of variants) {
    const currentShipping = variant[SHIPPING_FIELD]
    if (currentShipping && Number(currentShipping) > 0) {
      alreadySet++
    } else {
      needsUpdate++
    }
  }
  
  console.log(`  Already have shipping set: ${alreadySet}`)
  console.log(`  Need update: ${needsUpdate}`)
  console.log('')
  
  if (dryRun) {
    console.log('DRY RUN - no changes made')
    console.log(`Would update ${variants.length} variants to Shipping CNY = ¥${SHIPPING_CNY_DEFAULT}`)
    return
  }
  
  // Update all variants
  console.log('Updating variants...')
  let updated = 0
  let errors = 0
  
  for (const variant of variants) {
    try {
      await knack.updateRecord(VARIANTS_OBJECT, variant.id, {
        [SHIPPING_FIELD]: SHIPPING_CNY_DEFAULT
      })
      updated++
      
      // Progress indicator every 25
      if (updated % 25 === 0) {
        console.log(`  Updated ${updated}/${variants.length}...`)
      }
    } catch (err) {
      console.log(`  ❌ Error updating ${variant.id}: ${err.message}`)
      errors++
    }
  }
  
  console.log('')
  console.log('='.repeat(60))
  console.log('COMPLETE')
  console.log('='.repeat(60))
  console.log(`Updated: ${updated}`)
  console.log(`Errors: ${errors}`)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})


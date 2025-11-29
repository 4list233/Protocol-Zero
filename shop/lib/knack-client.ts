// Knack REST API client for server-side operations
// Documentation: https://docs.knack.com/docs/object-based-requests

import { KNACK_CONFIG } from './knack-config'

const KNACK_API_BASE = 'https://api.knack.com/v1'

type KnackConfig = {
  applicationId: string
  apiKey: string
}

let knackConfig: KnackConfig | null = null

function getKnackConfig(): KnackConfig {
  if (knackConfig) return knackConfig

  // Use config from knack-config.ts - API keys are required from environment variables
  // This will throw an error if keys are not set (handled in knack-config.ts)
  const applicationId = KNACK_CONFIG.applicationId
  const apiKey = KNACK_CONFIG.apiKey

  knackConfig = { applicationId, apiKey }
  return knackConfig
}

type KnackHeaders = {
  'X-Knack-Application-Id': string
  'X-Knack-REST-API-Key': string
  'Content-Type': string
}

function getHeaders(): KnackHeaders {
  const config = getKnackConfig()
  return {
    'X-Knack-Application-Id': config.applicationId,
    'X-Knack-REST-API-Key': config.apiKey,
    'Content-Type': 'application/json',
  }
}

type KnackRecord = {
  id: string
  [key: string]: unknown
}

type KnackResponse<T = KnackRecord> = {
  records: T[]
  total_records: number
  current_page: number
  total_pages: number
  per_page: number
}

type KnackCreateResponse = {
  id: string
  [key: string]: unknown
}

type KnackUpdateResponse = {
  id: string
  [key: string]: unknown
}

/**
 * Get a single page of records from a Knack object
 */
async function getKnackRecordsPage<T = KnackRecord>(
  objectKey: string,
  options?: {
    filters?: Record<string, unknown>
    sortField?: string
    sortOrder?: 'asc' | 'desc'
    page?: number
    perPage?: number
  }
): Promise<KnackResponse<T>> {
  const headers = getHeaders()

  const params = new URLSearchParams()
  if (options?.sortField) {
    params.append('sort_field', options.sortField)
    params.append('sort_order', options.sortOrder || 'asc')
  }
  if (options?.page) params.append('page', options.page.toString())
  // Use higher per page to reduce API calls
  params.append('rows_per_page', (options?.perPage || 1000).toString())

  // Knack filters require a specific JSON format:
  // {"match":"and","rules":[{"field":"field_xx","operator":"is","value":"xxx"}]}
  if (options?.filters && Object.keys(options.filters).length > 0) {
    const rules = Object.entries(options.filters).map(([field, value]) => ({
      field,
      operator: 'is',
      value: String(value),
    }))
    
    const filterObject = {
      match: 'and',
      rules,
    }
    
    params.append('filters', JSON.stringify(filterObject))
  }

  const url = `${KNACK_API_BASE}/objects/${objectKey}/records${params.toString() ? `?${params.toString()}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Knack API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return (await response.json()) as KnackResponse<T>
}

/**
 * Get ALL records from a Knack object (handles pagination automatically)
 */
export async function getKnackRecords<T = KnackRecord>(
  objectKey: string,
  options?: {
    filters?: Record<string, unknown>
    sortField?: string
    sortOrder?: 'asc' | 'desc'
    page?: number
    perPage?: number
  }
): Promise<T[]> {
  // If a specific page is requested, just return that page
  if (options?.page) {
    const data = await getKnackRecordsPage<T>(objectKey, options)
    console.log(`Knack API returned ${data.records.length} records (page ${data.current_page}/${data.total_pages})`)
    return data.records
  }
  
  // Otherwise, fetch ALL pages
  const allRecords: T[] = []
  let currentPage = 1
  let totalPages = 1
  
  do {
    const data = await getKnackRecordsPage<T>(objectKey, {
      ...options,
      page: currentPage,
      perPage: 1000, // Max per page to minimize API calls
    })
    
    allRecords.push(...data.records)
    totalPages = data.total_pages
    
    console.log(`Knack API: fetched page ${currentPage}/${totalPages} (${data.records.length} records, total so far: ${allRecords.length})`)
    
    currentPage++
  } while (currentPage <= totalPages)
  
  console.log(`Knack API: fetched ALL ${allRecords.length} records from ${objectKey}`)
  return allRecords
}

/**
 * Get a single record by ID
 */
export async function getKnackRecord<T = KnackRecord>(objectKey: string, recordId: string): Promise<T | null> {
  const headers = getHeaders()

  const url = `${KNACK_API_BASE}/objects/${objectKey}/records/${recordId}`

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (response.status === 404) return null

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Knack API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = (await response.json()) as { record: T }
  return data.record
}

/**
 * Create a new record in a Knack object
 */
export async function createKnackRecord<T = KnackRecord>(
  objectKey: string,
  data: Record<string, unknown>
): Promise<string> {
  const headers = getHeaders()

  const url = `${KNACK_API_BASE}/objects/${objectKey}/records`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Knack API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const result = (await response.json()) as KnackCreateResponse
  return result.id
}

/**
 * Update an existing record in a Knack object
 */
export async function updateKnackRecord(
  objectKey: string,
  recordId: string,
  data: Record<string, unknown>
): Promise<void> {
  const headers = getHeaders()

  const url = `${KNACK_API_BASE}/objects/${objectKey}/records/${recordId}`

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Knack API error: ${response.status} ${response.statusText} - ${errorText}`)
  }
}

/**
 * Delete a record from a Knack object
 */
export async function deleteKnackRecord(objectKey: string, recordId: string): Promise<void> {
  const headers = getHeaders()

  const url = `${KNACK_API_BASE}/objects/${objectKey}/records/${recordId}`

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Knack API error: ${response.status} ${response.statusText} - ${errorText}`)
  }
}

/**
 * Check if Knack is configured
 */
export function isKnackConfigured(): boolean {
  try {
    getKnackConfig()
    return true
  } catch {
    return false
  }
}

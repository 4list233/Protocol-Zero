/**
 * useAdminFetch — wraps fetch() with a live Firebase ID token.
 *
 * Usage:
 *   const adminFetch = useAdminFetch()
 *   const res = await adminFetch('/api/admin/products', { method: 'GET' })
 *
 * The hook re-acquires a fresh token on every call so short-lived expiries aren't
 * a problem (Firebase tokens are valid for 1 hour; forceRefresh: false reuses the
 * cached token until it's close to expiry).
 */

'use client'

import { useAuth } from '@/lib/auth-context'
import { useCallback } from 'react'

export function useAdminFetch() {
  const { user } = useAuth()

  return useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      if (!user) {
        throw new Error('Not authenticated')
      }

      const token = await user.getIdToken(/* forceRefresh */ false)

      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`,
        },
      })
    },
    [user]
  )
}

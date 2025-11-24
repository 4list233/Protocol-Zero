"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ADMIN_EMAILS } from '@/lib/constants'
import EditableProductTable from '@/components/admin/EditableProductTable'

export default function AdminProductsPage() {
  const { user, loading } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  useEffect(() => {
    if (user && user.email && ADMIN_EMAILS.includes(user.email)) {
      // Get Firebase ID token
      user.getIdToken().then((idToken: string) => {
        // Fetch products from API route with auth headers
        fetch('/api/admin/products', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'x-user-email': user.email || '',
            'x-user-id': user.uid,
          },
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch products')
            return res.json()
          })
          .then(data => {
            setProducts(data.products || [])
            setProductsLoading(false)
          })
          .catch(err => {
            console.error('Error fetching products:', err)
            setProductsLoading(false)
          })
      }).catch(err => {
        console.error('Error getting ID token:', err)
        setProductsLoading(false)
      })
    }
  }, [user])

  if (loading || productsLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Products</h1>
        <div className="text-neutral-400">Loading products...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Products</h1>
      <EditableProductTable products={products} />
    </div>
  )
}

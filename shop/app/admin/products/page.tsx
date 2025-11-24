import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ADMIN_EMAILS } from '@/lib/constants'
import { fetchProductsFromNotion } from '@/lib/notion-products'
import EditableProductTable from '@/components/admin/EditableProductTable'

export default async function AdminProductsPage() {
  const session = await auth()
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    redirect('/auth/signin')
  }

  // Fetch products and variants from Notion
  const products = await fetchProductsFromNotion()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Products</h1>
      <EditableProductTable products={products} />
    </div>
  )
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to shop page
    router.replace("/shop")
  }, [router])

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#3D9A6C] border-r-transparent"></div>
        <p className="text-[#A1A1A1] font-body mt-4">Redirecting to shop...</p>
      </div>
    </div>
  )
}

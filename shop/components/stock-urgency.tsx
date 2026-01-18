"use client"

import { AlertTriangle, Package, TrendingUp } from "lucide-react"

interface StockUrgencyProps {
  stock: number
  className?: string
}

export function StockUrgency({ stock, className = "" }: StockUrgencyProps) {
  if (stock <= 0) {
    return (
      <div className={`px-4 py-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3 ${className}`}>
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-500">Out of Stock</p>
          <p className="text-xs text-red-400 mt-1">This item is currently unavailable</p>
        </div>
      </div>
    )
  }

  if (stock <= 3) {
    return (
      <div className={`px-4 py-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3 animate-pulse ${className}`}>
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-500">Only {stock} left in stock!</p>
          <p className="text-xs text-red-400 mt-1">Order soon before it's gone</p>
        </div>
      </div>
    )
  }

  if (stock <= 10) {
    return (
      <div className={`px-4 py-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-start gap-3 ${className}`}>
        <Package className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-yellow-500">Low Stock - {stock} remaining</p>
          <p className="text-xs text-yellow-400 mt-1">Limited availability</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 py-3 bg-[#3D9A6C]/10 border border-[#3D9A6C]/50 rounded-lg flex items-start gap-3 ${className}`}>
      <TrendingUp className="h-5 w-5 text-[#3D9A6C] flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-[#3D9A6C]">✓ In Stock</p>
        <p className="text-xs text-[#3D9A6C]/80 mt-1">Ready to ship</p>
      </div>
    </div>
  )
}

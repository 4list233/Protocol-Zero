"use client"

import { isProductNew } from "@/lib/categories"

type NewBadgeProps = {
  createdAt?: string
  windowDays: number
  className?: string
}

/** "NEW" badge overlay for product cards. Renders nothing if the product is not new. */
export function NewBadge({ createdAt, windowDays, className = "" }: NewBadgeProps) {
  if (!isProductNew(createdAt, windowDays)) return null

  return (
    <span
      className={`absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-wider bg-[#3D9A6C] text-black rounded-md shadow-sm ${className}`}
    >
      New
    </span>
  )
}

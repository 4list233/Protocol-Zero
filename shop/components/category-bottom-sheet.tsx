"use client"

import { useState, useEffect, useCallback } from "react"
import { LayoutGrid, X, ChevronRight } from "lucide-react"
import Link from "next/link"
import { slugifyCategory, getCategoryColor } from "@/lib/categories"

type CategoryItem = {
  name: string
  count: number
}

type CategoryBottomSheetProps = {
  categories: CategoryItem[]
}

export function CategoryBottomSheet({ categories }: CategoryBottomSheetProps) {
  const [open, setOpen] = useState(false)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  const handleClose = useCallback(() => setOpen(false), [])

  if (categories.length === 0) return null

  return (
    <>
      {/* Floating trigger button - only visible on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-[#3D9A6C] text-black rounded-full shadow-lg hover:shadow-glow active:scale-95 transition-all font-heading font-bold text-sm uppercase tracking-wide"
        aria-label="Browse categories"
      >
        <LayoutGrid className="h-4 w-4" />
        Categories
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
          aria-hidden
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-[#1E1E1E] rounded-t-2xl border-t border-[#2C2C2C] max-h-[75vh] flex flex-col">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-[#2C2C2C] rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2C2C2C]">
            <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-[#F5F5F5]">
              Categories
            </h2>
            <button
              onClick={handleClose}
              className="p-1 text-[#A1A1A1] hover:text-[#F5F5F5] transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Category grid */}
          <div className="overflow-y-auto overscroll-contain p-5">
            <div className="grid grid-cols-2 gap-3">
              {categories.map(({ name, count }) => {
                const slug = slugifyCategory(name)
                const colors = getCategoryColor(name)
                return (
                  <Link
                    key={slug}
                    href={`/shop/category/${slug}`}
                    onClick={handleClose}
                    className={`flex items-center justify-between p-4 bg-gradient-to-br ${colors.gradient} border border-[#2C2C2C] rounded-xl hover:border-[#3D9A6C] transition-all active:scale-[0.97]`}
                  >
                    <div>
                      <span className="block text-sm font-heading font-bold text-[#F5F5F5] uppercase tracking-wide">
                        {name}
                      </span>
                      <span className="block text-xs text-[#A1A1A1] font-mono mt-0.5">
                        {count} {count === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#A1A1A1] flex-shrink-0" />
                  </Link>
                )
              })}
            </div>

            {/* New Arrivals link */}
            <Link
              href="/new-arrivals"
              onClick={handleClose}
              className="flex items-center justify-between mt-4 p-4 bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border border-[#3D9A6C]/30 rounded-xl hover:border-[#3D9A6C] transition-all active:scale-[0.97]"
            >
              <div>
                <span className="block text-sm font-heading font-bold text-[#3D9A6C] uppercase tracking-wide">
                  New Arrivals
                </span>
                <span className="block text-xs text-[#A1A1A1] font-mono mt-0.5">
                  Latest gear drops
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#3D9A6C] flex-shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

export type SortOption = "newest" | "alpha-asc" | "price-asc" | "price-desc"

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest First",
  "alpha-asc": "Alphabetical (A-Z)",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
}

type SortDropdownProps = {
  value: SortOption
  onChange: (value: SortOption) => void
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-xl text-sm text-[#F5F5F5] hover:border-[#3D9A6C] transition-colors"
      >
        <span className="text-[#A1A1A1] text-xs">Sort:</span>
        {SORT_LABELS[value]}
        <ChevronDown className={`h-4 w-4 text-[#A1A1A1] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-[#1E1E1E] border border-[#2C2C2C] rounded-xl shadow-lg overflow-hidden">
          {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option
                  ? "bg-[#3D9A6C]/10 text-[#3D9A6C]"
                  : "text-[#F5F5F5] hover:bg-[#2C2C2C]"
              }`}
            >
              {SORT_LABELS[option]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

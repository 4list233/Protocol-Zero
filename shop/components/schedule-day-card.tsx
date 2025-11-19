"use client"

import Link from "next/link"

export type ScheduleDayCardProps = {
  dayName: string
  dayDate: number
  hours: string
  specialText: string
  hasDiscount: boolean
  basePrice: number
  discountPrice?: number
  lateNightPrice?: number
  lateNightHours?: string
  checked: number
  isPast: boolean
  userSignedUpForDate: boolean
  hasGuestsForDate: boolean
  dateString: string
  signingUp: boolean
  onSignup: () => void
  onCancel: () => void
}

export function ScheduleDayCard(props: ScheduleDayCardProps) {
  const {
    dayName,
    dayDate,
    hours,
    specialText,
    hasDiscount,
    basePrice,
    discountPrice,
    lateNightPrice,
    lateNightHours,
    checked,
    isPast,
    userSignedUpForDate,
    hasGuestsForDate,
    dateString,
    signingUp,
    onSignup,
    onCancel,
  } = props

  return (
    <div 
      className="group bg-[#0D0D0D] border-2 border-[#2C2C2C] rounded-2xl p-3 md:p-4 hover:border-[#3D9A6C] hover:bg-[#1E1E1E] cursor-pointer transition-all hover:scale-[1.03] hover:shadow-glow"
    >
      <div className="text-center space-y-2">
        <div className="text-[#A1A1A1] text-xs md:text-sm font-medium font-heading uppercase tracking-wider">{dayName}</div>
        <div className="text-3xl md:text-4xl font-bold font-mono text-[#F5F5F5] group-hover:text-[#3D9A6C] transition-colors">{dayDate}</div>
        <div className="text-[10px] md:text-xs text-[#A1A1A1] font-mono">{hours}</div>

        <div className={`rounded-lg px-2 py-1 ${
          specialText === "50% OFF" ? "bg-[#E4B100]/20 border border-[#E4B100]/30" :
          (specialText === "SPEEDSOFT" || specialText === "FREE RENTAL") ? "bg-[#3D9A6C]/20 border border-[#3D9A6C]/30" :
          "bg-[#2C2C2C] border border-[#2C2C2C]"
        }`}>
          <div className={`text-xs font-bold font-heading uppercase tracking-wide ${
            specialText === "50% OFF" ? "text-[#E4B100]" :
            (specialText === "SPEEDSOFT" || specialText === "FREE RENTAL") ? "text-[#3D9A6C]" :
            "text-[#A1A1A1]"
          }`}>
            {specialText}
          </div>
        </div>

        <div className="space-y-1">
          {hasDiscount ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-[#A1A1A1] line-through font-mono">${basePrice}</span>
              <span className="text-lg font-bold text-[#3D9A6C] font-mono">${discountPrice}</span>
            </div>
          ) : (
            <div className="text-sm font-bold text-[#F5F5F5] font-mono">${basePrice}</div>
          )}
        </div>

        <div className="h-[32px] flex items-center justify-center">
          {lateNightPrice && lateNightHours && (
            <div className="bg-[#3D9A6C]/10 border border-[#3D9A6C]/30 rounded-lg px-2 py-1">
              <div className="text-[#3D9A6C] text-[10px] md:text-xs font-semibold font-mono">${lateNightPrice} ({lateNightHours})</div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[#2C2C2C] mt-2">
          <div className="text-2xl font-bold text-[#3D9A6C] font-mono">{checked}</div>
          <div className="text-[10px] md:text-xs text-[#A1A1A1] uppercase tracking-wide">checked in</div>
          {isPast ? (
            <Link
              href="/clips"
              className="mt-2 inline-block px-3 py-1 rounded-xl bg-[#3D9A6C] text-[#F5F5F5] font-bold text-xs hover:bg-[#337E59] transition"
            >
              View Clips
            </Link>
          ) : userSignedUpForDate ? (
            <div className="mt-2 flex flex-col gap-2">
              <button
                className="px-3 py-1 rounded-xl bg-[#2C2C2C] text-[#3D9A6C] font-bold text-xs hover:bg-[#3D3D3D] transition border border-[#3D9A6C]/40 disabled:opacity-60"
                disabled={signingUp}
                onClick={onCancel}
              >
                {signingUp ? "Cancelling..." : "✓ Checked In (cancel)"}
              </button>
              <Link
                href={`/guest-signup?date=${dateString}`}
                className="inline-block px-2 py-1 rounded-lg bg-[#3D9A6C] text-[#F5F5F5] font-bold text-[10px] hover:bg-[#337E59] transition text-center"
              >
                {hasGuestsForDate ? "Edit Guests" : "Sign Up a Guest"}
              </Link>
            </div>
          ) : (
            <button
              className="mt-2 px-3 py-1 rounded-xl bg-[#3D9A6C] text-[#F5F5F5] font-bold text-xs hover:bg-[#337E59] transition disabled:opacity-60"
              disabled={signingUp}
              onClick={onSignup}
            >
              {signingUp ? "Signing up..." : "Sign Up"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

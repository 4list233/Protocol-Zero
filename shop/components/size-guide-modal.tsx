"use client"

import { useState } from "react"
import { X, Ruler } from "lucide-react"

interface SizeGuideModalProps {
  category?: string
  className?: string
}

const SIZE_GUIDES = {
  "Tactical Clothing": [
    { size: "XS", chest: "86-91", waist: "71-76", height: "160-170" },
    { size: "S", chest: "91-96", waist: "76-81", height: "165-175" },
    { size: "M", chest: "96-101", waist: "81-86", height: "170-180" },
    { size: "L", chest: "101-107", waist: "86-92", height: "175-185" },
    { size: "XL", chest: "107-112", waist: "92-97", height: "180-190" },
    { size: "2XL", chest: "112-118", waist: "97-103", height: "185-195" },
  ],
  "Tactical Vest": [
    { size: "S", chest: "90-100", length: "60-65" },
    { size: "M", chest: "100-110", length: "65-70" },
    { size: "L", chest: "110-120", length: "70-75" },
    { size: "XL", chest: "120-130", length: "75-80" },
  ],
  "Combat Boots": [
    { size: "US 7 / EU 40", footLength: "25.0-25.5" },
    { size: "US 8 / EU 41", footLength: "25.5-26.0" },
    { size: "US 9 / EU 42", footLength: "26.0-26.5" },
    { size: "US 10 / EU 43", footLength: "26.5-27.0" },
    { size: "US 11 / EU 44", footLength: "27.0-27.5" },
    { size: "US 12 / EU 45", footLength: "27.5-28.0" },
  ],
  "Default": [
    { size: "One Size", description: "Adjustable to fit most users" },
  ],
}

export function SizeGuideModal({ category = "Default", className = "" }: SizeGuideModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sizeData = SIZE_GUIDES[category as keyof typeof SIZE_GUIDES] || SIZE_GUIDES["Default"]

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-sm text-[#A1A1A1] hover:text-[#3D9A6C] hover:border-[#3D9A6C] transition-colors ${className}`}
      >
        <Ruler className="h-4 w-4" />
        <span>Size Guide</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl max-w-3xl w-full p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-[#2C2C2C] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-[#A1A1A1]" />
            </button>

            <h2 className="text-2xl font-heading font-bold mb-6 text-[#F5F5F5] tracking-wide uppercase">
              Size Guide
            </h2>

            <p className="text-sm text-[#A1A1A1] mb-6">
              All measurements are in centimeters (cm). Measure around the fullest part of your body.
            </p>

            {/* Size Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#0D0D0D] border-b-2 border-[#3D9A6C]">
                    {Object.keys(sizeData[0]).map((key, idx) => (
                      <th key={idx} className="px-4 py-3 text-left text-sm font-heading font-bold text-[#3D9A6C] uppercase">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeData.map((row, idx) => (
                    <tr key={idx} className="border-b border-[#2C2C2C] hover:bg-[#0D0D0D] transition-colors">
                      {Object.values(row).map((value, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-3 text-sm text-[#F5F5F5]">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Measurement Tips */}
            <div className="mt-6 p-4 bg-[#3D9A6C]/10 border border-[#3D9A6C]/50 rounded-lg">
              <h3 className="text-sm font-heading font-bold text-[#3D9A6C] mb-2 uppercase">
                Measurement Tips
              </h3>
              <ul className="text-sm text-[#A1A1A1] space-y-1 list-disc list-inside">
                <li>Measure yourself without clothing for best accuracy</li>
                <li>Keep the measuring tape snug but not tight</li>
                <li>Measure around the fullest part of your chest and waist</li>
                <li>For clothing between sizes, choose the larger size</li>
                <li>Contact us if you need help choosing the right size</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

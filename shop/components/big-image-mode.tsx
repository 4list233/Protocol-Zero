"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"

interface BigImageModeProps {
  images: string[]
  initialIndex?: number
  productTitle: string
}

export function BigImageMode({ images, initialIndex = 0, productTitle }: BigImageModeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
      } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1)
      }
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden"

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, currentIndex, images.length])

  const previousImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 p-2 bg-[#1E1E1E]/90 backdrop-blur rounded-lg hover:bg-[#2C2C2C] transition-colors z-10"
        title="View fullscreen"
      >
        <Maximize2 className="h-5 w-5 text-[#F5F5F5]" />
      </button>

      {/* Fullscreen Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-3 bg-[#1E1E1E] rounded-full hover:bg-[#2C2C2C] transition-colors z-10"
            title="Close (Esc)"
          >
            <X className="h-6 w-6 text-[#F5F5F5]" />
          </button>

          {/* Previous Button */}
          {currentIndex > 0 && (
            <button
              onClick={previousImage}
              className="absolute left-4 p-3 bg-[#1E1E1E] rounded-full hover:bg-[#2C2C2C] transition-colors"
              title="Previous (←)"
            >
              <ChevronLeft className="h-8 w-8 text-[#F5F5F5]" />
            </button>
          )}

          {/* Main Image */}
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full">
            <Image
              src={images[currentIndex] || "/images/placeholder.png"}
              alt={`${productTitle} - Image ${currentIndex + 1}`}
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Next Button */}
          {currentIndex < images.length - 1 && (
            <button
              onClick={nextImage}
              className="absolute right-4 p-3 bg-[#1E1E1E] rounded-full hover:bg-[#2C2C2C] transition-colors"
              title="Next (→)"
            >
              <ChevronRight className="h-8 w-8 text-[#F5F5F5]" />
            </button>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#1E1E1E]/90 backdrop-blur rounded-full text-sm font-mono text-[#F5F5F5]">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  )
}

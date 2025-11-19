"use client"

import Link from "next/link"
import { CartDrawer } from "@/components/cart-drawer"
import { useState, useEffect } from "react"
import { getSignupCountsForWeek, addSignup, getAllSignups, deleteSignup } from "@/lib/signups"
import { useAuth } from "@/lib/auth-context"
// import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { getClipsByDate, extractYouTubeId, type Clip } from "@/lib/clips"
import { isFirebaseConfigured } from "@/lib/firebase"
import { getWeekSchedule } from "@/lib/schedule"
import { ScheduleDayCard } from "@/components/schedule-day-card"


// Helper function to get the current week's dates starting from Monday
function getCurrentWeekDates() {
  const today = new Date()
  const currentDay = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  const monday = new Date(today)
  
  // Adjust to get Monday of current week
  const diff = currentDay === 0 ? -6 : 1 - currentDay
  monday.setDate(today.getDate() + diff)
  
  const weekDates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    weekDates.push(date)
  }
  
  return weekDates
}

const schedule = getWeekSchedule()

export default function HomePage() {
  const router = useRouter()
  const weekDates = getCurrentWeekDates()
  const [mounted, setMounted] = useState(false)
  const [checkInCounts, setCheckInCounts] = useState<number[]>([])
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [signingUp, setSigningUp] = useState<number | null>(null)
  const { user, loading } = useAuth()
  const [pastClips, setPastClips] = useState<{ date: string; clips: Clip[] }[]>([])
  const [loadingClips, setLoadingClips] = useState(true)
  const [allSignups, setAllSignups] = useState<any[]>([])
  const [showFirebaseBanner, setShowFirebaseBanner] = useState(!isFirebaseConfigured)
  // Note: Guest modal flow removed in favor of standalone guest-signup page
  const [showPrompt, setShowPrompt] = useState<{ open: boolean, message: string, onConfirm: () => void, onCancel: () => void }>({ open: false, message: "", onConfirm: () => {}, onCancel: () => {} })

  useEffect(() => {
    setMounted(true)
    // Fetch real sign-up counts and all signups from Firestore
    const fetchCounts = async () => {
      try {
        const dateStrings = weekDates.map(d => d.toISOString().slice(0,10))
        const counts = await getSignupCountsForWeek(dateStrings)
        setCheckInCounts(counts)
        setLoadingCounts(false)
        const all = await getAllSignups()
        setAllSignups(all)
      } catch (error) {
        console.error("Error fetching signup counts:", error)
        setCheckInCounts(Array(7).fill(0))
        setLoadingCounts(false)
      }
    }
    fetchCounts()

    // Fetch clips for past dates
    const fetchPastClips = async () => {
      try {
        const nowString = new Date().toISOString().slice(0,10)
        const pastDates = weekDates.filter(d => d.toISOString().slice(0,10) < nowString)
        const clipsData = await Promise.all(
          pastDates.map(async (date) => {
            const dateString = date.toISOString().slice(0,10)
            const clips = await getClipsByDate(dateString)
            return { date: dateString, clips }
          })
        )
        setPastClips(clipsData.filter(d => d.clips.length > 0))
        setLoadingClips(false)
      } catch (error) {
        console.error("Error fetching past clips:", error)
        setLoadingClips(false)
      }
    }
    fetchPastClips()
  }, [weekDates])

  async function handleSignup(index: number) {
    const dateString = weekDates[index].toISOString().slice(0,10)
    // Check if user or guest already signed up for this date
    const userSignedUp = user && allSignups.some(s => !s.isGuest && s.userId === user.uid && s.date === dateString)
    const guestKey = `guest_signup_${dateString}`
    const guestSignedUp = typeof window !== 'undefined' && localStorage.getItem(guestKey)

    if (user) {
      if (userSignedUp) {
        // Already signed up, prompt to sign up for friends
        setShowPrompt({
          open: true,
          message: "You already signed up for this date. Sign up a guest?",
          onConfirm: () => {
            setShowPrompt({ ...showPrompt, open: false })
            router.push(`/guest-signup?date=${dateString}`)
          },
          onCancel: () => setShowPrompt({ ...showPrompt, open: false })
        })
        return
      }
      // Not signed up, allow sign up
      setSigningUp(index)
      await addSignup({
        userId: user.uid,
        username: user.displayName || "Anonymous",
        ...(user.displayName ? { displayName: user.displayName } : {}),
        ...(user.email ? { email: user.email } : {}),
        isGuest: false,
        date: dateString,
      })
      // Refresh counts and signups
      const dateStrings = weekDates.map(d => d.toISOString().slice(0,10))
      const counts = await getSignupCountsForWeek(dateStrings)
      setCheckInCounts(counts)
      setAllSignups(await getAllSignups())
      setSigningUp(null)
      return
    } else {
      // Not logged in
      if (guestSignedUp) {
        alert("You have already signed up as a guest for this date. Please sign in to sign up for yourself or more guests.")
        return
      }
      setShowPrompt({
        open: true,
  message: "Create an account to sign up, or continue to guest sign up?",
        onConfirm: () => {
          setShowPrompt({ ...showPrompt, open: false })
          router.push(`/guest-signup?date=${dateString}`)
        },
        onCancel: () => {
          setShowPrompt({ ...showPrompt, open: false })
          router.push("/account")
        }
      })
    }
  }

  async function handleCancelSignup(index: number) {
    if (!user) return
    const dateString = weekDates[index].toISOString().slice(0,10)
    
    setShowPrompt({
      open: true,
      message: "Cancel your check-in for this date?",
      onConfirm: async () => {
        setShowPrompt({ ...showPrompt, open: false })
        setSigningUp(index)
        
        try {
          // Delete the signup from Firestore
          await deleteSignup(user.uid, dateString)
          
          // Refresh counts and signups from server
          const dateStrings = weekDates.map(d => d.toISOString().slice(0,10))
          const counts = await getSignupCountsForWeek(dateStrings)
          setCheckInCounts(counts)
          setAllSignups(await getAllSignups())
        } catch (err) {
          console.error('Failed to cancel signup:', err)
          alert('Failed to cancel signup. Please try again.')
        } finally {
          setSigningUp(null)
        }
      },
      onCancel: () => setShowPrompt({ ...showPrompt, open: false })
    })
  }

  // Modal and prompt rendering
  function PromptModal() {
    if (!showPrompt.open) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white text-black rounded-lg p-6 max-w-sm w-full">
          <div className="mb-4">{showPrompt.message}</div>
          <div className="flex gap-4 justify-end">
            <button className="px-4 py-2 bg-[#3D9A6C] text-white rounded" onClick={showPrompt.onConfirm}>Yes</button>
            <button className="px-4 py-2 bg-gray-300 rounded" onClick={showPrompt.onCancel}>No</button>
          </div>
        </div>
      </div>
    )
  }

  // Guest modal removed: using standalone page

  // Helper to get today index
  const todayIndex = weekDates.findIndex(d => {
    const now = new Date()
    return d.toISOString().slice(0,10) === now.toISOString().slice(0,10)
  })
  
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#2C2C2C] bg-[#1E1E1E]/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="/logos/logo-icon.png" 
              alt="Protocol Zero" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-heading font-bold tracking-wide uppercase">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/clips" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Clips</Link>
            <Link href="/shop" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Shop</Link>
            <Link href="/account" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Account</Link>
            <CartDrawer />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        {showFirebaseBanner && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600/40 text-red-200 rounded-xl flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Firebase is not configured.</p>
              <p className="text-sm opacity-80">Set NEXT_PUBLIC_FIREBASE_* environment variables to enable sign-ups, auth, and clips.</p>
            </div>
            <button
              className="px-3 py-1 text-xs bg-red-800/40 hover:bg-red-800/60 rounded-md"
              onClick={() => setShowFirebaseBanner(false)}
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6 py-8">
            <div className="inline-block">
              <h1 className="text-5xl md:text-7xl font-heading font-black tracking-wider uppercase">
                <span className="text-[#F5F5F5]">WHEN WE </span>
                <span className="text-[#3D9A6C]">PLAY</span>
              </h1>
              <div className="h-1 bg-gradient-to-r from-transparent via-pza-accent to-transparent mt-4"></div>
            </div>
            <p className="text-xl text-[#A1A1A1] font-body">
              Check in for upcoming game days and see who's coming
            </p>
          </div>

          {/* Weekly Schedule with Check-in */}
          <div className="bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl p-4 md:p-8 shadow-card">
            <h2 className="text-3xl font-heading font-bold mb-8 text-center uppercase tracking-wide">
              📅 This Week's Schedule
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 md:gap-4">
              {weekDates.map((date, index) => {
                const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                const dayIndex = date.getDay()
                const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1 // Convert to Mon=0, Sun=6
                const dayName = dayNames[dayIndex]
                const dayDate = date.getDate()
                const dayCfg = schedule[adjustedIndex]
                const hours = dayCfg?.hours || ""
                const specialText = dayCfg?.discountLabel || "Regular"
                const hasDiscount = typeof dayCfg?.discountedPrice === 'number'
                const basePrice = dayCfg?.basePrice
                const discountPrice = dayCfg?.discountedPrice
                const lateNight = dayCfg?.lateNightPrice && dayCfg?.lateNightHours
                const checked = mounted && !loadingCounts ? (checkInCounts[index] || 0) : 0
                const dateString = date.toISOString().slice(0,10)
                const nowString = new Date().toISOString().slice(0,10)
                const isPast = dateString < nowString
                const userSignedUpForDate = !!(user && allSignups.some(s => !s.isGuest && s.userId === user.uid && s.date === dateString))
                const hasGuestsForDate = !!(user && allSignups.some(s => s.isGuest && s.sponsorUserId === user.uid && s.date === dateString))
                
                return (
                  <ScheduleDayCard
                    key={index}
                    dayName={dayName}
                    dayDate={dayDate}
                    hours={hours}
                    specialText={specialText}
                    hasDiscount={!!hasDiscount}
                    basePrice={basePrice || 0}
                    discountPrice={discountPrice}
                    lateNightPrice={dayCfg?.lateNightPrice}
                    lateNightHours={dayCfg?.lateNightHours}
                    checked={mounted && !loadingCounts ? checked : 0}
                    isPast={isPast}
                    userSignedUpForDate={userSignedUpForDate}
                    hasGuestsForDate={hasGuestsForDate}
                    dateString={dateString}
                    signingUp={signingUp === index}
                    onSignup={() => handleSignup(index)}
                    onCancel={() => handleCancelSignup(index)}
                  />
                )
              })}
            </div>
            <div className="mt-6 p-4 bg-[#2C2C2C]/30 rounded-lg border border-[#2C2C2C]">
              <p className="text-sm text-[#A1A1A1] text-center font-body">
                💡 <strong className="text-[#3D9A6C]">Wed-Sun last 3 hours:</strong> 50% OFF admission ($25) • <strong className="text-[#E4B100]">Mon-Tue:</strong> 50% OFF all day ($25) • <strong className="text-[#F5F5F5]">Regular:</strong> $50
              </p>
            </div>

            {/* Check in for today */}

            {/* Sign up for future dates */}

            {/* Show clips for past dates */}
          </div>
        </div>
      </main>
  <PromptModal />
  </div>
  )
}

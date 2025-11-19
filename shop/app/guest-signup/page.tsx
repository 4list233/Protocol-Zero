"use client"

import { useRouter, useSearchParams } from "next/navigation"
import React, { useState } from "react"
import { useAuth } from "../../lib/auth-context"
import { addSignup, deleteGuestSignup, getGuestsForUserDate } from "../../lib/signups"

export default function GuestSignupPage() {
  const router = useRouter()
  const params = useSearchParams()
  const date = params.get("date") || ""
  const { user } = useAuth()
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [guests, setGuests] = useState<string[]>([])
  // Load guests for authenticated user and date
  const loadGuests = async () => {
    if (user && date) {
      const guestNames = await getGuestsForUserDate(user.uid, date)
      setGuests(guestNames)
    } else {
      setGuests([])
    }
  }

  // Load guests on mount and when user/date changes
  React.useEffect(() => {
    loadGuests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!date) {
      setError("No date specified.")
      return
    }
    const key = `guest_signup_${date}`
    // Only enforce single guest limit when NOT authenticated
    if (!user && typeof window !== "undefined" && localStorage.getItem(key)) {
      setError("You have already signed up one guest for this date. Create an account to add more.")
      return
    }
    setLoading(true)
    try {
      await addSignup({
        username: name.trim(),
        isGuest: true,
        date,
        sponsorUserId: user ? user.uid : undefined,
        sponsorName: user ? (user.displayName || "Authenticated User") : undefined,
        sponsorEmail: user ? (user.email || null) : null,
      })
      if (!user && typeof window !== "undefined") localStorage.setItem(key, "1")
      setSubmitted(true)
    } catch (e) {
      setError("Failed to sign up. Please try again.")
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pza-bg text-pza-text-primary px-4">
        <img src="/logos/logo-full.png" alt="Protocol Zero" className="h-16 mb-6" />
  <h1 className="text-3xl font-heading font-bold mb-4 text-pza-accent">Guest signed up successfully!</h1>
        <button className="px-6 py-2 bg-pza-accent hover:bg-pza-accent-hover text-pza-text-primary rounded-xl font-bold text-lg transition" onClick={() => router.push("/")}>Back to Home</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-pza-bg text-pza-text-primary px-4">
      <img src="/logos/logo-full.png" alt="Protocol Zero" className="h-16 mb-6" />
  <h1 className="text-3xl font-heading font-bold mb-4 text-pza-accent">Sign up a Guest</h1>
      <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-sm bg-pza-surface rounded-2xl shadow-card p-6 border border-pza-divider">
        <div>
          <label className="block text-base font-heading mb-2 text-pza-text-primary">Guest Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border border-pza-divider rounded-xl bg-pza-bg text-pza-text-primary placeholder:text-pza-text-secondary focus:outline-none focus:ring-2 focus:ring-pza-accent text-lg"
            placeholder="Enter guest name"
            disabled={loading}
            autoFocus
          />
        </div>
        {error && <div className="text-pza-error text-base font-semibold">{error}</div>}
        <button
          type="submit"
          className="w-full px-4 py-3 bg-pza-accent hover:bg-pza-accent-hover text-pza-text-primary rounded-xl font-bold text-lg transition"
          disabled={loading}
        >
          {loading ? "Signing up..." : user ? "Sign Up Guest" : "Sign Up a Guest"}
        </button>
      </form>
      <button
        className="mt-6 w-full px-4 py-3 bg-pza-accent hover:bg-pza-accent-hover text-pza-text-primary rounded-xl font-bold text-lg transition"
        onClick={() => router.push("/")}
      >Back to Home</button>
      {/* List of guests for this user/date */}
      {user && guests && guests.length > 0 && (
        <div className="mt-8 w-full max-w-sm bg-pza-surface rounded-2xl shadow-card p-6 border border-pza-divider">
          <h2 className="text-xl font-heading font-bold mb-4 text-pza-accent">Your Guests</h2>
          <ul className="space-y-3">
            {guests.map(guest => (
              <li key={guest} className="flex items-center justify-between">
                <span className="font-mono text-base text-pza-text-primary">{guest}</span>
                <button
                  className="px-3 py-1 bg-pza-error text-white rounded-lg text-xs font-bold hover:bg-red-700 transition"
                  onClick={async () => {
                    setLoading(true)
                    await deleteGuestSignup(user.uid, guest, date)
                    await loadGuests()
                    setLoading(false)
                  }}
                  disabled={loading}
                >Remove</button>
              </li>
            ))}
          </ul>
          <button
            className="mt-6 w-full px-4 py-3 bg-pza-accent hover:bg-pza-accent-hover text-pza-text-primary rounded-xl font-bold text-lg transition"
            onClick={() => router.push("/")}
          >Back to Home</button>
        </div>
      )}
    </div>
  )
}

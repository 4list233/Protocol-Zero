"use client"
import { useState } from "react"
import { addSignup } from "../lib/signups"

export default function GuestSignup({ date, onSuccess }: { date: string, onSuccess: () => void }) {
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    // Spam prevention: limit to 1 guest sign-up per date in localStorage
    const key = `guest_signup_${date}`
    if (localStorage.getItem(key)) {
      setError("You have already signed up as a guest for this date.")
      return
    }
    setLoading(true)
    try {
      await addSignup({
        username: name.trim(),
        isGuest: true,
        date,
      })
  localStorage.setItem(key, "1")
  setSubmitted(true)
  setTimeout(() => onSuccess(), 500)
    } catch (e) {
      setError("Failed to sign up. Please try again.")
    }
    setLoading(false)
  }

  if (submitted) {
    return <div className="text-green-600 font-bold">Guest sign-up successful!</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Guest Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          disabled={loading}
        />
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        type="submit"
        className="px-4 py-2 bg-[#3D9A6C] text-white rounded font-bold"
        disabled={loading}
      >
        {loading ? "Signing up..." : "Sign Up as Guest"}
      </button>
    </form>
  )
}

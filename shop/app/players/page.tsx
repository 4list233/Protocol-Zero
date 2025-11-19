"use client"

import { useEffect, useState } from "react"
import { getAllSignups } from "@/lib/signups"

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const all = await getAllSignups()
        // Only show authenticated users (not guests)
        setPlayers(all.filter((p: any) => !p.isGuest))
      } catch (e) {
        setPlayers([])
      }
      setLoading(false)
    }
    fetchPlayers()
  }, [])

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#F5F5F5] p-8">
      <h1 className="text-3xl font-bold mb-6">Signed Up Players</h1>
      {loading ? (
        <p>Loading...</p>
      ) : players.length === 0 ? (
        <p>No players have signed up yet.</p>
      ) : (
        <ul className="space-y-3">
          {players.map((player, idx) => (
            <li key={idx} className="border-b border-[#2C2C2C] pb-2">
              <div className="font-semibold">{player.displayName || player.username}</div>
              <div className="text-xs text-[#A1A1A1]">{player.email}</div>
              <div className="text-xs text-[#3D9A6C]">Signed up for: {player.date}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

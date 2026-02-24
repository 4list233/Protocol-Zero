"use client"

import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure your store</p>
      </div>

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
        <Settings className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Settings Coming Soon</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Store configuration options will be available here in a future update.
        </p>
      </div>
    </div>
  )
}

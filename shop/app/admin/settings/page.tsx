"use client"

import { useEffect, useState } from "react"
import { Settings, Plus, X, Tag } from "lucide-react"
import {
  DEFAULT_CATEGORIES,
  getCustomCategories,
  saveCustomCategory,
  removeCustomCategory,
  getAdminCategories,
} from "@/lib/admin-categories"

export default function SettingsPage() {
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Load after mount so localStorage is available
  useEffect(() => {
    setCustomCategories(getCustomCategories())
  }, [])

  const handleAdd = () => {
    const trimmed = newCategory.trim()
    if (!trimmed) return

    const all = getAdminCategories()
    if (all.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists.`)
      return
    }

    saveCustomCategory(trimmed)
    setCustomCategories(getCustomCategories())
    setNewCategory("")
    setError(null)
  }

  const handleRemove = (cat: string) => {
    removeCustomCategory(cat)
    setCustomCategories(getCustomCategories())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure your store</p>
      </div>

      {/* Category Management */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Product Categories</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              These categories appear in the product editor dropdown and as filter chips in the shop.
            </p>
          </div>
        </div>

        {/* Default Categories (read-only) */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Default Categories
          </p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_CATEGORIES.sort().map((cat) => (
              <span
                key={cat}
                className="px-3 py-1 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full"
              >
                {cat}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-2">Default categories cannot be removed.</p>
        </div>

        {/* Custom Categories */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Custom Categories
          </p>
          {customCategories.length === 0 ? (
            <p className="text-sm text-zinc-600 italic">No custom categories added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customCategories.sort().map((cat) => (
                <span
                  key={cat}
                  className="flex items-center gap-1.5 px-3 py-1 text-sm bg-orange-900/30 border border-orange-800/50 text-orange-300 rounded-full"
                >
                  {cat}
                  <button
                    onClick={() => handleRemove(cat)}
                    className="text-orange-400 hover:text-white transition-colors"
                    aria-label={`Remove ${cat}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add New Category */}
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Add New Category
          </p>
          <div className="flex items-center gap-3 max-w-sm">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => { setNewCategory(e.target.value); setError(null) }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Optics, Magazines..."
              className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!newCategory.trim()}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
          <p className="text-xs text-zinc-600 mt-2">
            New categories are saved to this browser and immediately available in the product editor.
          </p>
        </div>
      </div>

      {/* Placeholder for future settings */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
        <Settings className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">More Settings Coming Soon</h2>
        <p className="text-zinc-400 text-sm max-w-sm mx-auto">
          Additional store configuration options will be available here in a future update.
        </p>
      </div>
    </div>
  )
}

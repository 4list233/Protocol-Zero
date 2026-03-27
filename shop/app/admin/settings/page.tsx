"use client"

import { useEffect, useState } from "react"
import { Settings, Plus, X, Tag, Sparkles, GripVertical, LayoutGrid } from "lucide-react"
import {
  DEFAULT_CATEGORIES,
  getCustomCategories,
  saveCustomCategory,
  removeCustomCategory,
  getAdminCategories,
} from "@/lib/admin-categories"
import { slugifyCategory } from "@/lib/categories"
import type { StorefrontSettings } from "@/lib/storefront-settings"

export default function SettingsPage() {
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Storefront settings
  const [storefrontSettings, setStorefrontSettings] = useState<StorefrontSettings>({
    newArrivalsWindowDays: 30,
    categoryDisplayOrder: [],
    rowSize: 6,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)

  // Load after mount so localStorage is available
  useEffect(() => {
    setCustomCategories(getCustomCategories())

    // Load storefront settings from API
    fetch('/api/admin/settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then(data => {
        setStorefrontSettings(data)
        setSettingsLoading(false)
      })
      .catch(() => {
        setSettingsLoading(false)
      })
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

  const saveStorefrontSettings = async (updates: Partial<StorefrontSettings>) => {
    setSettingsSaving(true)
    setSettingsMsg(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      setStorefrontSettings(data)
      setSettingsMsg("Settings saved!")
      setTimeout(() => setSettingsMsg(null), 3000)
    } catch {
      setSettingsMsg("Failed to save settings")
    } finally {
      setSettingsSaving(false)
    }
  }

  // Category order management
  const allCats = getAdminCategories()
  const orderedCats = storefrontSettings.categoryDisplayOrder.length > 0
    ? storefrontSettings.categoryDisplayOrder
    : allCats.map(slugifyCategory)

  const moveCategoryUp = (idx: number) => {
    if (idx === 0) return
    const newOrder = [...orderedCats]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    const updates = { ...storefrontSettings, categoryDisplayOrder: newOrder }
    setStorefrontSettings(updates)
    saveStorefrontSettings({ categoryDisplayOrder: newOrder })
  }

  const moveCategoryDown = (idx: number) => {
    if (idx >= orderedCats.length - 1) return
    const newOrder = [...orderedCats]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    const updates = { ...storefrontSettings, categoryDisplayOrder: newOrder }
    setStorefrontSettings(updates)
    saveStorefrontSettings({ categoryDisplayOrder: newOrder })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure your store</p>
      </div>

      {/* New Arrivals Settings */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">New Arrivals</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Control how long products appear as &ldquo;new&rdquo; on the storefront and /new-arrivals page.
            </p>
          </div>
        </div>

        {settingsLoading ? (
          <div className="text-zinc-500 text-sm">Loading settings...</div>
        ) : (
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                New Window (days)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={storefrontSettings.newArrivalsWindowDays}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setStorefrontSettings(prev => ({ ...prev, newArrivalsWindowDays: val }))
                }}
                className="w-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button
              onClick={() => saveStorefrontSettings({ newArrivalsWindowDays: storefrontSettings.newArrivalsWindowDays })}
              disabled={settingsSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {settingsSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        <p className="text-xs text-zinc-600">
          Set to 0 to disable the new arrivals feature entirely.
        </p>
      </div>

      {/* Row Size Settings */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Category Row Size</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Max products shown per category row on desktop before &ldquo;View All&rdquo;.
            </p>
          </div>
        </div>

        {!settingsLoading && (
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                Products per row (desktop)
              </label>
              <input
                type="number"
                min={2}
                max={12}
                value={storefrontSettings.rowSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 6
                  setStorefrontSettings(prev => ({ ...prev, rowSize: val }))
                }}
                className="w-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={() => saveStorefrontSettings({ rowSize: storefrontSettings.rowSize })}
              disabled={settingsSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {settingsSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        <p className="text-xs text-zinc-600">
          Tablet shows ~66% of this value, mobile always shows 2.
        </p>
      </div>

      {/* Category Display Order */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <GripVertical className="w-5 h-5 text-purple-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Category Display Order</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Drag categories to reorder how they appear on the shop page. Top = first row.
            </p>
          </div>
        </div>

        {!settingsLoading && (
          <div className="space-y-1">
            {orderedCats.map((slug, idx) => {
              const name = allCats.find(c => slugifyCategory(c) === slug) || slug
              return (
                <div
                  key={slug}
                  className="flex items-center gap-3 px-3 py-2 bg-zinc-800 rounded-lg"
                >
                  <span className="text-xs text-zinc-500 w-6 text-center font-mono">{idx + 1}</span>
                  <span className="text-sm text-white flex-1">{name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveCategoryUp(idx)}
                      disabled={idx === 0}
                      className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:text-zinc-700 transition-colors"
                    >
                      Up
                    </button>
                    <button
                      onClick={() => moveCategoryDown(idx)}
                      disabled={idx >= orderedCats.length - 1}
                      className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:text-zinc-700 transition-colors"
                    >
                      Down
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

      {/* Status message */}
      {settingsMsg && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
          settingsMsg.includes("Failed") ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        }`}>
          {settingsMsg}
        </div>
      )}
    </div>
  )
}

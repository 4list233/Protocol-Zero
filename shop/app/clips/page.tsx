"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CartDrawer } from "@/components/cart-drawer"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, Filter, Heart, MessageCircle, Share2, Calendar, Tag, Youtube, Upload, X } from "lucide-react"
import { 
  addClip as addClipToDb,
  getClips as getClipsFromDb,
  toggleLike as toggleLikeInDb,
  markClipsAsLiked,
  extractYouTubeId,
  formatTimeAgo,
  type Clip,
  type ClipTag
} from "@/lib/clips"

// Tag display config
const tagConfig: Record<ClipTag, { label: string; color: string }> = {
  speedsoft: { label: "SPEEDSOFT", color: "bg-[#3D9A6C]" },
  milsim: { label: "MILSIM", color: "bg-[#E4B100]" },
  multikill: { label: "MULTIKILL", color: "bg-red-500" },
  funny: { label: "FUNNY", color: "bg-purple-500" },
  tutorial: { label: "TUTORIAL", color: "bg-blue-500" },
  "gear-review": { label: "GEAR REVIEW", color: "bg-cyan-500" },
}

export default function ClipsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const dateFilter = searchParams.get("date")
  const [clips, setClips] = useState<Clip[]>([])
  const [filteredClips, setFilteredClips] = useState<Clip[]>([])
  const [selectedTags, setSelectedTags] = useState<ClipTag[]>([])
  const [sortBy, setSortBy] = useState<"newest" | "popular">("newest")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    youtubeUrl: "",
    tags: [] as ClipTag[],
    date: "", // Game date in YYYY-MM-DD format
  })

  // Load clips from Firebase on mount
  useEffect(() => {
    loadClips()
  }, [])

  const loadClips = async () => {
    try {
      setLoading(true)
      const fetchedClips = await getClipsFromDb()
      
      // Mark clips as liked by current user
      const clipsWithLikeStatus = user 
        ? markClipsAsLiked(fetchedClips, user.uid)
        : fetchedClips
      
      setClips(clipsWithLikeStatus)
    } catch (error) {
      console.error("Error loading clips:", error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load clips')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort clips (includes optional date filter)
  useEffect(() => {
    let filtered = [...clips]

    // Filter by date from query param if provided
    if (dateFilter) {
      filtered = filtered.filter(clip => clip.date === dateFilter)
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(clip =>
        selectedTags.some(tag => clip.tags.includes(tag))
      )
    }

    // Sort
    if (sortBy === "newest") {
      filtered.sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : a.timestamp.toMillis()
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : b.timestamp.toMillis()
        return bTime - aTime
      })
    } else {
      filtered.sort((a, b) => b.likes - a.likes)
    }

    setFilteredClips(filtered)
  }, [clips, selectedTags, sortBy, dateFilter])

  const toggleTag = (tag: ClipTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const toggleLike = async (clipId: string) => {
    if (!user) {
      alert("Please sign in to like clips")
      return
    }

    // Optimistic update
    setClips(prev =>
      prev.map(clip =>
        clip.id === clipId
          ? {
              ...clip,
              likes: clip.isLiked ? clip.likes - 1 : clip.likes + 1,
              isLiked: !clip.isLiked,
            }
          : clip
      )
    )

    try {
      await toggleLikeInDb(clipId, user.uid)
    } catch (error) {
      console.error("Error toggling like:", error)
      // Revert optimistic update on error
      loadClips()
    }
  }

  const handleUpload = async () => {
    if (!user) {
      alert("Please sign in to upload clips")
      return
    }

    const youtubeId = extractYouTubeId(uploadForm.youtubeUrl)
    if (!youtubeId) {
      alert("Please enter a valid YouTube URL")
      return
    }

    if (!uploadForm.title.trim()) {
      alert("Please enter a title")
      return
    }

    try {
      await addClipToDb({
        userId: user.uid,
        username: user.displayName || "Anonymous",
        userAvatar: user.photoURL || "/logos/logo-icon.png",
        title: uploadForm.title,
        description: uploadForm.description,
        youtubeUrl: uploadForm.youtubeUrl,
        youtubeId: youtubeId,
        tags: uploadForm.tags,
        date: uploadForm.date, // Include game date
      })

      setShowUploadModal(false)
      setUploadForm({ title: "", description: "", youtubeUrl: "", tags: [], date: "" })
      
      // Reload clips to show the new one
      loadClips()
    } catch (error) {
      console.error("Error uploading clip:", error)
      alert("Failed to upload clip. Please try again.")
    }
  }

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
            <Link href="/" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Home</Link>
            <Link href="/shop" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Shop</Link>
            <Link href="/account" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Account</Link>
            <CartDrawer />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#A1A1A1] hover:text-[#3D9A6C] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600/40 text-red-200 rounded-xl">
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-sm opacity-80">If you are deploying, ensure NEXT_PUBLIC_FIREBASE_* env vars are set.</p>
          </div>
        )}

        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="inline-block mb-2">
              <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-wide uppercase relative">
                Community Clips
                <div className="absolute -bottom-2 left-0 w-1/4 h-1 bg-[#3D9A6C] rounded-full"></div>
              </h1>
            </div>
            <p className="text-[#A1A1A1] font-body">Share your best airsoft moments with the community</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-5 py-2.5 bg-[#3D9A6C] hover:bg-[#337E59] text-black font-heading font-bold uppercase tracking-wide rounded-2xl transition-all flex items-center gap-2 shadow-glow"
          >
            <Upload className="h-4 w-4" />
            Upload Clip
          </button>
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-[#F5F5F5] hover:text-[#3D9A6C] transition-colors"
            >
              <Filter className="h-5 w-5" />
              <span className="font-heading uppercase text-sm tracking-wide">Filters</span>
              {selectedTags.length > 0 && (
                <span className="px-2 py-0.5 bg-[#3D9A6C] text-black rounded-full text-xs font-mono">
                  {selectedTags.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-[#A1A1A1] font-mono">SORT BY:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "popular")}
                className="bg-[#0D0D0D] border border-[#2C2C2C] text-[#F5F5F5] px-3 py-1.5 rounded-lg font-mono text-sm focus:border-[#3D9A6C] focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
          </div>

          {/* Tag Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-[#2C2C2C]">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(tagConfig) as ClipTag[]).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-heading uppercase tracking-wide transition-all ${
                      selectedTags.includes(tag)
                        ? `${tagConfig[tag].color} text-black`
                        : "bg-[#2C2C2C] text-[#A1A1A1] hover:bg-[#3D9A6C]/20 hover:text-[#3D9A6C]"
                    }`}
                  >
                    {tagConfig[tag].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clips Feed */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#3D9A6C] border-r-transparent"></div>
              <p className="text-[#A1A1A1] font-body mt-4">Loading clips...</p>
            </div>
          ) : filteredClips.length === 0 ? (
            <div className="text-center py-12 bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl">
              <p className="text-[#A1A1A1] font-body mb-2">No clips found matching your filters</p>
              <button
                onClick={() => setSelectedTags([])}
                className="text-[#3D9A6C] hover:underline text-sm font-medium"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredClips.map((clip) => (
              <div key={clip.id} className="bg-[#1E1E1E] border-2 border-[#2C2C2C] rounded-2xl overflow-hidden hover:border-[#3D9A6C]/30 transition-all shadow-card">
                {/* Clip Header */}
                <div className="p-4 border-b border-[#2C2C2C]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={clip.userAvatar}
                        alt={clip.username}
                        className="w-10 h-10 rounded-full border-2 border-[#3D9A6C]"
                      />
                      <div>
                        <h3 className="font-body font-semibold text-[#F5F5F5]">{clip.username}</h3>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1A1] font-mono">
                          <Calendar className="h-3 w-3" />
                          {formatTimeAgo(clip.timestamp instanceof Date ? clip.timestamp : clip.timestamp.toDate())}
                        </div>
                      </div>
                    </div>
                    <button className="text-[#A1A1A1] hover:text-[#3D9A6C] transition-colors">
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Clip Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h2 className="text-xl font-heading font-bold text-[#F5F5F5] mb-2">{clip.title}</h2>
                    <p className="text-[#A1A1A1] font-body text-sm">{clip.description}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {clip.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-1 ${tagConfig[tag].color} text-black text-xs font-heading uppercase tracking-wide rounded-full`}
                      >
                        {tagConfig[tag].label}
                      </span>
                    ))}
                  </div>

                  {/* YouTube Embed */}
                  <div className="aspect-video bg-[#0D0D0D] rounded-xl overflow-hidden border border-[#2C2C2C]">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${clip.youtubeId}`}
                      title={clip.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    ></iframe>
                  </div>
                </div>

                {/* Clip Actions */}
                <div className="px-4 py-3 border-t border-[#2C2C2C] flex items-center gap-4">
                  <button
                    onClick={() => toggleLike(clip.id)}
                    className={`flex items-center gap-2 transition-colors ${
                      clip.isLiked ? "text-red-500" : "text-[#A1A1A1] hover:text-red-500"
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${clip.isLiked ? "fill-current" : ""}`} />
                    <span className="font-mono text-sm font-semibold">{clip.likes}</span>
                  </button>
                  <button className="flex items-center gap-2 text-[#A1A1A1] hover:text-[#3D9A6C] transition-colors">
                    <MessageCircle className="h-5 w-5" />
                    <span className="font-mono text-sm font-semibold">{clip.comments}</span>
                  </button>
                  <a
                    href={clip.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-2 text-[#A1A1A1] hover:text-red-600 transition-colors"
                  >
                    <Youtube className="h-5 w-5" />
                    <span className="font-mono text-xs uppercase">Watch on YouTube</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border-2 border-[#3D9A6C] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#1E1E1E] border-b border-[#2C2C2C] p-4 flex items-center justify-between">
              <h2 className="text-2xl font-heading font-bold uppercase tracking-wide text-[#F5F5F5]">Upload Clip</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#A1A1A1] hover:text-[#3D9A6C] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {!user && (
                <div className="p-4 bg-[#E4B100]/10 border border-[#E4B100]/30 rounded-xl">
                  <p className="text-[#E4B100] text-sm font-body">
                    You need to <Link href="/auth/signin" className="underline font-semibold">sign in</Link> to upload clips
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-heading uppercase tracking-wide text-[#F5F5F5] mb-2">
                  YouTube URL *
                </label>
                <input
                  type="url"
                  value={uploadForm.youtubeUrl}
                  onChange={(e) => setUploadForm({ ...uploadForm, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[#0D0D0D] border border-[#2C2C2C] text-[#F5F5F5] px-4 py-3 rounded-xl font-mono text-sm focus:border-[#3D9A6C] focus:outline-none placeholder-[#A1A1A1]"
                  disabled={!user}
                />
              </div>

              <div>
                <label className="block text-sm font-heading uppercase tracking-wide text-[#F5F5F5] mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="Give your clip an epic title"
                  className="w-full bg-[#0D0D0D] border border-[#2C2C2C] text-[#F5F5F5] px-4 py-3 rounded-xl font-body focus:border-[#3D9A6C] focus:outline-none placeholder-[#A1A1A1]"
                  disabled={!user}
                />
              </div>

              <div>
                <label className="block text-sm font-heading uppercase tracking-wide text-[#F5F5F5] mb-2">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Tell us about this moment..."
                  rows={4}
                  className="w-full bg-[#0D0D0D] border border-[#2C2C2C] text-[#F5F5F5] px-4 py-3 rounded-xl font-body focus:border-[#3D9A6C] focus:outline-none placeholder-[#A1A1A1] resize-none"
                  disabled={!user}
                />
              </div>

              <div>
                <label className="block text-sm font-heading uppercase tracking-wide text-[#F5F5F5] mb-2">
                  Game Date (Optional)
                </label>
                <input
                  type="date"
                  value={uploadForm.date}
                  onChange={(e) => setUploadForm({ ...uploadForm, date: e.target.value })}
                  className="w-full bg-[#0D0D0D] border border-[#2C2C2C] text-[#F5F5F5] px-4 py-3 rounded-xl font-mono text-sm focus:border-[#3D9A6C] focus:outline-none"
                  disabled={!user}
                />
                <p className="text-xs text-[#A1A1A1] mt-1">Select the game day this clip is from</p>
              </div>

              <div>
                <label className="block text-sm font-heading uppercase tracking-wide text-[#F5F5F5] mb-2">
                  <Tag className="inline h-4 w-4 mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(tagConfig) as ClipTag[]).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setUploadForm({
                          ...uploadForm,
                          tags: uploadForm.tags.includes(tag)
                            ? uploadForm.tags.filter((t) => t !== tag)
                            : [...uploadForm.tags, tag],
                        })
                      }
                      className={`px-3 py-2 rounded-full text-xs font-heading uppercase tracking-wide transition-all ${
                        uploadForm.tags.includes(tag)
                          ? `${tagConfig[tag].color} text-black`
                          : "bg-[#2C2C2C] text-[#A1A1A1] hover:bg-[#3D9A6C]/20 hover:text-[#3D9A6C]"
                      }`}
                      disabled={!user}
                    >
                      {tagConfig[tag].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-[#1E1E1E] border-t border-[#2C2C2C] p-4 flex gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-3 bg-[#2C2C2C] hover:bg-[#3D9A6C]/20 text-[#F5F5F5] font-heading uppercase tracking-wide rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!user || !uploadForm.youtubeUrl || !uploadForm.title}
                className="flex-1 px-4 py-3 bg-[#3D9A6C] hover:bg-[#337E59] text-black font-heading font-bold uppercase tracking-wide rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Clip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

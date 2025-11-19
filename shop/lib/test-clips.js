// Test script for clips functionality
// Run this in browser console on /clips page after signing in

// Test data for adding clips
const testClips = [
  {
    title: "Epic 10-Kill Streak on Saturday Night",
    description: "Absolutely dominated the field during our Saturday MilSim event. The team coordination was perfect!",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    tags: ["milsim", "multikill"],
  },
  {
    title: "Speedsoft Tips for Beginners",
    description: "Quick tutorial on improving your speedsoft gameplay. Movement is everything!",
    youtubeUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    tags: ["speedsoft", "tutorial"],
  },
  {
    title: "Funny Moments Compilation #1",
    description: "All the hilarious fails and epic moments from last month 😂",
    youtubeUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
    tags: ["funny"],
  },
  {
    title: "New Gear Review: KRYTAC MKII",
    description: "Full review of the KRYTAC MKII CRB. This thing is a beast!",
    youtubeUrl: "https://www.youtube.com/watch?v=XqZsoesa55w",
    tags: ["gear-review"],
  },
]

// Function to add test clips
async function addTestClips() {
  const { addClip } = await import('./lib/clips')
  const { user } = await import('./lib/auth-context')
  
  if (!user) {
    console.error("❌ Please sign in first!")
    return
  }
  
  console.log("🚀 Adding test clips...")
  
  for (const clip of testClips) {
    try {
      const clipId = await addClip({
        userId: user.uid,
        username: user.displayName || "Test User",
        userAvatar: user.photoURL || "/logos/logo-icon.png",
        ...clip,
        youtubeId: extractYouTubeId(clip.youtubeUrl),
      })
      console.log(`✅ Added: ${clip.title} (ID: ${clipId})`)
    } catch (error) {
      console.error(`❌ Failed to add: ${clip.title}`, error)
    }
  }
  
  console.log("🎉 Test clips added! Refresh the page to see them.")
}

function extractYouTubeId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[7].length === 11 ? match[7] : null
}

// To use: Copy this entire file content and paste in browser console, then run:
// addTestClips()

# Firebase Clips Setup Guide

This guide will help you set up Firebase Firestore and Storage for the clips feature.

## 📋 Prerequisites

- Firebase project created (you already have this)
- Firebase credentials in `.env.local`

## 🔥 Firebase Configuration

### Step 1: Enable Firestore

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`protocolz-e05fe`)
3. Click **Firestore Database** in the left sidebar
4. Click **Create database**
5. Choose **Start in production mode** (we'll add security rules later)
6. Select your location (choose closest to your users)
7. Click **Enable**

### Step 2: Enable Storage

1. In Firebase Console, click **Storage** in the left sidebar
2. Click **Get started**
3. Accept the default security rules for now
4. Choose the same location as Firestore
5. Click **Done**

### Step 3: Set up Firestore Security Rules

1. Go to **Firestore Database** → **Rules**
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Clips collection
    match /clips/{clipId} {
      // Anyone can read clips
      allow read: if true;
      
      // Only authenticated users can create clips
      allow create: if isAuthenticated() 
                    && request.resource.data.userId == request.auth.uid;
      
      // Only clip owner can update/delete
      allow update, delete: if isOwner(resource.data.userId);
    }
    
    // Comments subcollection (for future implementation)
    match /clips/{clipId}/comments/{commentId} {
      allow read: if true;
      allow create: if isAuthenticated();
      allow update, delete: if isOwner(resource.data.userId);
    }
  }
}
```

3. Click **Publish**

### Step 4: Set up Storage Security Rules

1. Go to **Storage** → **Rules**
2. Replace the rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Clips folder - videos and thumbnails
    match /clips/{userId}/{fileName} {
      // Anyone can read
      allow read: if true;
      
      // Only authenticated user can upload to their own folder
      allow write: if request.auth != null 
                   && request.auth.uid == userId;
    }
    
    match /clips/thumbnails/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish**

## 📊 Firestore Data Structure

### Clips Collection (`clips`)

```typescript
{
  id: string (auto-generated document ID)
  userId: string (Firebase Auth UID)
  username: string (display name)
  userAvatar: string (photo URL)
  title: string
  description: string
  youtubeUrl: string (full URL)
  youtubeId: string (extracted ID)
  tags: string[] (array of tag IDs)
  likes: number
  likedBy: string[] (array of user IDs)
  comments: number
  timestamp: Timestamp (server timestamp)
  videoFile?: string (optional - storage path if uploaded)
}
```

### Indexes (for better query performance)

1. Go to **Firestore Database** → **Indexes**
2. Click **Create index**
3. Create this composite index:
   - Collection ID: `clips`
   - Fields to index:
     - `timestamp` (Descending)
     - `__name__` (Ascending)
   - Query scope: **Collection**

## 🎯 Available Tag Types

The following tags are available for clips:

- `speedsoft` - High-speed gameplay
- `milsim` - Military simulation
- `multikill` - Multiple kills in quick succession
- `funny` - Comedy/entertainment
- `tutorial` - How-to and educational
- `gear-review` - Equipment reviews

## 🚀 Usage Examples

### Uploading a Clip

```typescript
import { addClip } from '@/lib/clips'

await addClip({
  userId: user.uid,
  username: user.displayName || 'Anonymous',
  userAvatar: user.photoURL || '/default-avatar.png',
  title: 'My Awesome Clip',
  description: 'Check out this gameplay!',
  youtubeUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
  youtubeId: 'VIDEO_ID',
  tags: ['speedsoft', 'multikill'],
})
```

### Fetching Clips

```typescript
import { getClips, markClipsAsLiked } from '@/lib/clips'

// Get all clips
const clips = await getClips()

// Get clips filtered by tags
const speedsoftClips = await getClips(['speedsoft'])

// Mark clips as liked by current user
const clipsWithLikeStatus = markClipsAsLiked(clips, user.uid)
```

### Liking/Unliking a Clip

```typescript
import { toggleLike } from '@/lib/clips'

const { liked, newLikeCount } = await toggleLike(clipId, user.uid)
```

### Uploading Video Files (Optional)

If you want to allow users to upload video files directly instead of YouTube links:

```typescript
import { uploadClipVideo } from '@/lib/clips'

const { downloadURL, storagePath } = await uploadClipVideo(videoFile, user.uid)

// Then include storagePath in clip data
await addClip({
  // ... other fields
  videoFile: storagePath,
})
```

## 📝 Storage Limits

**Free Tier (Spark Plan):**
- Storage: 5 GB
- Downloads: 1 GB/day

**Paid Tier (Blaze Plan):**
- Storage: $0.026/GB/month
- Downloads: $0.12/GB

For a clips-focused platform, consider:
- Using YouTube embeds (free, unlimited)
- Limit uploaded video file sizes (recommend 50-100 MB max)
- Implement video compression before upload
- Use thumbnails instead of full video previews

## 🔒 Best Practices

1. **Validate on client and server**: Always validate YouTube URLs client-side before submission
2. **Rate limiting**: Implement rate limiting to prevent spam (consider Cloud Functions)
3. **Content moderation**: Add reporting/flagging system for inappropriate content
4. **Optimize queries**: Use Firestore pagination for large datasets
5. **Cache data**: Use React Query or SWR for caching and optimistic updates
6. **Monitor usage**: Check Firebase Console regularly for usage patterns

## 🐛 Troubleshooting

### "Permission denied" errors

- Check that security rules are published
- Verify user is authenticated (`user != null`)
- Ensure user ID matches the document owner

### Clips not loading

- Check browser console for errors
- Verify Firebase config in `.env.local`
- Test Firestore connection in Firebase Console

### Upload failures

- Check file size limits (Firebase has 32 MB limit for uploads)
- Verify Storage bucket is enabled
- Check Storage security rules

## 📚 Additional Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Storage Documentation](https://firebase.google.com/docs/storage)
- [Security Rules Guide](https://firebase.google.com/docs/rules)
- [Firebase Pricing](https://firebase.google.com/pricing)

## 🎉 You're All Set!

Your clips system is now ready to use! Users can:
- ✅ Upload YouTube video links
- ✅ Tag clips with categories
- ✅ Like and interact with clips
- ✅ Filter clips by tags
- ✅ Sort by newest or most popular
- ✅ View clips in a beautiful feed

Next steps:
1. Add comments system
2. Implement user profiles
3. Add sharing functionality
4. Set up moderation tools

# Database Schema Reference

## Tables Overview

### 👤 User
Stores user profile information.

```typescript
{
  id: string           // Unique identifier (cuid)
  name: string?        // Display name
  username: string?    // Unique username (for profile URLs)
  email: string?       // Unique email address
  emailVerified: Date? // Email verification timestamp
  image: string?       // Profile picture URL
}
```

**Relations:**
- `accounts[]` - Connected OAuth accounts (Google, etc.)
- `sessions[]` - Active user sessions
- `posts[]` - Video clips posted by user
- `comments[]` - Comments made by user
- `playDates[]` - Game day check-ins by user

---

### 🔐 Account
OAuth account connections (managed by NextAuth).

```typescript
{
  id: string                // Unique identifier
  userId: string            // References User.id
  type: string              // Account type (oauth, email, etc.)
  provider: string          // OAuth provider (google, github, etc.)
  providerAccountId: string // Provider's user ID
  refresh_token: string?    // OAuth refresh token
  access_token: string?     // OAuth access token
  expires_at: number?       // Token expiration timestamp
  token_type: string?       // Token type (Bearer, etc.)
  scope: string?            // OAuth scopes
  id_token: string?         // OpenID Connect ID token
  session_state: string?    // OAuth session state
}
```

**Unique Constraint:** `[provider, providerAccountId]`

---

### 🎫 Session
Active user sessions (managed by NextAuth).

```typescript
{
  id: string           // Unique identifier
  sessionToken: string // Unique session token
  userId: string       // References User.id
  expires: Date        // Session expiration
}
```

**Unique Constraint:** `sessionToken`

---

### ✉️ VerificationToken
Email verification tokens (managed by NextAuth).

```typescript
{
  identifier: string // User identifier (email)
  token: string      // Unique verification token
  expires: Date      // Token expiration
}
```

**Unique Constraint:** `[identifier, token]`

---

### 🎬 Post
Video clip posts shared by users.

```typescript
{
  id: string        // Unique identifier
  createdAt: Date   // Post creation timestamp (auto)
  title: string     // Clip title
  videoUrl: string  // Vercel Blob storage URL
  authorId: string  // References User.id
  likeCount: number // Number of likes (default: 0)
}
```

**Relations:**
- `author` - User who posted the clip
- `comments[]` - Comments on this clip

**Future Enhancements:**
- Add `tags[]` for player tagging
- Add `likes[]` relation for tracking who liked
- Add `description` field
- Add `thumbnailUrl` field

---

### 💬 Comment
Comments on video clips.

```typescript
{
  id: string        // Unique identifier
  createdAt: Date   // Comment creation timestamp (auto)
  text: string      // Comment content
  authorId: string  // References User.id
  postId: string    // References Post.id
}
```

**Relations:**
- `author` - User who wrote the comment
- `post` - Post the comment is on

**Future Enhancements:**
- Add reply functionality (parent comment reference)
- Add like counts

---

### 📅 PlayDate
"When We Play" scheduler check-ins.

```typescript
{
  id: string        // Unique identifier
  playDate: Date    // Game day (date only, no time)
  userId: string    // References User.id
  guestCount: number // Number of guests user is bringing (default: 0)
}
```

**Relations:**
- `user` - User who checked in

**Unique Constraint:** `[playDate, userId]` - Users can only check in once per day

**Usage Example:**
```typescript
// User checks in for Saturday with 2 guests
{
  playDate: "2025-10-18",
  userId: "clx123abc",
  guestCount: 2
}

// Total players for that day = count of records + sum of guestCounts
```

---

## Common Queries

### Get User with Clips
```typescript
const user = await prisma.user.findUnique({
  where: { username: "playername" },
  include: {
    posts: {
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
})
```

### Get Clips Feed
```typescript
const clips = await prisma.post.findMany({
  orderBy: { createdAt: 'desc' },
  include: {
    author: {
      select: { name: true, username: true, image: true }
    },
    comments: {
      include: { author: true },
      orderBy: { createdAt: 'desc' }
    }
  },
  take: 20
})
```

### Get Play Schedule
```typescript
const playDates = await prisma.playDate.findMany({
  where: {
    playDate: {
      gte: new Date() // Only future dates
    }
  },
  include: { user: true },
  orderBy: { playDate: 'asc' }
})

// Group by date and calculate totals
const schedule = playDates.reduce((acc, pd) => {
  const date = pd.playDate.toISOString()
  if (!acc[date]) {
    acc[date] = { players: 0, guests: 0 }
  }
  acc[date].players += 1
  acc[date].guests += pd.guestCount
  return acc
}, {})
```

### Create Clip with Comment
```typescript
const newClip = await prisma.post.create({
  data: {
    title: "Epic Headshot",
    videoUrl: "blob-url-from-vercel",
    authorId: userId,
    comments: {
      create: {
        text: "First comment!",
        authorId: userId
      }
    }
  },
  include: {
    author: true,
    comments: true
  }
})
```

### Check In for Game Day
```typescript
const checkIn = await prisma.playDate.upsert({
  where: {
    playDate_userId: {
      playDate: new Date("2025-10-20"),
      userId: userId
    }
  },
  update: {
    guestCount: 3 // Update guest count
  },
  create: {
    playDate: new Date("2025-10-20"),
    userId: userId,
    guestCount: 3
  }
})
```

---

## Schema Evolution Tips

When adding new features, you may want to:

1. **Add tagging to clips**: Create a `Tag` model and `PostTag` join table
2. **Add likes**: Create a `Like` model with `userId` and `postId`
3. **Add replies**: Add `parentId` to `Comment` for nested comments
4. **Add notifications**: Create a `Notification` model
5. **Add user social links**: Add fields to `User` model (youtube, instagram, etc.)

After any schema changes:
```bash
npx prisma migrate dev --name descriptive_name
npx prisma generate
```

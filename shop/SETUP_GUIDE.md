# Protocol Zero: Connect - Setup Guide

## ✅ Completed Steps

### 1. Database & ORM Setup - COMPLETE
- ✅ Prisma and @prisma/client installed
- ✅ Database schema defined in `prisma/schema.prisma`
- ✅ Initial migration created and applied successfully
- ✅ Database tables created in Neon PostgreSQL:
  - `User` - User profiles
  - `Account` - OAuth account connections
  - `Session` - User sessions
  - `VerificationToken` - Email verification
  - `Post` - Video clips
  - `Comment` - Clip comments
  - `PlayDate` - "When We Play" scheduler entries

### 2. Dependencies Installed
- ✅ Prisma ORM
- ✅ NextAuth.js v5 (beta) with Prisma adapter
- ✅ Vercel Blob for video storage
- ✅ All UI components (Radix UI)

## 🚀 Next Steps

### Step 1: Configure NextAuth.js

Create the authentication configuration:

1. **Create auth configuration file** (`lib/auth.ts` or `app/api/auth/[...nextauth]/route.ts`)
2. **Add environment variables to `.env`**:
   ```env
   # Add these to your existing .env file
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-here  # Generate with: openssl rand -base64 32
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

3. **Set up Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### Step 2: Configure Vercel Blob Storage

1. **Add to `.env`**:
   ```env
   BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
   ```

2. **Get token from Vercel**:
   - Go to your Vercel project dashboard
   - Navigate to Storage → Create → Blob
   - Copy the `BLOB_READ_WRITE_TOKEN`

### Step 3: Create Core Application Files

Priority order for implementation:

#### A. Authentication Setup (HIGH PRIORITY)
```
lib/
  auth.ts              # NextAuth configuration
  prisma.ts            # Prisma client singleton
app/api/
  auth/
    [...nextauth]/
      route.ts         # NextAuth API routes
```

#### B. Homepage Dashboard
```
app/page.tsx           # Main dashboard (already exists)
components/
  when-we-play-scheduler.tsx
  top-clips-feed.tsx
  featured-shop-items.tsx
```

#### C. Clips System
```
app/clips/
  page.tsx             # Clips feed
  [id]/
    page.tsx           # Individual clip view
components/
  clip-upload-form.tsx
  clip-player.tsx
  clip-card.tsx
  comment-section.tsx
```

#### D. User Profile & Account
```
app/account/
  page.tsx             # User account settings
app/profile/
  [username]/
    page.tsx           # Public user profile
components/
  profile-editor.tsx
  social-links-editor.tsx
```

#### E. API Routes
```
app/api/
  clips/
    route.ts           # POST new clip, GET all clips
    [id]/
      route.ts         # GET, PATCH, DELETE specific clip
  comments/
    route.ts           # POST new comment
  playdates/
    route.ts           # POST, GET playdates
  upload/
    route.ts           # Handle video upload to Vercel Blob
```

### Step 4: Database Helpers

Create utility functions for database operations:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Step 5: Environment Variables Checklist

Your `.env` file should contain:
```env
# Database (ALREADY CONFIGURED)
DATABASE_URL=postgresql://...

# NextAuth (NEED TO ADD)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-this>

# OAuth Providers (NEED TO ADD)
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# Vercel Blob (NEED TO ADD)
BLOB_READ_WRITE_TOKEN=<from-vercel>
```

## 📋 Development Workflow

### Running the Development Server
```bash
npm run dev
```

### Working with the Database
```bash
# View database in Prisma Studio
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name description_of_changes

# Reset database (caution: deletes all data)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

### Useful Commands
```bash
# Check Prisma schema formatting
npx prisma format

# Validate schema without connecting to DB
npx prisma validate

# Pull schema from database
npx prisma db pull
```

## 🎯 Feature Implementation Priority

1. **Phase 1: Authentication** (Current Priority)
   - Set up NextAuth with Google provider
   - Create login/logout functionality
   - Implement protected routes

2. **Phase 2: "When We Play" Scheduler**
   - Build calendar/scheduler component
   - Add check-in functionality
   - Display player counts

3. **Phase 3: Clips System**
   - Video upload to Vercel Blob
   - Clips feed page
   - Video player with premium viewer
   - Commenting system

4. **Phase 4: User Profiles**
   - Account settings page
   - Public profile pages
   - Social media links

5. **Phase 5: Polish & Deploy**
   - Mobile responsiveness
   - Loading states
   - Error handling
   - Deploy to Vercel

## 🔧 Troubleshooting

### Database Connection Issues
If you encounter database connection problems:
```bash
# Test connection
npx prisma db push

# Check environment variables are loaded
echo $DATABASE_URL
```

### Prisma Client Issues
If Prisma Client is out of sync:
```bash
npx prisma generate
```

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js v5 Documentation](https://authjs.dev)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Components](https://www.radix-ui.com/primitives)

## 🎉 Current Status

**✅ DATABASE MIGRATION SUCCESSFUL!**

The roadblock has been resolved. The issue was simply that Prisma wasn't installed in the project. After installing `prisma` and `@prisma/client`, the migration ran successfully and all tables are now created in your Neon database.

You're now ready to move forward with implementing authentication and the core features!

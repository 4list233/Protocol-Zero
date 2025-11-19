# Authentication Setup Guide

## Overview
Protocol Zero: Connect uses NextAuth.js v5 with Google and Instagram OAuth providers.

## 🔐 Configure Google OAuth

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google+ API**

### 2. Create OAuth Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - **Name:** Protocol Zero Connect
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (development)
     - `http://localhost:3001` (backup port)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/auth/callback/google`
     - `http://localhost:3001/api/auth/callback/google`
     - `https://yourdomain.com/api/auth/callback/google`
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 3. Add to Environment Variables
Add to your `.env` file:
```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

## 📸 Configure Instagram OAuth

### 1. Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** > **Create App**
3. Choose **Consumer** type
4. Fill in app details

### 2. Add Instagram Basic Display
1. In your app dashboard, click **Add Product**
2. Find **Instagram Basic Display** and click **Set Up**
3. Click **Create New App**
4. Fill in the required fields

### 3. Configure Instagram OAuth
1. Go to **Instagram Basic Display** > **Basic Display**
2. Add **OAuth Redirect URIs:**
   - `http://localhost:3000/api/auth/callback/instagram`
   - `http://localhost:3001/api/auth/callback/instagram`
   - `https://yourdomain.com/api/auth/callback/instagram`
3. Add **Deauthorize Callback URL:** `https://yourdomain.com/api/auth/deauthorize`
4. Add **Data Deletion Request URL:** `https://yourdomain.com/api/auth/delete`
5. Save changes

### 4. Get Instagram Credentials
1. Go to **App Settings** > **Basic**
2. Copy **App ID** (this is your Client ID)
3. Copy **App Secret** (this is your Client Secret)

### 5. Add to Environment Variables
Add to your `.env` file:
```bash
INSTAGRAM_CLIENT_ID=your_instagram_app_id_here
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret_here
```

## 🔑 Generate NextAuth Secret

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

Add to your `.env` file:
```bash
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=http://localhost:3000
```

For production:
```bash
NEXTAUTH_URL=https://yourdomain.com
```

## 📝 Complete .env File Example

Your `.env` file should have:
```bash
# Database
DATABASE_URL=your_postgres_connection_string

# NextAuth
NEXTAUTH_SECRET=your_generated_secret_32_chars
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijk123456789

# Instagram OAuth
INSTAGRAM_CLIENT_ID=1234567890123456
INSTAGRAM_CLIENT_SECRET=abcdef1234567890abcdef1234567890

# Vercel Blob (for clips)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## ✅ Testing Authentication

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test Sign In
1. Go to http://localhost:3000/auth/signin
2. Click "Continue with Google"
3. Sign in with your Google account
4. You should be redirected to the homepage
5. Click "Account" in the navigation to see your profile

### 3. Check Database
After signing in, check your database:
```bash
npx prisma studio
```

You should see:
- New record in `User` table
- New record in `Account` table
- New record in `Session` table

## 🎯 Using Authentication in Your App

### Get Current User (Server Component)
```typescript
import { auth } from "@/lib/auth"

export default async function Page() {
  const session = await auth()
  
  if (!session?.user) {
    // User not signed in
    return <div>Please sign in</div>
  }
  
  return <div>Hello {session.user.name}!</div>
}
```

### Protect Routes (Server Component)
```typescript
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProtectedPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }
  
  return <div>Protected content</div>
}
```

### Sign Out
```typescript
import { signOut } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export default function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/" })
      }}
    >
      <Button type="submit">Sign Out</Button>
    </form>
  )
}
```

## 🚨 Important Security Notes

1. **Never commit** your `.env` file to git
2. **Rotate credentials** if they're ever exposed
3. **Use different credentials** for development and production
4. **Enable 2FA** on your Google Cloud and Facebook accounts
5. **Regularly review** connected accounts and permissions

## 📚 Additional Resources

- [NextAuth.js Documentation](https://authjs.dev/)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Instagram Basic Display](https://developers.facebook.com/docs/instagram-basic-display-api)
- [Prisma Adapter](https://authjs.dev/reference/adapter/prisma)

## 🆘 Troubleshooting

### "Callback URL mismatch" error
- Make sure redirect URIs in Google/Instagram match exactly
- Check for trailing slashes
- Verify port numbers (3000 vs 3001)

### "Invalid credentials" error
- Double-check Client ID and Secret in `.env`
- Make sure there are no extra spaces
- Restart dev server after changing `.env`

### User not saving to database
- Check Prisma connection: `npx prisma db push`
- Verify `DATABASE_URL` is correct
- Check database logs for errors

### Session not persisting
- Verify `NEXTAUTH_SECRET` is set
- Clear browser cookies
- Check `NEXTAUTH_URL` matches your domain

## ✨ Current Status

✅ Database schema ready (User, Account, Session tables)
✅ NextAuth.js configured with Google + Instagram
✅ Sign-in page created (`/auth/signin`)
✅ Account page created (`/account`)
✅ Protected route example

⚠️ **To Complete Setup:**
1. Create Google OAuth credentials
2. Create Instagram OAuth credentials (optional)
3. Add credentials to `.env` file
4. Generate and add `NEXTAUTH_SECRET`
5. Test sign-in flow

Once configured, users will be able to:
- Sign in with Google or Instagram
- View their profile at `/account`
- Access protected features
- Upload clips and participate in community features

# Firebase Authentication - Quick Setup

## ✅ What's Ready

I've created all the Firebase authentication files for you:

1. `/lib/firebase.ts` - Firebase initialization
2. `/lib/auth-context.tsx` - React context for auth state
3. `/app/auth/signin/firebase-page.tsx` - Sign-in page
4. `/app/account/firebase-page.tsx` - Account/profile page
5. `FIREBASE_AUTH_SETUP.md` - Complete setup guide

## 🚀 Quick Setup (10 minutes)

### Step 1: Install Firebase
```bash
npm install firebase
```

### Step 2: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Name it: "Protocol Zero Connect"
4. Click "Create Project"

### Step 3: Register Web App
1. Click the Web icon (`</>`)
2. Name it: "Protocol Zero Shop"
3. Copy the config object

### Step 4: Enable Google Sign-In
1. Go to **Authentication** > **Sign-in method**
2. Click **Google** > Toggle **Enable**
3. Set support email
4. Click **Save**

### Step 5: Add Config to .env.local
Create `.env.local` with your Firebase config:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 6: Update app/layout.tsx
Wrap your app with the AuthProvider:

```tsx
import { AuthProvider } from '@/lib/auth-context'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

### Step 7: Switch to Firebase Pages
Rename the files to activate Firebase auth:

```bash
# Backup old pages
mv app/auth/signin/page.tsx app/auth/signin/page.nextauth.tsx.bak
mv app/account/page.tsx app/account/page.nextauth.tsx.bak

# Activate Firebase pages
mv app/auth/signin/firebase-page.tsx app/auth/signin/page.tsx
mv app/account/firebase-page.tsx app/account/page.tsx
```

### Step 8: Test!
```bash
npm run dev
```

Then visit:
- http://localhost:3000/auth/signin - Sign in page
- http://localhost:3000/account - Account page (redirects if not signed in)

## 🎯 What Users Can Do

✅ Sign in with Google (one click!)
✅ Sign in with Instagram/Facebook (if enabled)
✅ View their profile at `/account`
✅ See their email, name, photo
✅ Sign out securely
✅ Stay signed in across page reloads

## 📱 How It Works

1. User clicks "Continue with Google"
2. Firebase shows Google sign-in popup
3. User signs in with Google account
4. Firebase returns user info
5. User is redirected to homepage
6. Auth state is saved (persists across reloads)

## 🔄 Migration from NextAuth

If you want to keep using NextAuth instead:
- Just don't rename the files
- Both implementations are ready
- Choose whichever you prefer!

**Firebase Pros:**
- ✅ Faster setup (10 min vs 1 hour)
- ✅ No redirect URL configuration
- ✅ Built-in UI components
- ✅ Auto token refresh
- ✅ Firebase Console for user management

**NextAuth Pros:**
- ✅ More control over auth flow
- ✅ Works server-side
- ✅ Integrates with Prisma directly
- ✅ More customizable

## 🆘 Troubleshooting

### Firebase not defined
- Run `npm install firebase`
- Restart dev server

### Auth not working
- Check all env vars are in `.env.local`
- Verify Firebase config is correct
- Check browser console for errors

### Popup blocked
- Allow popups for localhost
- Or use redirect mode instead

### "Unauthorized domain"
- Add `localhost` to Authorized domains in Firebase Console

## 📚 Next Steps

After authentication works:
1. ✅ Test sign-in flow
2. ✅ Test sign-out
3. Add user profiles (store extra data)
4. Add email verification (optional)
5. Add role-based access
6. Connect to your Prisma database

---

**Ready to set it up? Follow the steps above and you'll have working authentication in 10 minutes!** 🚀

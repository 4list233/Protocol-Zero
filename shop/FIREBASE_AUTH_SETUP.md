# Firebase Authentication Setup Guide

## 🔥 Why Firebase?

Firebase Authentication is much easier than manual OAuth setup:
- ✅ No need to configure OAuth redirect URLs
- ✅ Built-in UI components
- ✅ Handles token management automatically
- ✅ Works with Google, Instagram, Facebook, Twitter, GitHub, and more
- ✅ Free tier is very generous
- ✅ Simple configuration in Firebase Console

## 📋 Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Name it: `Protocol Zero Connect`
4. Disable Google Analytics (optional)
5. Click **Create Project**

### 2. Register Your Web App

1. In your Firebase project, click the **Web** icon (`</>`)
2. Register app name: `Protocol Zero Shop`
3. ✅ Check "Also set up Firebase Hosting" (optional)
4. Click **Register app**
5. **Copy the Firebase config** - you'll need this!

It will look like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijk"
};
```

### 3. Enable Authentication Methods

1. In Firebase Console, go to **Authentication**
2. Click **Get Started**
3. Go to **Sign-in method** tab
4. Enable the providers you want:

#### Enable Google Sign-In
1. Click **Google**
2. Toggle **Enable**
3. Set project support email
4. Click **Save**

#### Enable Instagram Sign-In
1. Click **Facebook** (Instagram uses Facebook Auth)
2. Toggle **Enable**
3. You'll need:
   - Facebook App ID
   - Facebook App Secret
4. Follow the link to create a Facebook app
5. Click **Save**

#### Other Providers (Optional)
- **Email/Password**: Simple username/password auth
- **Anonymous**: For guest users
- **GitHub**: Great for developer communities
- **Twitter**: Social login

### 4. Configure Authorized Domains

1. Still in **Authentication** > **Settings** tab
2. Scroll to **Authorized domains**
3. Add your domains:
   - `localhost` (already added)
   - `yourdomain.com` (for production)

### 5. Install Firebase in Your Project

Run:
```bash
npm install firebase
```

### 6. Add Firebase Config to Environment Variables

Create/update `.env.local`:
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdefghijk
```

**Note:** These are all `NEXT_PUBLIC_` because they're safe to expose on the client side.

### 7. (Optional) Set up Firebase Admin SDK

For server-side operations, create a service account:

1. Go to **Project Settings** > **Service Accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. **DO NOT COMMIT THIS FILE TO GIT**
5. Add to `.env` (not `.env.local`):
```bash
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

## 🚀 Quick Start (After Setup)

Once you've completed the steps above:

1. **Add your Firebase config to `.env.local`**
2. **Restart your dev server:**
   ```bash
   npm run dev
   ```
3. **Test authentication:**
   - Go to http://localhost:3000/auth/signin
   - Click "Continue with Google"
   - Sign in with your Google account
   - You're authenticated! 🎉

## 📱 What You Get

With Firebase Authentication, users can:
- ✅ Sign in with Google (one click!)
- ✅ Sign in with Instagram/Facebook
- ✅ Stay signed in across sessions
- ✅ Access protected pages
- ✅ See their profile at `/account`
- ✅ Sign out securely

## 🔒 Security Features

Firebase provides:
- Automatic token refresh
- Secure session management
- Built-in rate limiting
- Account linking (merge multiple auth methods)
- Email verification
- Password reset flows
- Multi-factor authentication (optional)

## 💰 Pricing

**Free Tier Includes:**
- 10,000 phone authentications/month
- Unlimited email/password, Google, Facebook, etc.
- Perfect for getting started!

**Paid Tier:** Only needed for:
- More than 10k phone auth/month
- Advanced features like multi-tenancy

## 📚 Firebase Console Features

You can see in real-time:
- Number of users
- Sign-in methods used
- User activity
- Authentication logs
- Manage users (delete, disable, etc.)

## 🆘 Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to Authorized domains in Firebase Console
- For localhost, use `localhost` not `localhost:3000`

### "Firebase: Error (auth/popup-blocked)"
- User's browser blocked the popup
- Try using redirect instead of popup
- Or ask user to allow popups

### Config not loading
- Make sure all env vars start with `NEXT_PUBLIC_`
- Restart dev server after changing `.env.local`
- Check browser console for errors

### Sign-in not persisting
- Check browser cookies are enabled
- Clear browser cache and try again
- Verify Firebase config is correct

## ✨ Advantages Over Manual OAuth

| Feature | Firebase Auth | Manual OAuth |
|---------|--------------|--------------|
| Setup time | 10 minutes | 1+ hours |
| Redirect URIs | Auto-handled | Manual config |
| Token refresh | Automatic | Manual code |
| Multiple providers | Built-in | Separate setup each |
| User management | Firebase Console | Build yourself |
| Session handling | Automatic | Manual code |
| Security updates | Auto-applied | Manual updates |

## 🎯 Next Steps

After authentication is working:
1. Store user data in your Prisma database
2. Link Firebase UID to User records
3. Add user profiles
4. Implement role-based access
5. Add email verification (optional)
6. Set up custom claims for roles

## 📖 Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Console](https://console.firebase.google.com/)
- [Next.js + Firebase Guide](https://firebase.google.com/docs/auth/web/start)
- [Firebase Auth Best Practices](https://firebase.google.com/docs/auth/admin/verify-id-tokens)

---

**Ready to set this up? Just follow steps 1-6 above and you'll have authentication working in about 10 minutes!** 🚀

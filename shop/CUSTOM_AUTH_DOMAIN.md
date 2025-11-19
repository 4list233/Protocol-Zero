# Custom Domain for Firebase Auth

## The Issue
When signing in, users see: "Sign in with protocolz-e05fe.firebaseapp.com"

This happens because Firebase uses its default auth domain.

## Solutions

### Option 1: Use Your Own Domain (Production - Best Solution)

When you deploy to production, you can use your own domain:

#### Setup Steps:

1. **Deploy to Vercel/Netlify** with your domain (e.g., `protocolzero.com`)

2. **Add Custom Domain to Firebase**:
   - Go to Firebase Console
   - Navigate to **Authentication** > **Settings** > **Authorized domains**
   - Click **Add domain**
   - Enter your domain: `protocolzero.com`
   - Click **Add**

3. **Update Auth Domain in .env.local**:
   ```bash
   # Change from:
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=protocolz-e05fe.firebaseapp.com
   
   # To your domain:
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=protocolzero.com
   ```

4. **Restart dev server**

Now it will say: "Sign in with protocolzero.com" ✅

### Option 2: Accept the Firebase Domain (Development)

For localhost development, the `.firebaseapp.com` domain is standard and secure. Most users understand this for development/testing.

**What users see:**
- "Sign in with protocolz-e05fe.firebaseapp.com"
- This is normal for Firebase apps in development

**Benefits:**
- No extra setup needed
- Works immediately
- Standard practice for Firebase apps

### Option 3: Use Redirect Instead of Popup

Change from popup to redirect mode so users don't see the domain as prominently:

#### Update auth-context.tsx:

```typescript
import { 
  signInWithRedirect,  // Instead of signInWithPopup
  getRedirectResult
} from 'firebase/auth'

// In signInWithGoogle:
const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)  // Changed from signInWithPopup
  } catch (error) {
    console.error('Error signing in with Google:', error)
    throw error
  }
}

// In useEffect, check for redirect result:
useEffect(() => {
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        // User signed in successfully
        console.log('User signed in:', result.user)
      }
    })
    .catch((error) => {
      console.error('Error with redirect:', error)
    })
}, [])
```

**With redirect mode:**
- User clicks "Continue with Google"
- Current page redirects to Google sign-in
- User signs in on Google's page
- Redirects back to your app
- ✅ Less visible domain branding

### Option 4: Create Custom Auth UI

Build your own sign-in page that uses Firebase under the hood but shows your branding:

```typescript
// Custom branded sign-in
const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account',
    // Add custom parameters
  })
  await signInWithPopup(auth, provider)
}
```

## Recommended Approach

### For Development (Now):
- ✅ Keep using the Firebase domain
- ✅ It's secure and standard
- ✅ No extra setup needed

### For Production (Later):
1. ✅ Deploy to your domain (protocolzero.com)
2. ✅ Add domain to Firebase authorized domains
3. ✅ Update NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
4. ✅ Users see your domain!

## Quick Fix: Use Redirect Mode

Want to minimize domain visibility now? Switch to redirect mode:

I can update your auth-context.tsx to use redirect instead of popup. This makes the domain less prominent.

**Would you like me to:**
1. Switch to redirect mode? (domain less visible)
2. Keep popup mode? (current setup)
3. Wait until production with custom domain?

## Firebase Branding

Firebase auth will always show:
- Google's sign-in page (Google branded)
- Small text: "Signing in to [your-auth-domain]"

This is normal OAuth behavior and users trust it because it's Google's official page.

## Production Domain Example

Once deployed:
```bash
# Instead of:
"Sign in with protocolz-e05fe.firebaseapp.com"

# Users will see:
"Sign in with protocolzero.com"
```

Much cleaner! 🎉

---

**For now, the Firebase domain is fine for development. When you deploy to production with your own domain, update the auth domain in Firebase Console and .env.local, and it will show your branded domain instead.**

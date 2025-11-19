"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { 
  User, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

type AuthContextType = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithInstagram: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithInstagram: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If Firebase isn't configured (e.g., missing env vars), skip auth init
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    try {
      if (!auth) throw new Error('Authentication is not available. Please try again later.')
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  const signInWithInstagram = async () => {
    try {
      if (!auth) throw new Error('Authentication is not available. Please try again later.')
      const provider = new FacebookAuthProvider()
      provider.addScope('instagram_basic')
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error('Error signing in with Instagram:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      if (!auth) return
      await firebaseSignOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithInstagram, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

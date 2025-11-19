"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { User, Mail, ShoppingBag, LogOut, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { updateProfile } from "firebase/auth"

export default function AccountPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin")
    }
  }, [user, loading, router])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="/logos/logo-icon.png" 
              alt="Protocol Zero" 
              className="h-10 w-auto"
            />
            <span className="text-xl font-bold tracking-tight">Protocol Zero</span>
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Home</Link>
            <Link href="/shop" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Shop</Link>
            <Link href="/clips" className="text-sm font-medium hover:text-[#3D9A6C] transition-colors">Clips</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="inline-block mb-8">
          <h1 className="text-4xl font-bold tracking-tight relative">
            My Account
            <div className="absolute -bottom-1 left-0 w-1/4 h-1 bg-primary/20 rounded-full"></div>
          </h1>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Profile Section */}
          <div className="md:col-span-1">
            <div className="border-2 rounded-xl p-6 bg-card shadow-sm hover:shadow-md hover:border-[#3D9A6C]/60 transition-all space-y-6">
              {/* Profile Picture */}
              <div className="flex flex-col items-center text-center">
                {user.photoURL ? (
                  <div className="relative">
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || "Profile"}
                      width={120}
                      height={120}
                      className="rounded-full border-4 border-primary/20 mb-4"
                    />
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full border-4 border-background"></div>
                  </div>
                ) : (
                  <div className="w-30 h-30 rounded-full bg-muted flex items-center justify-center mb-4 border-4 border-primary/20">
                    <User className="h-16 w-16 text-primary" />
                  </div>
                )}
                <h2 className="text-xl font-bold mb-1">{user.displayName || "User"}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </p>
                {user.emailVerified && (
                  <span className="mt-2 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* Sign Out Button */}
              <Button onClick={handleSignOut} variant="destructive" className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Account Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Account Information */}
            <div className="border-2 rounded-xl p-6 bg-card shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Account Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Full Name
                    <button
                      type="button"
                      className="ml-2 p-1 rounded hover:bg-[#3D9A6C]/20 transition"
                      onClick={() => setEditingName(true)}
                      aria-label="Edit Full Name"
                    >
                      {/* Pencil Icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#A1A1A1] hover:text-[#3D9A6C] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-1.06 1.06-3.182-3.182 1.06-1.06zM4 20.25V17.5a2.25 2.25 0 012.25-2.25h2.75l8.182-8.182-3.182-3.182L6.25 12.068V14.5A2.25 2.25 0 014 16.75v3.5a.75.75 0 00.75.75h3.5A2.25 2.25 0 0110.5 20.25h-3.5A.75.75 0 014 20.25z" /></svg>
                    </button>
                  </label>
                  {editingName ? (
                    <input
                      type="text"
                      defaultValue={user.displayName || ""}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-[#A1A1A1] bg-background text-base font-semibold focus:outline-none focus:border-[#3D9A6C] focus:ring-2 focus:ring-[#3D9A6C] transition"
                      onBlur={async (e) => {
                        const newName = e.target.value.trim()
                        if (newName && newName !== user.displayName) {
                          try {
                            await updateProfile(user, { displayName: newName })
                            window.location.reload()
                          } catch (err) {
                            alert("Failed to update name.")
                          }
                        }
                        setEditingName(false)
                      }}
                      autoFocus
                    />
                  ) : (
                    <p className="text-base font-semibold mt-1">{user.displayName || "Not provided"}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <p className="text-base font-semibold mt-1">{user.email || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="text-base font-mono text-sm mt-1 text-muted-foreground">{user.uid}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                  <p className="text-base font-semibold mt-1">
                    {user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-2 rounded-xl p-6 bg-card shadow-sm hover:border-[#3D9A6C]/60 transition-all">
              <h3 className="text-2xl font-bold mb-6">Quick Actions</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link href="/shop">
                  <Button variant="outline" className="w-full h-20 flex-col gap-2 hover:border-[#3D9A6C] hover:text-[#3D9A6C] hover:scale-105 transition-all">
                    <ShoppingBag className="h-6 w-6" />
                    <span>Browse Shop</span>
                  </Button>
                </Link>
                <Link href="/cart">
                  <Button variant="outline" className="w-full h-20 flex-col gap-2 hover:border-[#3D9A6C] hover:text-[#3D9A6C] hover:scale-105 transition-all">
                    <ShoppingBag className="h-6 w-6" />
                    <span>View Cart</span>
                  </Button>
                </Link>
                <Link href="/clips">
                  <Button variant="outline" className="w-full h-20 flex-col gap-2 hover:border-[#3D9A6C] hover:text-[#3D9A6C] hover:scale-105 transition-all">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>My Clips</span>
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full h-20 flex-col gap-2 hover:border-[#3D9A6C] hover:text-[#3D9A6C] hover:scale-105 transition-all">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>When We Play</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Connected Accounts */}
            <div className="border-2 rounded-xl p-6 bg-card shadow-sm">
              <h3 className="text-2xl font-bold mb-6">Authentication Method</h3>
              <div className="space-y-3">
                {user.providerData.map((provider) => (
                  <div key={provider.providerId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {provider.providerId === 'google.com' && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        </svg>
                      )}
                      {provider.providerId === 'facebook.com' && (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      )}
                      <span className="font-medium capitalize">{provider.providerId.split('.')[0]}</span>
                    </div>
                    <span className="text-sm text-green-600 font-medium">✓ Connected</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

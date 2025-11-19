// Extend NextAuth types
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

// Utility types for common data structures
export type ClipWithAuthor = {
  id: string
  title: string
  videoUrl: string
  createdAt: Date
  likeCount: number
  author: {
    id: string
    name: string | null
    username: string | null
    image: string | null
  }
}

export type ClipWithComments = ClipWithAuthor & {
  comments: CommentWithAuthor[]
}

export type CommentWithAuthor = {
  id: string
  text: string
  createdAt: Date
  author: {
    id: string
    name: string | null
    username: string | null
    image: string | null
  }
}

export type PlayScheduleDay = {
  date: Date
  playerCount: number
  guestCount: number
  totalCount: number
  isUserCheckedIn: boolean
  userGuestCount?: number
}

export type UserProfile = {
  id: string
  name: string | null
  username: string | null
  email: string | null
  image: string | null
  _count: {
    posts: number
    comments: number
  }
}

// Orders (shared subset of types for UI consumption)
export type OrderListItem = {
  id: string
  userId: string
  userEmail?: string
  customerName?: string
  totalCad: number
  status:
    | 'placed'
    | 'paid'
    | 'purchasing'
    | 'in_production'
    | 'shipped'
    | 'ready_for_pickup'
    | 'dropoff_scheduled'
    | 'dropped_off'
    | 'completed'
    | 'cancelled'
  createdAt: Date
}

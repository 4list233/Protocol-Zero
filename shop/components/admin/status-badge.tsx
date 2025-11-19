"use client"

import clsx from 'clsx'

type Props = { status: string }

const colors: Record<string, string> = {
  placed: 'bg-neutral-800 text-neutral-200 border-neutral-700',
  paid: 'bg-blue-900/30 text-blue-200 border-blue-700/50',
  purchasing: 'bg-amber-900/30 text-amber-200 border-amber-700/50',
  in_production: 'bg-amber-900/30 text-amber-200 border-amber-700/50',
  shipped: 'bg-indigo-900/30 text-indigo-200 border-indigo-700/50',
  ready_for_pickup: 'bg-green-900/30 text-green-200 border-green-700/50',
  dropoff_scheduled: 'bg-purple-900/30 text-purple-200 border-purple-700/50',
  dropped_off: 'bg-purple-900/30 text-purple-200 border-purple-700/50',
  completed: 'bg-emerald-900/30 text-emerald-200 border-emerald-700/50',
  cancelled: 'bg-red-900/30 text-red-200 border-red-700/50',
}

export function StatusBadge({ status }: Props) {
  const label = status.replaceAll('_', ' ')
  return (
    <span className={clsx('text-xs px-2 py-1 rounded border', colors[status] || colors['placed'])}>
      {label}
    </span>
  )
}

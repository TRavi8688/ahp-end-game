// packages/ui/src/components/StatusBadge.tsx
// Unified status badge used across all 8 frontend apps.
// Previously each app had its own colour-coded status system — inconsistent UX.

import React from 'react'

export type StatusType =
  | 'waiting'
  | 'in-progress'
  | 'completed'
  | 'emergency'
  | 'cancelled'
  | 'active'
  | 'inactive'

export interface StatusBadgeProps {
  status: StatusType
  label?: string   // override the default label
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<StatusType, { label: string; className: string; dot: string }> = {
  waiting:     { label: 'Waiting',     className: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-800 border-blue-200',   dot: 'bg-blue-500 animate-pulse' },
  completed:   { label: 'Completed',   className: 'bg-green-100 text-green-800 border-green-200',  dot: 'bg-green-500' },
  emergency:   { label: 'Emergency',   className: 'bg-red-100 text-red-800 border-red-200',         dot: 'bg-red-500 animate-pulse' },
  cancelled:   { label: 'Cancelled',   className: 'bg-gray-100 text-gray-600 border-gray-200',      dot: 'bg-gray-400' },
  active:      { label: 'Active',      className: 'bg-green-100 text-green-800 border-green-200',   dot: 'bg-green-500' },
  inactive:    { label: 'Inactive',    className: 'bg-gray-100 text-gray-600 border-gray-200',      dot: 'bg-gray-400' },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'md' }) => {
  const config = STATUS_CONFIG[status]
  const displayLabel = label ?? config.label

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      ].join(' ')}
      aria-label={`Status: ${displayLabel}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} aria-hidden="true" />
      {displayLabel}
    </span>
  )
}

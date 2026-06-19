// packages/ui/src/index.ts
// PHASE 09 FIX: Shared component library — single source of truth for all
// 8 frontend applications. Previously each app had its own isolated copies
// leading to UX inconsistency and 8x maintenance burden.
//
// HOW TO USE IN A FRONTEND APP:
//   npm install @hospyn/ui
//   import { Button, StatusBadge, PatientCard } from '@hospyn/ui'

// ─── CORE COMPONENTS ─────────────────────────────────────────────────────────
export { Button } from './components/Button'
export { StatusBadge } from './components/StatusBadge'
export { PatientCard } from './components/PatientCard'
export { QueueToken } from './components/QueueToken'
export { LoadingSpinner } from './components/LoadingSpinner'
export { AlertBanner } from './components/AlertBanner'
export { Modal } from './components/Modal'
export { DataTable } from './components/DataTable'

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type { ButtonProps } from './components/Button'
export type { StatusBadgeProps, StatusType } from './components/StatusBadge'
export type { PatientCardProps } from './components/PatientCard'

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
export { COLORS, SPACING, TYPOGRAPHY } from './tokens'

// ─── HOOKS ───────────────────────────────────────────────────────────────────
export { useHospynAuth } from './hooks/useHospynAuth'
export { useApiClient } from './hooks/useApiClient'

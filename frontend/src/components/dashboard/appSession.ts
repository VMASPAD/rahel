import { createContext, useContext } from 'react'
import type { AuthUser, DeviceSummary } from '../../api/auth'

export type AppSession = {
  token: string
  user: AuthUser
  devices: DeviceSummary[]
  reloadSession: () => Promise<void>
  logout: () => void
  /** Element in the top bar where each page renders its title and actions. */
  headerSlot: HTMLElement | null
}

export const AppSessionContext = createContext<AppSession | null>(null)

export function useAppSession(): AppSession {
  const v = useContext(AppSessionContext)
  if (!v) throw new Error('useAppSession must be used inside AppLayout')
  return v
}

/** Base de rutas del panel: '/app' (real) o '/demo' (simulado). */
export type AppBase = { base: '/app' | '/demo'; demo: boolean }

export const AppBaseContext = createContext<AppBase>({ base: '/app', demo: false })

export function useAppBase(): AppBase {
  return useContext(AppBaseContext)
}

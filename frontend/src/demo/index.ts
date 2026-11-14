/** Public surface of the demo-mode simulator (runs entirely in the browser, no server). */
export { installDemoFetch, isDemoRequest, isDemoFetchInstalled } from './fetch.ts'
export { DEMO_TOKEN, DEMO_USER, demoStats, setLatency } from './state.ts'
export { reading } from './model.ts'

import { initState, resetStats } from './state.ts'

/** Forgets everything the user did in the demo (paired/unpaired watches, analysis history, counters). */
export function resetDemo(): void {
  initState()
  resetStats()
}
